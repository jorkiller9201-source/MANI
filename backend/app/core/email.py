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


def send_temporary_password_email(
    to_email: str,
    temp_password: str,
    *,
    login_base: str | None = None,
) -> None:
    from_addr = (settings.smtp_from or settings.smtp_user or "").strip()
    if not from_addr:
        raise RuntimeError("SMTP_FROM or SMTP_USER required")

    app = settings.app_name
    base = (login_base or settings.public_url or "").rstrip("/")
    login_url = f"{base}/login" if base else "/login"

    subject = f"{app} — temporary password / contraseña temporal"
    body = (
        f"EN — Password reset for {app}\n"
        f"You requested a password reset. Use this temporary password to sign in:\n\n"
        f"  {temp_password}\n\n"
        f"Sign in here (same site where you requested reset): {login_url}\n"
        "After sign-in, MANI will ask you to choose a new permanent password.\n"
        "Use that new password for future sign-ins (the temporary one stops working).\n"
        f"If you did not request this, ignore this email or contact the {app} team.\n\n"
        "—\n\n"
        f"ES — Restablecimiento de contraseña para {app}\n"
        "Solicitaste recuperar el acceso. Usa esta contraseña temporal para iniciar sesión:\n\n"
        f"  {temp_password}\n\n"
        f"Entra aquí (el mismo sitio donde pediste el reset): {login_url}\n"
        "Después del acceso, MANI te pedirá elegir una contraseña permanente nueva.\n"
        "Usa esa nueva contraseña en futuros inicios (la temporal deja de servir).\n"
        f"Si no pediste esto, ignora el correo o contacta al equipo {app}.\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    host = settings.smtp_host.strip()
    port = int(settings.smtp_port)
    smtp_password = (settings.smtp_password or "").replace(" ", "")
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_user.strip(), smtp_password)
        smtp.send_message(msg)
    logger.info("Temporary password email sent to %s via %s", to_email, host)
