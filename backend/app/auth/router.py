import logging
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.google import google_sign_in_configured, verify_google_id_token
from app.auth.login_throttle import (
    clear_login_failures,
    is_ip_login_locked_out,
    is_login_locked_out,
    lockout_message_account,
    lockout_message_ip,
    record_failed_login,
    record_failed_login_ip,
)
from app.auth.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleLoginRequest,
    RegisterRequest,
    TokenResponse,
    UserMeResponse,
)
from app.core.activity import log_activity
from app.core.config import settings
from app.core.dependencies import AuthPrincipal, get_current_user, get_registered_user
from app.core.email import send_temporary_password_email, smtp_configured
from app.core.principal import GUEST_EMAIL, GUEST_SUB, is_guest
from app.core.rate_limit import get_client_ip_for_rate_limit, limiter
from app.core.security import create_access_token, hash_password, verify_password
from database.models.user import Role, User, UserSession
from database.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _generate_temporary_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.islower() for c in pwd) and any(c.isupper() for c in pwd) and any(c.isdigit() for c in pwd):
            return pwd


def _resolve_login_base(request: Request, body_login_base: str | None) -> str:
    """Prefer UI-provided origin so local reset emails do not point at Azure."""
    candidate = (body_login_base or "").strip().rstrip("/")
    if candidate.startswith(("http://", "https://")) and " " not in candidate and len(candidate) < 512:
        return candidate
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    if origin.startswith(("http://", "https://")):
        return origin
    return (settings.public_url or "").rstrip("/")


def _issue_token(db: Session, user: User) -> TokenResponse:
    jti = secrets.token_hex(16)
    db.add(UserSession(user_id=user.id, jti=jti))
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": str(user.id), "jti": jti, "email": user.email})
    return TokenResponse(
        access_token=token,
        must_change_password=bool(getattr(user, "must_change_password", False)),
    )


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")
    role = db.query(Role).filter(Role.name == "user").first()
    if not role:
        raise HTTPException(status_code=500, detail="Roles not seeded")
    user = User(
        email=email,
        full_name=(body.full_name or "").strip() or None,
        hashed_password=hash_password(body.password),
        auth_provider="local",
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token(db, user)


def _merge_auth_provider(current: str | None, incoming: str) -> str:
    cur = (current or "local").strip().lower()
    if incoming == "google":
        if cur in ("local", "local+google"):
            return "local+google"
        return "google"
    if incoming == "local":
        if cur in ("google", "local+google"):
            return "local+google"
        return "local"
    return cur or incoming


def _upsert_google_user(db: Session, *, sub: str, email: str, full_name: str | None) -> User:
    by_google = db.query(User).filter(User.google_id == sub).first()
    if by_google:
        if not by_google.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
        if by_google.email != email:
            # Keep email in sync when Google is the linked identity.
            conflict = db.query(User).filter(User.email == email, User.id != by_google.id).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Google email conflicts with another MANI account",
                )
            by_google.email = email
        if full_name and not by_google.full_name:
            by_google.full_name = full_name
        by_google.auth_provider = _merge_auth_provider(by_google.auth_provider, "google")
        return by_google

    by_email = db.query(User).filter(User.email == email).first()
    if by_email:
        if not by_email.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
        if by_email.google_id and by_email.google_id != sub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is linked to a different Google account",
            )
        by_email.google_id = sub
        by_email.auth_provider = _merge_auth_provider(by_email.auth_provider, "google")
        if full_name and not by_email.full_name:
            by_email.full_name = full_name
        return by_email

    role = db.query(Role).filter(Role.name == "user").first()
    if not role:
        raise HTTPException(status_code=500, detail="Roles not seeded")
    # Unusable random password so email/password login cannot succeed by guessing.
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        google_id=sub,
        auth_provider="google",
        role_id=role.id,
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.flush()
    return user


