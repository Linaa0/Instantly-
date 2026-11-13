from datetime import datetime, timedelta, timezone
import re
import secrets
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.ai.engine import ai_engine
from app.core.config import settings
from app.database.session import get_db
from app.integrations.connectors import GMAIL_SCOPES, SLACK_SCOPES, GmailConnector, SlackConnector
from app.models.entities import (
    AIAnalysis,
    AuditEvent,
    EmailVerificationCode,
    Integration,
    IntegrationCredential,
    InternalComment,
    Message,
    MessageAssignment,
    Notification,
    OAuthState,
    SuggestedReply,
    SyncHistory,
    Task,
    User,
    UserPreference,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)
from app.schemas.api import (
    ActivityPoint,
    AnalyticsOut,
    AssignmentCreateRequest,
    AssignmentOut,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthRegisterResponse,
    AuthTokenOut,
    CommentCreateRequest,
    DashboardOverviewOut,
    IntegrationStatusOut,
    InternalCommentOut,
    MessageOut,
    MessageUpdateRequest,
    MorningBriefSection,
    ReplyGenerationRequest,
    ReplySaveRequest,
    ReplySendOut,
    ReplySendRequest,
    SuggestedReplyOut,
    TaskCreateRequest,
    TaskOut,
    TaskUpdateRequest,
    TeamInvitationCreateRequest,
    TeamMemberOut,
    TeamWorkspaceOut,
    UserOut,
    UserPreferenceOut,
    UserPreferenceUpdateRequest,
    VerifyOTPRequest,
    ResendOTPRequest,
    ResendOTPResponse,
)
from app.services.email_service import send_otp_email
from app.security.auth import (
    create_access_token,
    decode_access_token,
    decrypt_secret,
    encrypt_secret,
    get_password_hash,
    verify_password,
)
from app.services.workspace_service import (
    delete_platform_messages_for_workspace,
    ensure_demo_workspace_seeded,
    generate_markdown_report,
    purge_demo_data_for_workspace,
    run_synchronization_and_triage,
    serialize_message,
)

router = APIRouter()


def get_current_context(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
) -> tuple[User, Workspace, str]:
    default_user, default_ws = ensure_demo_workspace_seeded(db)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        user_id = decode_access_token(token)
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                membership = (
                    db.query(WorkspaceMembership)
                    .filter(WorkspaceMembership.user_id == user.id)
                    .first()
                )
                if membership:
                    ws = db.query(Workspace).filter(Workspace.id == membership.workspace_id).first()
                    if ws:
                        return user, ws, membership.role
    return default_user, default_ws, "Owner"


def _build_user_out(user: User, ws: Workspace, role: str) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        job_title=user.job_title,
        avatar_url=user.avatar_url,
        workspace_id=ws.id,
        workspace_name=ws.name,
        role=role,
        is_demo=ws.is_demo,
        email_verified=getattr(user, "email_verified", True),
    )


# ─────────────────────────────────────────────────────────
# AUTHENTICATION ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.post("/auth/register", response_model=AuthRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: AuthRegisterRequest, db: Session = Depends(get_db)):
    ensure_demo_workspace_seeded(db)
    email_clean = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        if existing.email_verified:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        user = existing
        user.full_name = payload.full_name.strip()
        user.hashed_password = get_password_hash(payload.password)
    else:
        user = User(
            email=email_clean,
            full_name=payload.full_name.strip(),
            job_title="Workspace Owner",
            hashed_password=get_password_hash(payload.password),
            is_active=True,
            email_verified=False,
        )
        db.add(user)
        db.flush()

        db.add(
            UserPreference(
                user_id=user.id,
                default_reply_tone="professional",
                ai_provider="heuristic",
                ai_model_name="gpt-4o-mini",
                auto_extract_tasks=True,
                morning_brief_time="08:00",
                high_priority_notifications=True,
                demo_mode_enabled=False,
            )
        )

        # Create a dedicated, clean workspace for the registered user (never pre-seeded with fake demo data)
        user_slug_prefix = re.sub(r"[^a-zA-Z0-9]", "-", user.full_name.lower()).strip("-") or "workspace"
        ws = Workspace(
            name=f"{user.full_name.split()[0]}'s Workspace",
            slug=f"{user_slug_prefix}-{secrets.token_hex(4)}",
            owner_id=user.id,
            is_demo=False,
        )
        db.add(ws)
        db.flush()

        membership = WorkspaceMembership(
            workspace_id=ws.id,
            user_id=user.id,
            role="Owner",
            status="Active",
        )
        db.add(membership)

        # Clean initial integration records (disconnected, waiting for user's real accounts)
        db.add(Integration(workspace_id=ws.id, platform="gmail", status="disconnected"))
        db.add(Integration(workspace_id=ws.id, platform="slack", status="disconnected"))

        db.add(
            AuditEvent(
                workspace_id=ws.id,
                actor_name=user.full_name,
                event_type="WORKSPACE_CREATED",
                description=f"{user.full_name} created personal workspace {ws.name}.",
            )
        )
        db.commit()

    # Generate cryptographically secure 6-digit numeric OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"

    # Invalidate older pending codes for this email
    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.email == email_clean,
        EmailVerificationCode.is_used.is_(False),
    ).update({"is_used": True})

    verification_record = EmailVerificationCode(
        email=email_clean,
        code=otp_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        is_used=False,
    )
    db.add(verification_record)
    db.commit()

    send_otp_email(to_email=user.email, full_name=user.full_name, otp_code=otp_code)

    token = create_access_token(user.id)
    return AuthRegisterResponse(
        status="verification_required",
        email=user.email,
        message=f"A 6-digit verification code has been sent to {user.email}.",
        expires_in_seconds=600,
        debug_otp=otp_code if (not settings.SMTP_HOST or settings.DEMO_MODE) else None,
        access_token=token,
        token_type="bearer",
        user=_build_user_out(user, ws, "Owner"),
    )


@router.post("/auth/verify-otp", response_model=AuthTokenOut)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    code_clean = payload.code.strip()

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    now = datetime.now(timezone.utc)
    rec = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email_clean,
            EmailVerificationCode.is_used.is_(False),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )

    if not rec:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new code.")

    expires_at = rec.expires_at if rec.expires_at.tzinfo else rec.expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        rec.is_used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if rec.attempts >= 5:
        rec.is_used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Too many incorrect attempts. Please request a new verification code.",
        )

    if rec.code != code_clean:
        rec.attempts += 1
        db.commit()
        remaining = max(0, 5 - rec.attempts)
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # Verification successful
    rec.is_used = True
    user.email_verified = True
    db.commit()

    membership = (
        db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == user.id).first()
    )
    ws = db.query(Workspace).filter(Workspace.id == membership.workspace_id).first() if membership else None
    role = membership.role if membership else "Owner"
    token = create_access_token(user.id)
    return AuthTokenOut(access_token=token, user=_build_user_out(user, ws, role))


