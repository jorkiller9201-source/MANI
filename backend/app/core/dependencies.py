from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.principal import GUEST_SUB, GuestPrincipal, is_guest
from app.core.security import decode_access_token
from database.models.user import User, UserSession
from database.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

AuthPrincipal = User | GuestPrincipal


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthPrincipal:
    """Registered user or ephemeral guest (JWT with guest=true, no DB session)."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("guest") is True:
        if payload.get("sub") != GUEST_SUB or not payload.get("jti"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid guest token")
        return GuestPrincipal()

    user_id = payload.get("sub")
    jti = payload.get("jti")
    if user_id is None or jti is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    session = db.query(UserSession).filter(UserSession.jti == jti, UserSession.revoked.is_(False)).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")
    user = db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")
    return user


def get_registered_user(
    principal: AuthPrincipal = Depends(get_current_user),
) -> User:
    """Reject guest tokens — for password change and any account-only mutations."""
    if is_guest(principal):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest sessions cannot access this resource",
        )
    return principal  # type: ignore[return-value]


def require_admin(user: User = Depends(get_registered_user)) -> User:
    """Only users with role name 'admin'."""
    if user.role_name != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user