@router.post("/google", response_model=TokenResponse)
@limiter.limit("20/minute")
def google_login(request: Request, body: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Exchange a Google GIS ID token for a MANI session JWT."""
    if not google_sign_in_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured on this server",
        )
    try:
        identity = verify_google_id_token(body.id_token.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified",
        )

    user = _upsert_google_user(
        db,
        sub=identity.sub,
        email=identity.email,
        full_name=(identity.name or "").strip() or None,
    )
    token = _issue_token(db, user)
    log_activity(db, action="login_google", user_id=user.id, detail={"provider": "google"})
    return token


@router.get("/google/status")
def google_status():
    """Frontend can hide the Google button when Client ID is unset."""
    return {"enabled": google_sign_in_configured()}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = (form.username or "").strip().lower()
    client_ip = get_client_ip_for_rate_limit(request)
    if is_login_locked_out(username):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=lockout_message_account())
    if is_ip_login_locked_out(client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=lockout_message_ip())

    user = db.query(User).filter(User.email == username).first()
    provider = (getattr(user, "auth_provider", None) or "local") if user else "local"
    google_only = bool(user and provider == "google")
    if (
        not user
        or google_only
        or not verify_password(form.password, user.hashed_password)
        or not user.is_active
    ):
        record_failed_login(username)
        record_failed_login_ip(client_ip)
        if google_only:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account uses Google Sign-In. Use Continue with Google.",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    clear_login_failures(username)
    token = _issue_token(db, user)
    log_activity(db, action="login", user_id=user.id, detail={"provider": "local"})
    return token


@router.post("/guest", response_model=TokenResponse)
@limiter.limit("30/minute")
def guest_login(request: Request, db: Session = Depends(get_db)):
    """Issue a short-lived guest JWT with no User / UserSession rows."""
    jti = secrets.token_hex(16)
    token = create_access_token(
        {"sub": GUEST_SUB, "jti": jti, "email": GUEST_EMAIL, "guest": True},
        expires_delta=timedelta(minutes=settings.guest_token_expire_minutes),
    )
    log_activity(db, action="login_guest", is_guest=True, detail={"provider": "guest"})
    return TokenResponse(access_token=token, must_change_password=False)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_REGISTERED"},
        )

    temp_password = _generate_temporary_password()
    dev_logged = False
    login_base = _resolve_login_base(request, body.login_base)

    if smtp_configured():
        # Send first so a failed SMTP never leaves the account on an unknown password.
        try:
            send_temporary_password_email(user.email, temp_password, login_base=login_base)
        except Exception as exc:
            logger.exception("forgot-password email failed for %s", email)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "EMAIL_SEND_FAILED", "message": str(exc)},
            ) from exc
    elif settings.app_env == "development" and settings.smtp_password_reset_dev_log:
        logger.warning(
            "SMTP not configured — temporary password for %s: %s (change after sign-in) login_base=%s",
            email,
            temp_password,
            login_base,
        )
        dev_logged = True
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SMTP_NOT_CONFIGURED"},
        )

    # Re-load by id so the write hits this request's session explicitly.
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_REGISTERED"})
    db_user.hashed_password = hash_password(temp_password)
    db_user.must_change_password = True
    for s in db.query(UserSession).filter(UserSession.user_id == db_user.id, UserSession.revoked.is_(False)):
        s.revoked = True
    db.commit()
    return ForgotPasswordResponse(ok=True, dev_logged=dev_logged)


@router.post("/change-password", response_model=ChangePasswordResponse)
@limiter.limit("10/minute")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    user: User = Depends(get_registered_user),
    db: Session = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

    # Always mutate a row loaded in this session (avoids silent no-op if identity map drifts).
    db_user = db.query(User).filter(User.id == user.id, User.is_active.is_(True)).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")

    if verify_password(body.new_password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the temporary password",
        )

    new_hash = hash_password(body.new_password)
    db_user.hashed_password = new_hash
    db_user.must_change_password = False
    for s in db.query(UserSession).filter(UserSession.user_id == db_user.id, UserSession.revoked.is_(False)):
        s.revoked = True
    db.commit()

    # Verify persistence before telling the client it worked.
    db.refresh(db_user)
    if db_user.must_change_password or not verify_password(body.new_password, db_user.hashed_password):
        logger.error("change-password failed to persist for user_id=%s", db_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password update did not persist; try again",
        )

    token = _issue_token(db, db_user)
    return ChangePasswordResponse(
        ok=True,
        must_change_password=False,
        access_token=token.access_token,
    )


@router.get("/me", response_model=UserMeResponse)
def me(user: AuthPrincipal = Depends(get_current_user)):
    guest = is_guest(user)
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role_name,
        must_change_password=bool(getattr(user, "must_change_password", False)),
        is_guest=guest,
    )


@router.post("/logout")
def logout(user: AuthPrincipal = Depends(get_current_user), db: Session = Depends(get_db)):
    if is_guest(user):
        # Guest JWT has no server session row — client clears the token.
        return {"ok": True}
    for s in db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked.is_(False)):
        s.revoked = True
    db.commit()
    return {"ok": True}