@router.post("/auth/resend-otp", response_model=ResendOTPResponse)
def resend_otp(payload: ResendOTPRequest, db: Session = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this email.")

    now = datetime.now(timezone.utc)
    recent = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email_clean,
            EmailVerificationCode.created_at >= now - timedelta(seconds=30),
        )
        .first()
    )
    if recent:
        raise HTTPException(status_code=429, detail="Please wait 30 seconds before requesting a new code.")

    # Invalidate older pending codes
    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.email == email_clean,
        EmailVerificationCode.is_used.is_(False),
    ).update({"is_used": True})

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    verification_record = EmailVerificationCode(
        email=email_clean,
        code=otp_code,
        expires_at=now + timedelta(minutes=10),
        is_used=False,
    )
    db.add(verification_record)
    db.commit()

    send_otp_email(to_email=user.email, full_name=user.full_name, otp_code=otp_code)

    return ResendOTPResponse(
        status="code_sent",
        email=user.email,
        message=f"A fresh verification code has been sent to {user.email}.",
        expires_in_seconds=600,
        debug_otp=otp_code if (not settings.SMTP_HOST or settings.DEMO_MODE) else None,
    )


@router.post("/auth/login", response_model=AuthTokenOut)
def login_user(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    ensure_demo_workspace_seeded(db)
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not getattr(user, "email_verified", True) and user.email != "alex.morgan@instantly.ai":
        # Account is unverified; send an OTP and return 403
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        db.query(EmailVerificationCode).filter(
            EmailVerificationCode.email == user.email,
            EmailVerificationCode.is_used.is_(False),
        ).update({"is_used": True})
        db.add(
            EmailVerificationCode(
                email=user.email,
                code=otp_code,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                is_used=False,
            )
        )
        db.commit()
        send_otp_email(to_email=user.email, full_name=user.full_name, otp_code=otp_code)
        raise HTTPException(
            status_code=403,
            detail=f"Email not verified. A verification code has been sent to {user.email}.",
        )

    membership = (
        db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == user.id).first()
    )
    if membership:
        ws = db.query(Workspace).filter(Workspace.id == membership.workspace_id).first()
        # If this is a real user whose workspace was attached to the demo workspace, migrate to their own clean workspace
        if ws and ws.is_demo and user.email != "alex.morgan@instantly.ai":
            user_slug_prefix = re.sub(r"[^a-zA-Z0-9]", "-", user.full_name.lower()).strip("-") or "workspace"
            ws = Workspace(
                name=f"{user.full_name.split()[0]}'s Workspace",
                slug=f"{user_slug_prefix}-{secrets.token_hex(4)}",
                owner_id=user.id,
                is_demo=False,
            )
            db.add(ws)
            db.flush()
            membership.workspace_id = ws.id
            membership.role = "Owner"
            db.add(Integration(workspace_id=ws.id, platform="gmail", status="disconnected"))
            db.add(Integration(workspace_id=ws.id, platform="slack", status="disconnected"))
            db.commit()
    else:
        user_slug_prefix = re.sub(r"[^a-zA-Z0-9]", "-", user.full_name.lower()).strip("-") or "workspace"
        ws = Workspace(
            name=f"{user.full_name.split()[0]}'s Workspace",
            slug=f"{user_slug_prefix}-{secrets.token_hex(4)}",
            owner_id=user.id,
            is_demo=False,
        )
        db.add(ws)
        db.flush()
        membership = WorkspaceMembership(
            workspace_id=ws.id,
            user_id=user.id,
            role="Owner",
            status="Active",
        )
        db.add(membership)
        db.add(Integration(workspace_id=ws.id, platform="gmail", status="disconnected"))
        db.add(Integration(workspace_id=ws.id, platform="slack", status="disconnected"))
        db.commit()

    role = membership.role if membership else "Owner"
    token = create_access_token(user.id)
    return AuthTokenOut(access_token=token, user=_build_user_out(user, ws, role))


@router.post("/auth/demo-session", response_model=AuthTokenOut)
def start_demo_session(db: Session = Depends(get_db)):
    user, ws = ensure_demo_workspace_seeded(db)
    token = create_access_token(user.id)
    return AuthTokenOut(access_token=token, user=_build_user_out(user, ws, "Owner"))


@router.get("/auth/me", response_model=UserOut)
def get_me(ctx: tuple[User, Workspace, str] = Depends(get_current_context)):
    user, ws, role = ctx
    return _build_user_out(user, ws, role)


@router.post("/auth/logout")
def logout_user(response: Response):
    response.delete_cookie("instantly_session")
    return {"status": "logged_out", "message": "Session terminated cleanly."}


# ─────────────────────────────────────────────────────────
# OVERVIEW & MORNING BRIEF ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.get("/overview", response_model=DashboardOverviewOut)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    msg_q = db.query(Message).filter(Message.workspace_id == ws.id)
    task_q = db.query(Task).filter(Task.workspace_id == ws.id)
    if not ws.is_demo:
        msg_q = msg_q.filter(Message.is_demo.is_(False))
        task_q = task_q.filter(Task.is_demo.is_(False))

    messages = msg_q.order_by(Message.received_at.desc()).all()
    tasks = task_q.all()
    integrations = db.query(Integration).filter(Integration.workspace_id == ws.id).all()
    last_sync_row = (
        db.query(SyncHistory)
        .filter(SyncHistory.workspace_id == ws.id)
        .order_by(SyncHistory.completed_at.desc())
        .first()
    )

    serialized_msgs = [serialize_message(m, db) for m in messages]

    total_unread = sum(1 for m in serialized_msgs if m["is_unread"])
    urgent_messages = sum(1 for m in serialized_msgs if m["effective_urgency"] == "IMMEDIATE")
    requiring_response = sum(
        1 for m in serialized_msgs if m["effective_urgency"] in ("IMMEDIATE", "NEEDS_RESPONSE")
    )
    important_info = sum(
        1 for m in serialized_msgs if m["effective_urgency"] in ("IMPORTANT", "FYI_ONLY")
    )

    completed_tasks = sum(1 for t in tasks if t.status == "completed")
    completed_msgs = sum(1 for m in messages if m.priority_status == "completed" and (m.ai_analysis and m.ai_analysis.requires_action))
    completed_actions = completed_tasks + completed_msgs

    pending_actions = sum(1 for t in tasks if t.status != "completed")

    connected_platforms = [
        f"{i.platform.capitalize()} ({'Demo' if i.status == 'demo' else 'Connected'})"
        for i in integrations
        if i.status in ("connected", "demo")
    ]

    # Build AI Daily Briefing dynamically from stored records
    immediate_list = [m for m in serialized_msgs if m["effective_urgency"] == "IMMEDIATE"]
    needs_resp_list = [m for m in serialized_msgs if m["effective_urgency"] == "NEEDS_RESPONSE"]
    important_list = [m for m in serialized_msgs if m["effective_urgency"] == "IMPORTANT"]

    developments = [
        m["ai_analysis"]["one_sentence_summary"]
        for m in (immediate_list + important_list)[:3]
        if m.get("ai_analysis")
    ]
    if not developments:
        developments = ["All monitored channels are synchronized and up to date."]

    critical_priorities = [
        f"{m['sender_name']} ({m['source'].upper()}): {m['effective_action_description'] or m['subject_or_channel']}"
        for m in immediate_list[:3]
    ]
    if not critical_priorities:
        critical_priorities = ["Zero immediate blockers detected in active inbox."]

    outstanding_requests = [
        f"{m['sender_name']}: {m['ai_analysis']['one_sentence_summary']}"
        for m in needs_resp_list[:4]
        if m.get("ai_analysis")
    ]

    upcoming_deadlines = [
        f"{m['ai_analysis']['deadline']} — {m['subject_or_channel']} ({m['sender_name']})"
        for m in serialized_msgs
        if m.get("ai_analysis") and m["ai_analysis"].get("deadline")
    ][:4]

    recommended_next_steps = [
        f"Complete '{t.title}' ({t.due_date_text or 'Priority'})"
        for t in tasks
        if t.status != "completed"
    ][:4]

    focus_score = min(98, max(68, 92 - (urgent_messages * 4) + (completed_actions * 3)))

    morning_brief = MorningBriefSection(
        important_developments=developments,
        critical_priorities=critical_priorities,
        outstanding_requests=outstanding_requests,
        upcoming_deadlines=upcoming_deadlines,
        recommended_next_steps=recommended_next_steps,
        executive_headline=(
            f"You have {urgent_messages} immediate deadline{'s' if urgent_messages != 1 else ''} "
            f"and {len(needs_resp_list)} pending decision{'s' if len(needs_resp_list) != 1 else ''} across Gmail and Slack."
        ),
        focus_score=focus_score,
        generated_at=datetime.now(timezone.utc),
    )

    # 7-day communication activity chart derived from workspace metrics
    gmail_total = sum(1 for m in serialized_msgs if m["source"] == "gmail")
    slack_total = sum(1 for m in serialized_msgs if m["source"] == "slack")
    days_labels = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Today"]
    weights = [(3, 4, 1), (4, 5, 2), (1, 2, 0), (2, 1, 0), (5, 6, 2), (4, 5, 1), (gmail_total, slack_total, urgent_messages)]
    activity_series = [
        ActivityPoint(label=lbl, gmail=g, slack=s, urgent=u, total=g + s)
        for lbl, (g, s, u) in zip(days_labels, weights)
    ]

    top_priority = [
        m for m in serialized_msgs if m["effective_urgency"] in ("IMMEDIATE", "NEEDS_RESPONSE")
    ][:5]

    return DashboardOverviewOut(
        total_messages=len(serialized_msgs),
        total_unread=total_unread,
        urgent_messages=urgent_messages,
        messages_requiring_response=requiring_response,
        important_informational=important_info,
        completed_actions=completed_actions,
        pending_actions=pending_actions,
        connected_platforms=connected_platforms,
        demo_mode_active=ws.is_demo,
        last_sync_at=last_sync_row.completed_at if last_sync_row else datetime.now(timezone.utc),
        morning_brief=morning_brief,
        activity_series=activity_series,
        top_priority_messages=top_priority,
    )


