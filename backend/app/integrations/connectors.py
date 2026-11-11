import base64
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime
import html
import re
import time
import urllib.parse
from typing import Any, Optional

import httpx

from app.core.config import settings

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
]

SLACK_SCOPES = [
    "channels:history",
    "channels:read",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "users:read",
    "chat:write",
]


def _strip_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"</p\s*>", "\n\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _decode_base64url(data: str) -> str:
    if not data:
        return ""
    padded = data + "=" * (-len(data) % 4)
    try:
        raw_bytes = base64.urlsafe_b64decode(padded.encode("utf-8"))
        return raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_plain_body(payload: dict[str, Any]) -> str:
    if not payload:
        return ""

    mime_type = (payload.get("mimeType") or "").lower()
    body_data = (payload.get("body") or {}).get("data")

    if mime_type == "text/plain" and body_data:
        text = _decode_base64url(body_data).strip()
        if text:
            return text

    parts = payload.get("parts") or []
    # First pass: look for text/plain in parts
    for part in parts:
        part_mime = (part.get("mimeType") or "").lower()
        if part_mime == "text/plain":
            data = (part.get("body") or {}).get("data")
            if data:
                text = _decode_base64url(data).strip()
                if text:
                    return text
        elif part.get("parts"):
            nested = _extract_plain_body(part)
            if nested:
                return nested

    # Second pass: fallback to text/html if no text/plain part was found
    if mime_type == "text/html" and body_data:
        return _strip_html(_decode_base64url(body_data))

    for part in parts:
        part_mime = (part.get("mimeType") or "").lower()
        if part_mime == "text/html":
            data = (part.get("body") or {}).get("data")
            if data:
                stripped = _strip_html(_decode_base64url(data))
                if stripped:
                    return stripped
        elif part.get("parts"):
            nested = _extract_plain_body(part)
            if nested:
                return nested

    if body_data:
        return _decode_base64url(body_data).strip()

    return ""


def _request_with_retry(
    client: httpx.Client,
    method: str,
    url: str,
    max_retries: int = 3,
    **kwargs: Any,
) -> httpx.Response:
    backoff = 0.5
    last_exc: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            resp = client.request(method, url, **kwargs)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                time.sleep(backoff)
                backoff *= 2
                continue
            return resp
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("Request failed after retries")


