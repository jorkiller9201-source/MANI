import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(
        (settings.smtp_host or "").strip()
        and (settings.smtp_user or "").strip()
        and (settings.smtp_password or "").strip()
    )


def send_temporary_password_email(to_email: str, temp_password: str) -> None:
    from_addr = (settings.smtp_from or settings.smtp_user or "").strip()
    if not from_addr:
        raise RuntimeError("SMTP_FROM or SMTP_USER required")

    subject = f"{settings.app_name} — temporary password"
    body = (
        f"You requested a password reset for {settings.app_name}.\n\n"
        f"Temporary password: {temp_password}\n\n"
        "Sign in and change your password as soon as possible.\n"
        f"If you did not request this, contact your {settings.app_name} administrator.\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)