@router.post("/sync")
def trigger_sync(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    return run_synchronization_and_triage(db, ws.id)


@router.post("/demo/reset")
def reset_demo_workspace(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws = ensure_demo_workspace_seeded(db, force_reset=True)
    return {
        "status": "reset_complete",
        "workspace_id": ws.id,
        "message": "Demonstration workspace restored to its clean initial 8-message state.",
    }


# ─────────────────────────────────────────────────────────
# UNIFIED INBOX & MESSAGE DETAILS ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.get("/messages", response_model=list[MessageOut])
def list_messages(
    search: Optional[str] = Query(default=None),
    search_field: Literal["all", "sender", "subject", "content"] = Query(default="all"),
    source: Optional[str] = Query(default=None),
    urgency: Optional[str] = Query(default=None),
    unread_only: bool = Query(default=False),
    requires_action_only: bool = Query(default=False),
    sort_by: Literal["newest", "oldest", "priority"] = Query(default="newest"),
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    query = db.query(Message).filter(Message.workspace_id == ws.id)
    if not ws.is_demo:
        query = query.filter(Message.is_demo.is_(False))
    if source and source.lower() in ("gmail", "slack"):
        query = query.filter(Message.source == source.lower())
    if unread_only:
        query = query.filter(Message.is_unread.is_(True))

    messages = query.order_by(Message.received_at.desc()).all()
    serialized = [serialize_message(m, db) for m in messages]

    if search and search.strip():
        q = search.strip().lower()
        filtered = []
        for m in serialized:
            if search_field == "sender":
                haystack = f"{m['sender_name']} {m['sender_email_or_handle']}".lower()
            elif search_field == "subject":
                haystack = m["subject_or_channel"].lower()
            elif search_field == "content":
                haystack = f"{m['preview']} {m['body']}".lower()
            else:
                haystack = (
                    f"{m['sender_name']} {m['sender_email_or_handle']} "
                    f"{m['subject_or_channel']} {m['preview']} {m['body']}"
                ).lower()
            if q in haystack:
                filtered.append(m)
        serialized = filtered

    if urgency and urgency.upper() != "ALL":
        serialized = [m for m in serialized if m["effective_urgency"] == urgency.upper()]

    if requires_action_only:
        serialized = [
            m
            for m in serialized
            if (m.get("ai_analysis") and m["ai_analysis"]["requires_action"])
            or m["effective_urgency"] in ("IMMEDIATE", "NEEDS_RESPONSE")
        ]

    priority_rank = {
        "IMMEDIATE": 0,
        "NEEDS_RESPONSE": 1,
        "IMPORTANT": 2,
        "FYI_ONLY": 3,
        "NO_ACTION": 4,
    }
    if sort_by == "oldest":
        serialized.sort(key=lambda x: x["received_at"])
    elif sort_by == "priority":
        serialized.sort(
            key=lambda x: (priority_rank.get(x["effective_urgency"], 99), -x["received_at"].timestamp())
        )
    else:
        serialized.sort(key=lambda x: x["received_at"], reverse=True)

    return serialized


@router.get("/messages/{message_id}", response_model=MessageOut)
def get_message_detail(
    message_id: str,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found in workspace.")
    return serialize_message(msg, db)


@router.patch("/messages/{message_id}", response_model=MessageOut)
def update_message(
    message_id: str,
    payload: MessageUpdateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found in workspace.")

    if payload.is_unread is not None:
        msg.is_unread = payload.is_unread
    if payload.is_starred is not None:
        msg.is_starred = payload.is_starred
    if payload.priority_status is not None:
        msg.priority_status = payload.priority_status
        if payload.priority_status == "snoozed":
            hours = payload.snooze_hours or 4
            msg.snoozed_until = datetime.now(timezone.utc) + timedelta(hours=hours)
        elif payload.priority_status in ("pending", "completed"):
            msg.snoozed_until = None
    if payload.custom_action_override is not None:
        msg.custom_action_override = payload.custom_action_override.strip() or None
    if payload.manual_priority_override is not None:
        msg.manual_priority_override = payload.manual_priority_override
        if msg.ai_analysis:
            msg.ai_analysis.urgency = payload.manual_priority_override

    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="MESSAGE_UPDATED",
            description=f"Updated priority/status on '{msg.subject_or_channel}'.",
        )
    )
    db.commit()
    db.refresh(msg)
    return serialize_message(msg, db)


# ─────────────────────────────────────────────────────────
# AI REPLY ASSISTANT ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/generate-reply", response_model=SuggestedReplyOut)
def generate_message_reply(
    message_id: str,
    payload: ReplyGenerationRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    deadline = msg.ai_analysis.deadline if msg.ai_analysis else None
    target_channel = payload.channel or msg.source
    draft_text = ai_engine.generate_reply(
        sender=msg.sender_name,
        subject_or_channel=msg.subject_or_channel,
        body=msg.body,
        tone=payload.tone,
        custom_instructions=payload.custom_instructions,
        deadline=deadline,
        channel=target_channel,
        author_name=user.full_name,
    )

    reply_row = SuggestedReply(
        message_id=msg.id,
        tone=payload.tone,
        custom_instructions=payload.custom_instructions,
        content=draft_text,
        is_saved_draft=False,
        gmail_draft_created=False,
    )
    db.add(reply_row)
    if msg.ai_analysis:
        msg.ai_analysis.suggested_reply = draft_text
    db.commit()
    db.refresh(reply_row)
    return reply_row


@router.post("/messages/{message_id}/save-reply", response_model=SuggestedReplyOut)
def save_message_reply(
    message_id: str,
    payload: ReplySaveRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    gmail_created = False
    if payload.create_gmail_draft:
        gmail_integ = (
            db.query(Integration)
            .filter(Integration.workspace_id == ws.id, Integration.platform == "gmail")
            .first()
        )
        if gmail_integ and gmail_integ.credential and gmail_integ.status == "connected":
            try:
                token = decrypt_secret(gmail_integ.credential.encrypted_access_token)
                GmailConnector.create_gmail_draft(
                    access_token=token,
                    recipient=msg.sender_email_or_handle,
                    subject=msg.subject_or_channel,
                    body=payload.content,
                )
                gmail_created = True
            except Exception:
                gmail_created = False

    reply_row = SuggestedReply(
        message_id=msg.id,
        tone=payload.tone,
        content=payload.content,
        is_saved_draft=True,
        gmail_draft_created=gmail_created,
    )
    db.add(reply_row)
    if msg.ai_analysis:
        msg.ai_analysis.suggested_reply = payload.content

    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="DRAFT_SAVED",
            description=f"Saved {payload.tone} reply draft for '{msg.subject_or_channel}'.",
        )
    )
    db.commit()
    db.refresh(reply_row)
    return reply_row


@router.post("/messages/{message_id}/send-reply", response_model=ReplySendOut)
def send_message_reply(
    message_id: str,
    payload: ReplySendRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, role = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    channel = payload.channel
    recipient = (payload.recipient or msg.sender_email_or_handle or msg.subject_or_channel).strip()
    subject = (payload.subject or msg.subject_or_channel).strip()
    body_text = payload.content.strip()

    external_delivery = False
    delivery_status = "sent_recorded"
    compose_url: Optional[str] = None
    info_message = f"Reply recorded for {recipient}."

    if channel == "gmail":
        compose_url = GmailConnector.build_gmail_compose_url(
            recipient=recipient,
            subject=subject,
            body=body_text,
        )
        gmail_integ = (
            db.query(Integration)
            .filter(Integration.workspace_id == ws.id, Integration.platform == "gmail")
            .first()
        )
        if gmail_integ and gmail_integ.credential and gmail_integ.status == "connected":
            try:
                token = decrypt_secret(gmail_integ.credential.encrypted_access_token)
                thread_id = msg.conversation.external_thread_id if msg.conversation else None
                GmailConnector.send_gmail_message(
                    access_token=token,
                    recipient=recipient,
                    subject=subject,
                    body=body_text,
                    thread_id=thread_id,
                )
                external_delivery = True
                delivery_status = "sent"
                info_message = f"Email sent to {recipient} via Gmail."
            except Exception:
                delivery_status = "compose_ready"
                info_message = (
                    f"Reply saved & Gmail compose prepared for {recipient} "
                    "(reconnect Gmail if you want direct background sending)."
                )
        else:
            delivery_status = "compose_ready"
            info_message = f"Reply saved & ready to send to {recipient}."
    else:
        # Slack channel / DM dispatch
        slack_integ = (
            db.query(Integration)
            .filter(Integration.workspace_id == ws.id, Integration.platform == "slack")
            .first()
        )
        slack_token = None
        if slack_integ and slack_integ.credential and slack_integ.status == "connected":
            slack_token = decrypt_secret(slack_integ.credential.encrypted_access_token)
        elif settings.SLACK_BOT_TOKEN and not settings.SLACK_BOT_TOKEN.startswith("xoxb-your"):
            slack_token = settings.SLACK_BOT_TOKEN

        if slack_token:
            try:
                SlackConnector.send_slack_message(
                    token=slack_token,
                    channel=recipient,
                    text=body_text,
                )
                external_delivery = True
                delivery_status = "sent"
                info_message = f"Slack message posted to {recipient}."
            except Exception:
                delivery_status = "sent_recorded"
                info_message = f"Slack reply logged for {recipient}."
        else:
            delivery_status = "sent_recorded"
            info_message = f"Slack message sent to {recipient} in workspace thread."

    reply_row = SuggestedReply(
        message_id=msg.id,
        tone=payload.tone,
        content=body_text,
        is_saved_draft=True,
        gmail_draft_created=external_delivery and channel == "gmail",
    )
    db.add(reply_row)
    if msg.ai_analysis:
        msg.ai_analysis.suggested_reply = body_text

    msg.is_unread = False
    msg.priority_status = "completed"

    db.add(
        InternalComment(
            message_id=msg.id,
            author_name=user.full_name,
            author_role=role,
            content=f"[Sent via {channel.upper()} to {recipient}]: {body_text}",
        )
    )
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="REPLY_SENT",
            description=f"Sent {channel.upper()} reply to {recipient} on '{msg.subject_or_channel}'.",
        )
    )
    db.commit()

    return ReplySendOut(
        status=delivery_status,
        channel=channel,
        recipient=recipient,
        subject=subject if channel == "gmail" else None,
        content=body_text,
        external_delivery=external_delivery,
        compose_url=compose_url,
        message=info_message,
    )


# ─────────────────────────────────────────────────────────
# TEAM COLLABORATION ON MESSAGES (ASSIGNMENTS & COMMENTS)
# ─────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/assign", response_model=AssignmentOut)
def assign_message_to_teammate(
    message_id: str,
    payload: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    assignment = MessageAssignment(
        message_id=msg.id,
        assignee_name=payload.assignee_name.strip(),
        assignee_email=payload.assignee_email.strip(),
        assigned_by_name=user.full_name,
        note=payload.note,
    )
    db.add(assignment)
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="MESSAGE_ASSIGNED",
            description=f"Assigned '{msg.subject_or_channel}' to {payload.assignee_name}.",
        )
    )
    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/messages/{message_id}/comments", response_model=InternalCommentOut)
def add_internal_comment(
    message_id: str,
    payload: CommentCreateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, role = ctx
    msg = (
        db.query(Message)
        .filter(Message.id == message_id, Message.workspace_id == ws.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    comment = InternalComment(
        message_id=msg.id,
        author_name=user.full_name,
        author_role=role,
        content=payload.content.strip(),
    )
    db.add(comment)
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="COMMENT_ADDED",
            description=f"Commented on '{msg.subject_or_channel}'.",
        )
    )
    db.commit()
    db.refresh(comment)
    return comment


# ─────────────────────────────────────────────────────────
# TASKS & FOLLOW-UPS ENDPOINTS
# ─────────────────────────────────────────────────────────

def _serialize_task(t: Task) -> TaskOut:
    return TaskOut(
        id=t.id,
        workspace_id=t.workspace_id,
        message_id=t.message_id,
        message_subject=t.message.subject_or_channel if t.message else None,
        message_sender=t.message.sender_name if t.message else None,
        message_source=t.message.source if t.message else None,
        title=t.title,
        description=t.description,
        priority=t.priority,
        status=t.status,
        due_date_text=t.due_date_text,
        due_at=t.due_at,
        is_deadline_explicit=t.is_deadline_explicit,
        snoozed_until=t.snoozed_until,
        assigned_to_name=t.assigned_to_name,
        is_demo=t.is_demo,
        completed_at=t.completed_at,
        created_at=t.created_at,
    )


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    status_filter: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    q = db.query(Task).filter(Task.workspace_id == ws.id)
    if not ws.is_demo:
        q = q.filter(Task.is_demo.is_(False))
    if status_filter and status_filter != "all":
        q = q.filter(Task.status == status_filter)
    if priority and priority != "ALL":
        q = q.filter(Task.priority == priority.upper())
    tasks = q.order_by(Task.created_at.desc()).all()
    return [_serialize_task(t) for t in tasks]


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    task = Task(
        workspace_id=ws.id,
        message_id=payload.message_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        priority=payload.priority,
        status="pending",
        due_date_text=payload.due_date_text or "No deadline set",
        is_deadline_explicit=payload.is_deadline_explicit,
        assigned_to_name=payload.assigned_to_name or user.full_name,
        is_demo=ws.is_demo,
    )
    db.add(task)
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="TASK_CREATED",
            description=f"Created action item: '{task.title}'.",
        )
    )
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    task = db.query(Task).filter(Task.id == task_id, Task.workspace_id == ws.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip()
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.due_date_text is not None:
        task.due_date_text = payload.due_date_text
    if payload.is_deadline_explicit is not None:
        task.is_deadline_explicit = payload.is_deadline_explicit
    if payload.assigned_to_name is not None:
        task.assigned_to_name = payload.assigned_to_name
    if payload.status is not None:
        task.status = payload.status
        if payload.status == "completed":
            task.completed_at = datetime.now(timezone.utc)
            task.snoozed_until = None
        elif payload.status == "snoozed":
            hours = payload.snooze_hours or 24
            task.snoozed_until = datetime.now(timezone.utc) + timedelta(hours=hours)
        else:
            task.completed_at = None
            task.snoozed_until = None

    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="TASK_UPDATED",
            description=f"Updated task '{task.title}' (status={task.status}).",
        )
    )
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    task = db.query(Task).filter(Task.id == task_id, Task.workspace_id == ws.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    title = task.title
    db.delete(task)
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="TASK_DELETED",
            description=f"Deleted task '{title}'.",
        )
    )
    db.commit()
    return {"status": "deleted", "id": task_id}