class GmailConnector:
    @staticmethod
    def is_configured() -> bool:
        return bool(
            settings.GOOGLE_CLIENT_ID
            and settings.GOOGLE_CLIENT_SECRET
            and settings.GOOGLE_REDIRECT_URI
            and not settings.GOOGLE_CLIENT_ID.startswith("your-google")
            and not settings.GOOGLE_CLIENT_SECRET.startswith("your-google")
        )

    @staticmethod
    def validate_config() -> Optional[str]:
        missing = []
        if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.startswith("your-google"):
            missing.append("GOOGLE_CLIENT_ID")
        if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.startswith("your-google"):
            missing.append("GOOGLE_CLIENT_SECRET")
        if not settings.GOOGLE_REDIRECT_URI:
            missing.append("GOOGLE_REDIRECT_URI")
        if missing:
            return (
                f"Missing {', '.join(missing)} in backend .env. "
                "Instantly never fakes a live connection; configure OAuth credentials or continue in Demo Mode."
            )
        return None

    @staticmethod
    def get_authorization_url(state: str) -> Optional[str]:
        if not GmailConnector.is_configured():
            return None
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(GMAIL_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    @staticmethod
    def exchange_code_for_tokens(code: str) -> dict[str, Any]:
        if not GmailConnector.is_configured():
            raise ValueError("Google OAuth Client ID and Secret are not configured in environment.")
        with httpx.Client(timeout=15.0) as client:
            resp = _request_with_retry(
                client,
                "POST",
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def refresh_access_token(refresh_token: str) -> dict[str, Any]:
        if not GmailConnector.is_configured():
            raise ValueError("Google OAuth Client ID and Secret are not configured in environment.")
        with httpx.Client(timeout=15.0) as client:
            resp = _request_with_retry(
                client,
                "POST",
                "https://oauth2.googleapis.com/token",
                data={
                    "refresh_token": refresh_token,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def get_user_profile(access_token: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=15.0) as client:
            resp = _request_with_retry(
                client,
                "GET",
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
            # Fallback to OAuth2 userinfo endpoint
            resp_info = _request_with_retry(
                client,
                "GET",
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers=headers,
            )
            resp_info.raise_for_status()
            data = resp_info.json()
            return {"emailAddress": data.get("email")}

    @staticmethod
    def revoke_token(token: str) -> bool:
        if not token:
            return False
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": token},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                return resp.status_code == 200
        except Exception:
            return False

    @staticmethod
    def fetch_recent_messages(
        access_token: str,
        max_results: int = 50,
        days: int = 7,
        after_timestamp: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        headers = {"Authorization": f"Bearer {access_token}"}
        query = f"after:{after_timestamp}" if after_timestamp else f"newer_than:{days}d"

        with httpx.Client(timeout=20.0) as client:
            list_resp = _request_with_retry(
                client,
                "GET",
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers=headers,
                params={"q": query, "maxResults": max_results},
            )
            list_resp.raise_for_status()
            stubs = list_resp.json().get("messages") or []

            normalized: list[dict[str, Any]] = []
            for stub in stubs:
                msg_id = stub.get("id")
                if not msg_id:
                    continue
                detail_resp = _request_with_retry(
                    client,
                    "GET",
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if detail_resp.status_code != 200:
                    continue
                msg_data = detail_resp.json()
                normalized.append(GmailConnector.parse_gmail_message(msg_data))

            return normalized

    @staticmethod
    def parse_gmail_message(msg_data: dict[str, Any]) -> dict[str, Any]:
        msg_id = msg_data.get("id", "")
        thread_id = msg_data.get("threadId") or msg_id
        label_ids = set(msg_data.get("labelIds") or [])
        snippet = html.unescape(msg_data.get("snippet") or "").strip()

        payload = msg_data.get("payload") or {}
        headers_list = payload.get("headers") or []
        headers_map: dict[str, str] = {}
        for h in headers_list:
            name = (h.get("name") or "").lower()
            val = h.get("value") or ""
            if name and name not in headers_map:
                headers_map[name] = val

        raw_from = headers_map.get("from", "Unknown Sender")
        raw_to = headers_map.get("to", "")
        subject = headers_map.get("subject", "").strip() or "(No subject)"
        raw_date = headers_map.get("date", "")

        display_name, email_addr = parseaddr(raw_from)
        sender_name = display_name.strip() or (email_addr.split("@")[0] if email_addr else raw_from)
        sender_email = email_addr.strip() or raw_from

        received_at = datetime.now(timezone.utc)
        internal_date = msg_data.get("internalDate")
        if internal_date:
            try:
                received_at = datetime.fromtimestamp(int(internal_date) / 1000.0, tz=timezone.utc)
            except Exception:
                pass
        elif raw_date:
            try:
                dt = parsedate_to_datetime(raw_date)
                received_at = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass

        body_text = _extract_plain_body(payload)
        if not body_text:
            body_text = snippet or subject

        preview_text = snippet or body_text[:200].replace("\n", " ").strip()

        return {
            "external_id": msg_id,
            "thread_id": thread_id,
            "source": "gmail",
            "sender_name": sender_name[:255],
            "sender_email_or_handle": sender_email[:255],
            "recipient": raw_to[:255],
            "subject_or_channel": subject[:512],
            "preview": preview_text,
            "body": body_text,
            "received_at": received_at,
            "is_unread": "UNREAD" in label_ids,
            "is_starred": "STARRED" in label_ids,
            "labels": list(label_ids),
        }

    @staticmethod
    def create_gmail_draft(access_token: str, recipient: str, subject: str, body: str) -> dict[str, Any]:
        clean_subj = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        raw_email = f"To: {recipient}\r\nSubject: {clean_subj}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}"
        encoded_message = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"message": {"raw": encoded_message}},
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def send_gmail_message(
        access_token: str,
        recipient: str,
        subject: str,
        body: str,
        thread_id: Optional[str] = None,
    ) -> dict[str, Any]:
        clean_subj = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        raw_email = (
            f"To: {recipient}\r\n"
            f"Subject: {clean_subj}\r\n"
            f"Content-Type: text/plain; charset=utf-8\r\n\r\n"
            f"{body}"
        )
        encoded_message = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")
        payload: dict[str, Any] = {"raw": encoded_message}
        if thread_id and not thread_id.startswith("thread-"):
            payload["threadId"] = thread_id

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {access_token}"},
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def build_gmail_compose_url(recipient: str, subject: str, body: str) -> str:
        clean_subj = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        params = {
            "view": "cm",
            "fs": "1",
            "to": recipient,
            "su": clean_subj,
            "body": body,
        }
        return f"https://mail.google.com/mail/?{urllib.parse.urlencode(params)}"


class SlackConnector:
    @staticmethod
    def is_configured() -> bool:
        has_oauth = bool(
            settings.SLACK_CLIENT_ID
            and settings.SLACK_CLIENT_SECRET
            and not settings.SLACK_CLIENT_ID.startswith("your-slack")
        )
        has_bot = bool(settings.SLACK_BOT_TOKEN and not settings.SLACK_BOT_TOKEN.startswith("xoxb-your"))
        return has_oauth or has_bot

    @staticmethod
    def get_authorization_url(state: str = "instantly_slack_oauth") -> Optional[str]:
        if not (
            settings.SLACK_CLIENT_ID
            and settings.SLACK_CLIENT_SECRET
            and not settings.SLACK_CLIENT_ID.startswith("your-slack")
        ):
            return None
        params = {
            "client_id": settings.SLACK_CLIENT_ID,
            "user_scope": ",".join(SLACK_SCOPES),
            "redirect_uri": settings.SLACK_REDIRECT_URI,
            "state": state,
        }
        return f"https://slack.com/oauth/v2/authorize?{urllib.parse.urlencode(params)}"

    @staticmethod
    def exchange_code_for_tokens(code: str) -> dict[str, Any]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "code": code,
                    "client_id": settings.SLACK_CLIENT_ID,
                    "client_secret": settings.SLACK_CLIENT_SECRET,
                    "redirect_uri": settings.SLACK_REDIRECT_URI,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise ValueError(f"Slack oauth.v2.access failed: {data.get('error', 'unknown_error')}")
            return data

    @staticmethod
    def fetch_recent_messages(
        access_token: str,
        max_channels: int = 6,
        messages_per_channel: int = 8,
    ) -> list[dict[str, Any]]:
        headers = {"Authorization": f"Bearer {access_token}"}
        normalized: list[dict[str, Any]] = []
        user_cache: dict[str, tuple[str, str]] = {}

        with httpx.Client(timeout=20.0) as client:
            conv_resp = _request_with_retry(
                client,
                "GET",
                "https://slack.com/api/conversations.list",
                headers=headers,
                params={
                    "types": "public_channel,private_channel,im",
                    "exclude_archived": "true",
                    "limit": 25,
                },
            )
            conv_data = conv_resp.json()
            if not conv_data.get("ok"):
                # Fallback to public channels only if private/im scopes were not granted
                conv_resp = _request_with_retry(
                    client,
                    "GET",
                    "https://slack.com/api/conversations.list",
                    headers=headers,
                    params={"types": "public_channel", "exclude_archived": "true", "limit": 15},
                )
                conv_data = conv_resp.json()
                if not conv_data.get("ok"):
                    raise ValueError(f"Slack conversations.list failed: {conv_data.get('error', 'unknown_error')}")

            channels = conv_data.get("channels") or []
            # Prioritize channels the user is a member of or direct messages
            channels.sort(key=lambda c: (not bool(c.get("is_member") or c.get("is_im")), c.get("name", "")))
            selected_channels = channels[:max_channels]

            def resolve_user(uid: str) -> tuple[str, str]:
                if not uid:
                    return ("Slack Teammate", "@teammate")
                if uid in user_cache:
                    return user_cache[uid]
                try:
                    u_resp = client.get(
                        "https://slack.com/api/users.info",
                        headers=headers,
                        params={"user": uid},
                    )
                    u_data = u_resp.json()
                    if u_data.get("ok") and u_data.get("user"):
                        u_obj = u_data["user"]
                        profile = u_obj.get("profile") or {}
                        real_name = (
                            profile.get("real_name")
                            or u_obj.get("real_name")
                            or profile.get("display_name")
                            or u_obj.get("name")
                            or uid
                        )
                        handle = u_obj.get("name") or real_name.lower().replace(" ", ".")
                        user_cache[uid] = (real_name, f"@{handle}")
                        return user_cache[uid]
                except Exception:
                    pass
                user_cache[uid] = (f"User {uid[:6]}", f"@{uid.lower()}")
                return user_cache[uid]

            for ch in selected_channels:
                ch_id = ch.get("id")
                if not ch_id:
                    continue
                is_im = bool(ch.get("is_im"))
                ch_name = ch.get("name") or ch_id

                hist_resp = _request_with_retry(
                    client,
                    "GET",
                    "https://slack.com/api/conversations.history",
                    headers=headers,
                    params={"channel": ch_id, "limit": messages_per_channel},
                )
                hist_data = hist_resp.json()
                if not hist_data.get("ok"):
                    continue

                for m in hist_data.get("messages") or []:
                    if m.get("subtype") in ("channel_join", "channel_leave"):
                        continue
                    text = (m.get("text") or "").strip()
                    if not text:
                        continue
                    ts = m.get("ts") or ""
                    thread_ts = m.get("thread_ts") or ts
                    uid = m.get("user") or ch.get("user") or ""
                    sender_name, sender_handle = resolve_user(uid)

                    try:
                        received_at = datetime.fromtimestamp(float(ts), tz=timezone.utc)
                    except Exception:
                        received_at = datetime.now(timezone.utc)

                    channel_label = f"DM with {sender_name}" if is_im else f"#{ch_name}"
                    preview = text[:200].replace("\n", " ").strip()

                    normalized.append(
                        {
                            "external_id": f"{ch_id}:{ts}",
                            "thread_id": f"{ch_id}:{thread_ts}",
                            "source": "slack",
                            "sender_name": sender_name[:255],
                            "sender_email_or_handle": sender_handle[:255],
                            "subject_or_channel": channel_label[:512],
                            "preview": preview,
                            "body": text,
                            "received_at": received_at,
                            "is_unread": True,
                            "is_starred": False,
                        }
                    )

        return normalized

    @staticmethod
    def verify_bot_token(token: str) -> dict[str, Any]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {token}"},
            )
            data = resp.json()
            if not data.get("ok"):
                raise ValueError(f"Slack auth.test failed: {data.get('error', 'unknown_error')}")
            return data

    @staticmethod
    def send_slack_message(
        token: str,
        channel: str,
        text: str,
        thread_ts: Optional[str] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"channel": channel, "text": text}
        if thread_ts:
            payload["thread_ts"] = thread_ts
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise ValueError(f"Slack chat.postMessage failed: {data.get('error', 'unknown_error')}")
            return data
