import logging
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

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
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    RegisterRequest,
    TokenResponse,
    UserMeResponse,
)
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.email import send_temporary_password_email, smtp_configured
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


def _issue_token(db: Session, user: User) -> TokenResponse:
    jti = secrets.token_hex(16)
    db.add(UserSession(user_id=user.id, jti=jti))
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": str(user.id), "jti": jti, "email": user.email})
    return TokenResponse(access_token=token)


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
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token(db, user)


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
    if not user or not verify_password(form.password, user.hashed_password) or not user.is_active:
        record_failed_login(username)
        record_failed_login_ip(client_ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    clear_login_failures(username)
    return _issue_token(db, user)


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
    user.hashed_password = hash_password(temp_password)
    for s in db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked.is_(False)):
        s.revoked = True
    db.commit()

    if smtp_configured():
        try:
            send_temporary_password_email(user.email, temp_password)
        except Exception as exc:
            logger.exception("forgot-password email failed for %s", email)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "EMAIL_SEND_FAILED", "message": str(exc)},
            ) from exc
        return ForgotPasswordResponse(ok=True, dev_logged=False)

    if settings.app_env == "development" and settings.smtp_password_reset_dev_log:
        logger.warning(
            "SMTP not configured — temporary password for %s: %s (change after sign-in)",
            email,
            temp_password,
        )
        return ForgotPasswordResponse(ok=True, dev_logged=True)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "SMTP_NOT_CONFIGURED"},
    )


@router.get("/me", response_model=UserMeResponse)
def me(user: User = Depends(get_current_user)):
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role_name,
    )


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for s in db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked.is_(False)):
        s.revoked = True
    db.commit()
    return {"ok": True}