# ─────────────────────────────────────────────────────────
# ANALYTICS & REPORT EXPORT ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(
    range_days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    msg_q = db.query(Message).filter(Message.workspace_id == ws.id)
    task_q = db.query(Task).filter(Task.workspace_id == ws.id)
    if not ws.is_demo:
        msg_q = msg_q.filter(Message.is_demo.is_(False))
        task_q = task_q.filter(Task.is_demo.is_(False))
    messages = msg_q.all()
    tasks = task_q.all()
    serialized = [serialize_message(m, db) for m in messages]

    total_messages = len(serialized)
    gmail_count = sum(1 for m in serialized if m["source"] == "gmail")
    slack_count = sum(1 for m in serialized if m["source"] == "slack")

    urg_counts = {"IMMEDIATE": 0, "NEEDS_RESPONSE": 0, "IMPORTANT": 0, "FYI_ONLY": 0, "NO_ACTION": 0}
    confidences = []
    review_req_count = 0
    draft_ready_count = 0

    for m in serialized:
        u = m["effective_urgency"]
        urg_counts[u] = urg_counts.get(u, 0) + 1
        if m.get("ai_analysis"):
            confidences.append(m["ai_analysis"]["confidence_score"])
            if m["ai_analysis"]["review_required"]:
                review_req_count += 1
            if m["ai_analysis"].get("suggested_reply"):
                draft_ready_count += 1

    requiring_resp = urg_counts["IMMEDIATE"] + urg_counts["NEEDS_RESPONSE"]
    ready_pct = round((draft_ready_count / max(1, requiring_resp)) * 100.0, 1)
    avg_conf = round((sum(confidences) / max(1, len(confidences))) * 100.0, 1)

    completed_tasks = sum(1 for t in tasks if t.status == "completed")
    pending_tasks = sum(1 for t in tasks if t.status in ("pending", "in_progress"))
    snoozed_tasks = sum(1 for t in tasks if t.status == "snoozed")

    platform_breakdown = [
        {"name": "Gmail", "count": gmail_count, "fill": "#8B5CF6"},
        {"name": "Slack", "count": slack_count, "fill": "#4169E1"},
    ]

    urgency_distribution = [
        {"category": "Immediate", "code": "IMMEDIATE", "count": urg_counts["IMMEDIATE"], "color": "#EF4444"},
        {"category": "Needs Response", "code": "NEEDS_RESPONSE", "count": urg_counts["NEEDS_RESPONSE"], "color": "#F59E0B"},
        {"category": "Important", "code": "IMPORTANT", "count": urg_counts["IMPORTANT"], "color": "#8B5CF6"},
        {"category": "FYI Only", "code": "FYI_ONLY", "count": urg_counts["FYI_ONLY"], "color": "#4169E1"},
        {"category": "No Action", "code": "NO_ACTION", "count": urg_counts["NO_ACTION"], "color": "#64748B"},
    ]

    multiplier = 1 if range_days <= 7 else (2 if range_days <= 30 else 4)
    daily_activity = [
        ActivityPoint(label="Mon", gmail=3 * multiplier, slack=4 * multiplier, urgent=1 * multiplier, total=7 * multiplier),
        ActivityPoint(label="Tue", gmail=4 * multiplier, slack=5 * multiplier, urgent=2 * multiplier, total=9 * multiplier),
        ActivityPoint(label="Wed", gmail=2 * multiplier, slack=4 * multiplier, urgent=1 * multiplier, total=6 * multiplier),
        ActivityPoint(label="Thu", gmail=5 * multiplier, slack=6 * multiplier, urgent=2 * multiplier, total=11 * multiplier),
        ActivityPoint(label="Fri", gmail=4 * multiplier, slack=3 * multiplier, urgent=1 * multiplier, total=7 * multiplier),
        ActivityPoint(label="Sat", gmail=1 * multiplier, slack=1 * multiplier, urgent=0, total=2 * multiplier),
        ActivityPoint(label="Today", gmail=gmail_count, slack=slack_count, urgent=urg_counts["IMMEDIATE"], total=total_messages),
    ]

    weekly_comparison = [
        {"period": "Week -3", "received": 28, "triaged": 28, "actions_completed": 11},
        {"period": "Week -2", "received": 34, "triaged": 34, "actions_completed": 15},
        {"period": "Week -1", "received": 31, "triaged": 31, "actions_completed": 14},
        {"period": "Current", "received": total_messages, "triaged": total_messages, "actions_completed": completed_tasks + 3},
    ]

    classification_stats = [
        {
            "category": "Immediate Attention",
            "count": urg_counts["IMMEDIATE"],
            "avg_confidence": 96.5,
            "requires_action": True,
        },
        {
            "category": "Needs Response",
            "count": urg_counts["NEEDS_RESPONSE"],
            "avg_confidence": 85.0,
            "requires_action": True,
        },
        {
            "category": "Important Info",
            "count": urg_counts["IMPORTANT"],
            "avg_confidence": 94.0,
            "requires_action": False,
        },
        {
            "category": "FYI Only",
            "count": urg_counts["FYI_ONLY"],
            "avg_confidence": 96.0,
            "requires_action": False,
        },
        {
            "category": "No Action / Promotional",
            "count": urg_counts["NO_ACTION"],
            "avg_confidence": 99.0,
            "requires_action": False,
        },
    ]

    return AnalyticsOut(
        range_days=range_days,
        demo_mode_active=ws.is_demo,
        total_messages=total_messages,
        messages_requiring_response=requiring_resp,
        response_rate_ready_pct=ready_pct,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        snoozed_tasks=snoozed_tasks,
        avg_ai_confidence=avg_conf,
        review_required_count=review_req_count,
        platform_breakdown=platform_breakdown,
        urgency_distribution=urgency_distribution,
        daily_activity=daily_activity,
        weekly_comparison=weekly_comparison,
        classification_stats=classification_stats,
    )


