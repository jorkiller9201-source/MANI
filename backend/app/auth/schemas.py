from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class GoogleLoginRequest(BaseModel):
    """GIS credential (JWT ID token) from Google Identity Services."""

    id_token: str = Field(min_length=20, max_length=8192)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    # Origin of the UI that requested reset (e.g. http://localhost:3100) so the
    # email login link matches the DB that actually received the temp password.
    login_base: str | None = Field(default=None, max_length=512)


class ForgotPasswordResponse(BaseModel):
    ok: bool = True
    dev_logged: bool = False


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordResponse(BaseModel):
    ok: bool = True
    must_change_password: bool = False
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str | None
    must_change_password: bool = False
    is_guest: bool = False

    model_config = {"from_attributes": True}
