import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("instantly.email")


def send_otp_email(to_email: str, full_name: str, otp_code: str) -> tuple[bool, str]:
    """
    Sends a 6-digit OTP verification email via standard SMTP ($0 cost using Gmail App Password,
    Outlook, Brevo, or free relay).
    If SMTP credentials are not configured, prints the OTP prominently to the server logs
    so developer and demo testing is never blocked.
    """
    sender_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "noreply@instantly.ai"
    sender_name = settings.SMTP_FROM_NAME or "Instantly"
    subject = f"Your Instantly Verification Code: {otp_code}"

    # Always log clearly to stdout/logger for observability and dev mode
    border = "=" * 62
    logger.info(
        f"\n{border}\n"
        f"🔐 [INSTANTLY EMAIL VERIFICATION OTP]\n"
        f"Recipient : {to_email} ({full_name})\n"
        f"Code      : {otp_code}\n"
        f"Expires In: 10 minutes\n"
        f"{border}"
    )
    print(
        f"[INSTANTLY OTP] Verification code for {to_email}: {otp_code} (Valid for 10 min)",
        flush=True,
    )

    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return (
            False,
            "SMTP is not configured in backend environment; verification code logged to server console.",
        )

    text_body = f"""Hello {full_name},

Thank you for signing up for Instantly!

Your 6-digit account verification code is:
{otp_code}

This code is valid for 10 minutes. If you did not request this code, please disregard this email.

Best regards,
The Instantly Team
https://instantly.ai
"""

    current_year = datetime.now(timezone.utc).year
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Instantly Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0e14; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background: #141824; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 32px 36px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(20,24,36,0) 100%);">
              <div style="display: inline-block; width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); line-height: 44px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; margin-bottom: 12px;">⚡</div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Instantly</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Unified Communications Intelligence</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">Verify your email address</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Hello <strong style="color: #ffffff;">{full_name}</strong>, use the single-use 6-digit code below to complete your registration and activate your secure workspace.
              </p>
              
              <div style="background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #a5b4fc; font-weight: 600; margin-bottom: 8px;">Your Verification Code</div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #ffffff; font-family: 'SF Mono', Consolas, Monaco, monospace; text-shadow: 0 2px 10px rgba(99,102,241,0.4);">{otp_code}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">⏱ Expires in <strong>10 minutes</strong></div>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                This code ensures only you can access your connected Gmail and Slack communications. If you did not register for an Instantly account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px; background-color: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                &copy; {current_year} Instantly. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(sender_email, [to_email], msg.as_string())
        logger.info(f"Verification email successfully delivered to {to_email}")
        return True, "Email sent successfully."
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email} via SMTP: {exc}")
        return False, f"SMTP delivery failed: {exc}"