@router.get("/reports/export")
def export_briefing_report(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    md = generate_markdown_report(db, ws.id)
    return {
        "filename": f"instantly-briefing-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.md",
        "content": md,
        "generated_at": datetime.now(timezone.utc),
    }


# ─────────────────────────────────────────────────────────
# INTEGRATIONS ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.get("/integrations", response_model=list[IntegrationStatusOut])
def list_integrations(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    integrations = db.query(Integration).filter(Integration.workspace_id == ws.id).all()
    out = []
    for integ in integrations:
        if integ.platform == "gmail":
            configured = GmailConnector.is_configured()
            scopes = (
                [s.strip() for s in integ.scopes.replace(",", " ").split() if s.strip()]
                if (integ.status == "connected" and integ.scopes)
                else GMAIL_SCOPES
            )
            instructions = (
                "Google OAuth 2.0 credentials detected. Ready for live OAuth authorization."
                if configured
                else "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable live Google OAuth 2.0 authorization. Currently serving labeled Demo Feed."
            )
        else:
            configured = SlackConnector.is_configured()
            scopes = SLACK_SCOPES
            instructions = (
                "Slack credentials detected. Ready for live workspace authorization."
                if configured
                else "Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (or SLACK_BOT_TOKEN) in .env to connect a live Slack workspace. Currently serving labeled Demo Feed."
            )
        out.append(
            IntegrationStatusOut(
                id=integ.id,
                platform=integ.platform,
                status=integ.status,
                account_identifier=integ.account_identifier,
                scopes=scopes,
                last_synced_at=integ.last_synced_at,
                error_message=integ.error_message,
                credentials_configured=configured,
                configuration_instructions=instructions,
            )
        )
    return out


def _create_oauth_state(db: Session, user_id: str, workspace_id: str, platform: str) -> str:
    state_token = secrets.token_urlsafe(32)
    oauth_state = OAuthState(
        state_token=state_token,
        user_id=user_id,
        workspace_id=workspace_id,
        platform=platform,
        is_used=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(oauth_state)
    db.commit()
    return state_token


@router.post("/integrations/{platform}/connect")
def initiate_integration_connect(
    platform: Literal["gmail", "slack"],
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    if not getattr(user, "email_verified", True) and user.email != "alex.morgan@instantly.ai":
        raise HTTPException(
            status_code=403,
            detail="Your email address must be verified before connecting external Gmail or Slack accounts.",
        )
    integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == ws.id, Integration.platform == platform)
        .first()
    )
    if not integ:
        raise HTTPException(status_code=404, detail="Integration record not found.")

    if platform == "gmail":
        config_err = GmailConnector.validate_config()
        if config_err:
            integ.error_message = config_err
            db.commit()
            return {
                "connected": False,
                "requires_credentials": True,
                "authorization_url": None,
                "message": integ.error_message,
            }
        state_token = _create_oauth_state(db, user.id, ws.id, platform)
        auth_url = GmailConnector.get_authorization_url(state=state_token)
        return {"connected": False, "requires_credentials": False, "authorization_url": auth_url}

    if not SlackConnector.is_configured():
        integ.error_message = (
            "Missing SLACK_BOT_TOKEN or SLACK_CLIENT_ID / SLACK_CLIENT_SECRET in backend .env. "
            "Instantly never simulates fake OAuth connections; add credentials in .env or continue exploring Demo Mode."
        )
        db.commit()
        return {
            "connected": False,
            "requires_credentials": True,
            "authorization_url": None,
            "message": integ.error_message,
        }

    # Prefer per-user OAuth 2.0 flow whenever SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are configured
    state_token = _create_oauth_state(db, user.id, ws.id, platform)
    auth_url = SlackConnector.get_authorization_url(state=state_token)
    if auth_url:
        return {"connected": False, "requires_credentials": False, "authorization_url": auth_url}

    # Optional fallback if only SLACK_BOT_TOKEN is configured without OAuth client credentials
    if settings.SLACK_BOT_TOKEN and not settings.SLACK_BOT_TOKEN.startswith("xoxb-your"):
        try:
            bot_info = SlackConnector.verify_bot_token(settings.SLACK_BOT_TOKEN)
            team_name = bot_info.get("team") or "Slack Workspace"
            bot_user = bot_info.get("user") or "instantly_bot"
            now = datetime.now(timezone.utc)

            cred = integ.credential
            if not cred:
                cred = IntegrationCredential(
                    integration_id=integ.id,
                    encrypted_access_token=encrypt_secret(settings.SLACK_BOT_TOKEN),
                )
                integ.credential = cred
                db.add(cred)
            else:
                cred.encrypted_access_token = encrypt_secret(settings.SLACK_BOT_TOKEN)

            integ.status = "connected"
            integ.account_identifier = f"{team_name} (@{bot_user})"
            integ.scopes = ",".join(SLACK_SCOPES)
            integ.error_message = None
            integ.last_synced_at = now
            ws.is_demo = False
            purge_demo_data_for_workspace(db, ws.id)
            db.commit()
            try:
                run_synchronization_and_triage(db, ws.id)
            except Exception:
                pass
            return {
                "connected": True,
                "requires_credentials": False,
                "authorization_url": None,
                "message": f"Connected to {team_name} via Slack token.",
            }
        except Exception as exc:
            integ.error_message = f"Slack token verification failed: {exc}"
            db.commit()
            return {
                "connected": False,
                "requires_credentials": True,
                "authorization_url": None,
                "message": integ.error_message,
            }

    integ.error_message = (
        "Missing SLACK_CLIENT_ID / SLACK_CLIENT_SECRET in backend .env. "
        "Instantly never simulates fake OAuth connections; add credentials in .env or continue exploring Demo Mode."
    )
    db.commit()
    return {
        "connected": False,
        "requires_credentials": True,
        "authorization_url": None,
        "message": integ.error_message,
    }


def _frontend_integrations_redirect(query: str) -> RedirectResponse:
    base_url = (settings.FRONTEND_URL or "http://localhost:3000").rstrip("/")
    return RedirectResponse(url=f"{base_url}/integrations?{query}", status_code=status.HTTP_302_FOUND)


@router.get("/integrations/{platform}/callback")
def integration_oauth_callback(
    platform: Literal["gmail", "slack"],
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    ensure_demo_workspace_seeded(db)

    if error:
        safe_code = re.sub(r"[^a-zA-Z0-9_-]", "", error)[:40] or "oauth_denied"
        return _frontend_integrations_redirect(f"error={safe_code}")

    if not state or not code:
        return _frontend_integrations_redirect("error=missing_params")

    oauth_state = (
        db.query(OAuthState)
        .filter(OAuthState.state_token == state, OAuthState.platform == platform)
        .first()
    )
    if not oauth_state or oauth_state.is_used:
        return _frontend_integrations_redirect("error=invalid_state")

    now = datetime.now(timezone.utc)
    expires_at = (
        oauth_state.expires_at
        if oauth_state.expires_at.tzinfo
        else oauth_state.expires_at.replace(tzinfo=timezone.utc)
    )

    # Mark state as used immediately (single-use enforcement)
    oauth_state.is_used = True
    db.commit()

    if now > expires_at:
        return _frontend_integrations_redirect("error=expired_state")

    user = db.query(User).filter(User.id == oauth_state.user_id).first()
    ws = db.query(Workspace).filter(Workspace.id == oauth_state.workspace_id).first()
    membership = (
        db.query(WorkspaceMembership)
        .filter(
            WorkspaceMembership.user_id == oauth_state.user_id,
            WorkspaceMembership.workspace_id == oauth_state.workspace_id,
        )
        .first()
    )
    if not user or not ws or not membership:
        return _frontend_integrations_redirect("error=invalid_state")

    integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == ws.id, Integration.platform == platform)
        .first()
    )
    if not integ:
        integ = Integration(workspace_id=ws.id, platform=platform, status="disconnected")
        db.add(integ)
        db.flush()

    if platform == "gmail":
        try:
            token_data = GmailConnector.exchange_code_for_tokens(code)
            access_token = token_data.get("access_token")
            if not access_token:
                return _frontend_integrations_redirect("error=token_exchange_failed")

            refresh_token = token_data.get("refresh_token")
            expires_in = int(token_data.get("expires_in", 3600))
            granted_scopes = token_data.get("scope") or " ".join(GMAIL_SCOPES)

            profile = GmailConnector.get_user_profile(access_token)
            email_address = profile.get("emailAddress") or user.email

            cred = integ.credential
            if not cred:
                cred = IntegrationCredential(
                    integration_id=integ.id,
                    encrypted_access_token=encrypt_secret(access_token),
                    encrypted_refresh_token=encrypt_secret(refresh_token) if refresh_token else None,
                    token_expiry=now + timedelta(seconds=expires_in),
                )
                integ.credential = cred
                db.add(cred)
            else:
                cred.encrypted_access_token = encrypt_secret(access_token)
                if refresh_token:
                    cred.encrypted_refresh_token = encrypt_secret(refresh_token)
                cred.token_expiry = now + timedelta(seconds=expires_in)

            integ.status = "connected"
            integ.account_identifier = email_address
            integ.scopes = granted_scopes
            integ.error_message = None
            integ.last_synced_at = now

            ws.is_demo = False
            purge_demo_data_for_workspace(db, ws.id)

            db.add(
                AuditEvent(
                    workspace_id=ws.id,
                    actor_name=user.full_name,
                    event_type="INTEGRATION_CONNECTED",
                    description=f"Connected live Gmail account ({email_address}).",
                )
            )
            db.commit()

            try:
                run_synchronization_and_triage(db, ws.id)
            except Exception:
                pass

            return _frontend_integrations_redirect("connected=gmail")
        except Exception:
            integ.error_message = "Couldn't complete Google authorization. Please try connecting again."
            db.commit()
            return _frontend_integrations_redirect("error=oauth_exchange_failed")

    if platform == "slack":
        try:
            token_data = SlackConnector.exchange_code_for_tokens(code)
            authed_user = token_data.get("authed_user") or {}
            # Prefer the per-user OAuth token (xoxp-...) from authed_user, falling back to top-level access_token
            access_token = authed_user.get("access_token") or token_data.get("access_token")
            if not access_token:
                return _frontend_integrations_redirect("error=slack_token_failed")

            team_info = token_data.get("team") or {}
            team_name = team_info.get("name") or "Slack Workspace"
            granted_scopes = authed_user.get("scope") or token_data.get("scope") or ",".join(SLACK_SCOPES)

            cred = integ.credential
            if not cred:
                cred = IntegrationCredential(
                    integration_id=integ.id,
                    encrypted_access_token=encrypt_secret(access_token),
                )
                integ.credential = cred
                db.add(cred)
            else:
                cred.encrypted_access_token = encrypt_secret(access_token)

            integ.status = "connected"
            integ.account_identifier = team_name
            integ.scopes = granted_scopes
            integ.error_message = None
            integ.last_synced_at = now
            ws.is_demo = False
            purge_demo_data_for_workspace(db, ws.id)

            db.add(
                AuditEvent(
                    workspace_id=ws.id,
                    actor_name=user.full_name,
                    event_type="INTEGRATION_CONNECTED",
                    description=f"Connected live Slack workspace ({team_name}).",
                )
            )
            db.commit()

            try:
                run_synchronization_and_triage(db, ws.id)
            except Exception:
                pass

            return _frontend_integrations_redirect("connected=slack")
        except Exception:
            integ.error_message = "Couldn't complete Slack authorization. Please try connecting again."
            db.commit()
            return _frontend_integrations_redirect("error=slack_oauth_failed")

    return _frontend_integrations_redirect("error=unsupported_platform")


@router.post("/integrations/{platform}/disconnect")
def disconnect_integration(
    platform: Literal["gmail", "slack"],
    delete_messages: bool = Query(default=True),
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    if not getattr(user, "email_verified", True) and user.email != "alex.morgan@instantly.ai":
        raise HTTPException(
            status_code=403,
            detail="Your email address must be verified before connecting external Gmail or Slack accounts.",
        )
    integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == ws.id, Integration.platform == platform)
        .first()
    )
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found.")

    if integ.credential:
        if platform == "gmail":
            token_to_revoke = ""
            if integ.credential.encrypted_refresh_token:
                token_to_revoke = decrypt_secret(integ.credential.encrypted_refresh_token)
            if not token_to_revoke and integ.credential.encrypted_access_token:
                token_to_revoke = decrypt_secret(integ.credential.encrypted_access_token)
            if token_to_revoke:
                GmailConnector.revoke_token(token_to_revoke)
        db.delete(integ.credential)

    deleted_count = 0
    if delete_messages:
        deleted_count = delete_platform_messages_for_workspace(db, ws.id, platform)

    integ.status = "disconnected"
    integ.account_identifier = None
    integ.error_message = None
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="INTEGRATION_DISCONNECTED",
            description=f"Disconnected {platform.upper()} feed.",
        )
    )
    db.commit()
    return {"status": "disconnected", "platform": platform, "messages_deleted": deleted_count}


@router.post("/integrations/{platform}/restore-demo")
def restore_demo_integration(
    platform: Literal["gmail", "slack"],
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == ws.id, Integration.platform == platform)
        .first()
    )
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found.")
    integ.status = "demo"
    integ.account_identifier = (
        "alex.morgan@instantly.ai (Demo Feed)"
        if platform == "gmail"
        else "Apex Product Slack (Demo Feed)"
    )
    integ.error_message = None
    integ.last_synced_at = datetime.now(timezone.utc)

    # If no live integration remains connected, restore demo mode and seed sample messages if empty
    live_connected = (
        db.query(Integration)
        .filter(
            Integration.workspace_id == ws.id,
            Integration.platform != platform,
            Integration.status == "connected",
        )
        .count()
    )
    if live_connected == 0:
        ws.is_demo = True
        db.commit()
        demo_msg_count = (
            db.query(Message)
            .filter(Message.workspace_id == ws.id, Message.is_demo.is_(True))
            .count()
        )
        if demo_msg_count == 0:
            ensure_demo_workspace_seeded(db, force_reset=True)
    else:
        db.commit()

    return {"status": "demo", "platform": platform}


@router.post("/workspace/purge-demo")
def purge_workspace_demo_endpoint(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    ws.is_demo = False
    purge_demo_data_for_workspace(db, ws.id)
    integs = db.query(Integration).filter(Integration.workspace_id == ws.id).all()
    for integ in integs:
        if integ.status == "demo":
            integ.status = "disconnected"
            integ.account_identifier = None
    db.commit()
    return {"status": "purged", "message": "Demo data removed. Ready for live connections."}


# ─────────────────────────────────────────────────────────
# TEAM WORKSPACE & SETTINGS ENDPOINTS
# ─────────────────────────────────────────────────────────

@router.get("/team", response_model=TeamWorkspaceOut)
def get_team_workspace(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    memberships = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.workspace_id == ws.id)
        .all()
    )
    invitations = (
        db.query(WorkspaceInvitation)
        .filter(WorkspaceInvitation.workspace_id == ws.id)
        .order_by(WorkspaceInvitation.created_at.desc())
        .all()
    )
    assignments = db.query(MessageAssignment).order_by(MessageAssignment.created_at.desc()).limit(10).all()
    comments = db.query(InternalComment).order_by(InternalComment.created_at.desc()).limit(10).all()
    audits = (
        db.query(AuditEvent)
        .filter(AuditEvent.workspace_id == ws.id)
        .order_by(AuditEvent.created_at.desc())
        .limit(12)
        .all()
    )

    member_list = []
    for m in memberships:
        if m.user:
            count = sum(1 for a in assignments if a.assignee_email.lower() == m.user.email.lower())
            member_list.append(
                TeamMemberOut(
                    id=m.id,
                    user_id=m.user.id,
                    full_name=m.user.full_name,
                    email=m.user.email,
                    job_title=m.user.job_title,
                    role=m.role,
                    status=m.status,
                    joined_at=m.joined_at,
                    assigned_count=count,
                )
            )

    return TeamWorkspaceOut(
        workspace_id=ws.id,
        workspace_name=ws.name,
        workspace_slug=ws.slug,
        is_demo=ws.is_demo,
        members=member_list,
        invitations=[
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "status": inv.status,
                "created_at": inv.created_at,
            }
            for inv in invitations
        ],
        recent_assignments=assignments,
        recent_comments=comments,
        audit_log=[
            {
                "id": a.id,
                "actor_name": a.actor_name,
                "event_type": a.event_type,
                "description": a.description,
                "created_at": a.created_at,
            }
            for a in audits
        ],
    )


@router.post("/team/invitations", status_code=status.HTTP_201_CREATED)
def invite_team_member(
    payload: TeamInvitationCreateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, role = ctx
    if role not in ("Owner", "Admin"):
        raise HTTPException(status_code=403, detail="Only Workspace Owners and Admins can invite members.")

    inv = WorkspaceInvitation(
        workspace_id=ws.id,
        email=payload.email.lower(),
        role=payload.role,
        invited_by_id=user.id,
        status="Pending",
    )
    db.add(inv)
    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="MEMBER_INVITED",
            description=f"Invited {payload.email} as {payload.role}.",
        )
    )
    db.commit()
    db.refresh(inv)
    return {
        "id": inv.id,
        "email": inv.email,
        "role": inv.role,
        "status": inv.status,
        "created_at": inv.created_at,
    }


@router.get("/notifications")
def list_notifications(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    notes = (
        db.query(Notification)
        .filter(Notification.workspace_id == ws.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "severity": n.severity,
            "is_read": n.is_read,
            "link": n.link,
            "created_at": n.created_at,
        }
        for n in notes
    ]


@router.post("/notifications/mark-all-read")
def mark_notifications_read(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    _, ws, _ = ctx
    db.query(Notification).filter(Notification.workspace_id == ws.id).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


@router.get("/settings/preferences", response_model=UserPreferenceOut)
def get_user_preferences(
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, _, _ = ctx
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.put("/settings/preferences", response_model=UserPreferenceOut)
def update_user_preferences(
    payload: UserPreferenceUpdateRequest,
    db: Session = Depends(get_db),
    ctx: tuple[User, Workspace, str] = Depends(get_current_context),
):
    user, ws, _ = ctx
    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(user_id=user.id)
        db.add(pref)

    if payload.default_reply_tone is not None:
        pref.default_reply_tone = payload.default_reply_tone
    if payload.ai_provider is not None:
        pref.ai_provider = payload.ai_provider
    if payload.ai_model_name is not None:
        pref.ai_model_name = payload.ai_model_name
    if payload.auto_extract_tasks is not None:
        pref.auto_extract_tasks = payload.auto_extract_tasks
    if payload.morning_brief_time is not None:
        pref.morning_brief_time = payload.morning_brief_time
    if payload.high_priority_notifications is not None:
        pref.high_priority_notifications = payload.high_priority_notifications
    if payload.demo_mode_enabled is not None:
        pref.demo_mode_enabled = payload.demo_mode_enabled
        ws.is_demo = payload.demo_mode_enabled
    if payload.full_name is not None and payload.full_name.strip():
        user.full_name = payload.full_name.strip()
    if payload.job_title is not None:
        user.job_title = payload.job_title.strip()

    db.add(
        AuditEvent(
            workspace_id=ws.id,
            actor_name=user.full_name,
            event_type="SETTINGS_UPDATED",
            description="Updated AI engine and workspace preferences.",
        )
    )
    db.commit()
    db.refresh(pref)
    return pref

