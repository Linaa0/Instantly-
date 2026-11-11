import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.ai.engine import ai_engine
from app.integrations.connectors import GmailConnector, SlackConnector
from app.models.entities import (
    AIAnalysis,
    AuditEvent,
    Conversation,
    Integration,
    InternalComment,
    Message,
    MessageAssignment,
    Notification,
    SuggestedReply,
    SyncHistory,
    Task,
    User,
    UserPreference,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)
from app.security.auth import decrypt_secret, encrypt_secret, get_password_hash


def get_demo_messages_catalog(now: datetime) -> list[dict]:
    return [
        {
            "external_id": "demo-msg-001",
            "thread_id": "thread-001",
            "source": "gmail",
            "sender_name": "Elena Rostova",
            "sender_email_or_handle": "elena.rostova@horizon-ventures.io",
            "subject_or_channel": "URGENT: Q4 Board Deck Revenue Bridge & Production SLA Sign-off by 2:00 PM",
            "preview": "We need your final verification on the Q4 enterprise ARR slide and production SLA metrics before 2:00 PM EST today.",
            "body": (
                "Hi Alex,\n\n"
                "We are locking the Q4 Board Deck ahead of the investor committee distribution this afternoon.\n\n"
                "Could you please submit the verified Q4 enterprise ARR bridge report and confirm the 99.98% production SLA metrics by 2:00 PM EST today?\n\n"
                "Key items needed:\n"
                "1. Final sign-off on Slide 14 (Enterprise expansion numbers).\n"
                "2. Confirmation that the multi-region failover patch deployed cleanly.\n\n"
                "This is a hard blocker for our board packet release.\n\n"
                "Best,\nElena Rostova\nVP of Finance & Strategy"
            ),
            "received_at": now - timedelta(minutes=24),
            "is_unread": True,
            "is_starred": True,
            "urgency_override": "IMMEDIATE",
            "confidence_score": 0.98,
            "one_sentence_summary": "Elena Rostova requires final verification of Q4 enterprise ARR bridge and production SLA metrics by 2:00 PM EST today.",
            "detailed_summary": (
                "VP of Finance Elena Rostova escalated a same-day blocker for the Q4 Board Deck. "
                "You must verify Slide 14's enterprise expansion figures and confirm the multi-region failover deployment status before 2:00 PM EST today."
            ),
            "classification_reason": "Explicit same-day 2:00 PM deadline with an executive board-packet release dependency.",
            "requires_action": True,
            "action_description": "Submit Q4 ARR bridge verification & SLA sign-off to Elena Rostova by 2:00 PM",
            "deadline": "Today by 2:00 PM EST",
            "deadline_is_explicit": True,
            "deadline_confidence": 0.98,
            "suggested_reply": (
                "Hi Elena,\n\nReceived and prioritized. I have verified the Slide 14 Enterprise ARR expansion numbers "
                "and confirmed with infrastructure that the multi-region failover patch is stable at 99.99% uptime. "
                "I will send the signed-off report before 1:30 PM EST.\n\nBest,\nAlex"
            ),
            "entities": ["Elena Rostova", "Q4 Board Deck", "SLA", "Slide 14"],
            "review_required": False,
            "task": {
                "title": "Submit Q4 ARR bridge & SLA sign-off for Board Deck",
                "description": "Verify Slide 14 Enterprise expansion numbers and multi-region failover uptime before 2:00 PM EST cutoff.",
                "priority": "CRITICAL",
                "due_date_text": "Today at 2:00 PM EST",
                "is_deadline_explicit": True,
                "assigned_to_name": "Alex Morgan",
            },
        },
        {
            "external_id": "demo-msg-002",
            "thread_id": "thread-002",
            "source": "slack",
            "sender_name": "Marcus Okoye",
            "sender_email_or_handle": "@marcus.okoye",
            "subject_or_channel": "#product-launch-ops",
            "preview": "Approval Request: Can you sign off on the Enterprise SSO security addendum and vendor agreement before Friday?",
            "body": (
                "Hey @alex — Legal and Security finished redlining the Enterprise SSO vendor addendum for Acme Global.\n\n"
                "We need your explicit approval on the updated data-retention clause and token rotation SLA by Friday at 5:00 PM so procurement can counter-sign.\n\n"
                "Let me know if you approve or if you want any changes to section 4.2."
            ),
            "received_at": now - timedelta(hours=1, minutes=15),
            "is_unread": True,
            "is_starred": True,
            "urgency_override": "NEEDS_RESPONSE",
            "confidence_score": 0.95,
            "one_sentence_summary": "Marcus Okoye requested your approval on the Acme Global Enterprise SSO security addendum by Friday at 5:00 PM.",
            "detailed_summary": (
                "Legal and Security completed redlines on the Acme Global SSO vendor agreement. "
                "Marcus needs your sign-off on Section 4.2 (data retention and token rotation SLA) so procurement can finalize signatures."
            ),
            "classification_reason": "Direct approval gate on a legal/security contract blocking enterprise customer onboarding.",
            "requires_action": True,
            "action_description": "Review Section 4.2 and approve Enterprise SSO vendor addendum for Marcus Okoye",
            "deadline": "Friday at 5:00 PM",
            "deadline_is_explicit": True,
            "deadline_confidence": 0.94,
            "suggested_reply": (
                "Hi Marcus — I reviewed Section 4.2 of the Acme Global SSO addendum. "
                "The data-retention window and 24-hour token rotation SLA align with our security posture. "
                "You have my approval to move forward with procurement."
            ),
            "entities": ["Marcus Okoye", "Acme Global", "Enterprise SSO", "Section 4.2"],
            "review_required": False,
            "task": {
                "title": "Approve Acme Global Enterprise SSO security addendum (Sec 4.2)",
                "description": "Confirm data-retention and token rotation SLA terms in #product-launch-ops.",
                "priority": "HIGH",
                "due_date_text": "Friday at 5:00 PM",
                "is_deadline_explicit": True,
                "assigned_to_name": "Alex Morgan",
            },
        },
        {
            "external_id": "demo-msg-003",
            "thread_id": "thread-003",
            "source": "gmail",
            "sender_name": "Sarah Chen",
            "sender_email_or_handle": "sarah.chen@instantly.team",
            "subject_or_channel": "Meeting Invitation: Mobile Launch Architecture & Staffing Sync (Thursday 2:00 PM)",
            "preview": "Inviting you, Marcus, and Jennie to finalize the October 15 mobile launch checklist and engineering staffing plan.",
            "body": (
                "Hi Alex,\n\n"
                "Following up on our mobile launch thread—I'd love to get everyone in a room this Thursday at 2:00 PM EST "
                "to lock the launch day checklist and finalize engineering staffing allocations.\n\n"
                "Agenda:\n"
                "- Review Launch Day Checklist & rollback runbook\n"
                "- Confirm website messaging and press outreach timeline\n"
                "- Assign on-call engineering owners\n\n"
                "Please confirm if Thursday at 2:00 PM works on your calendar."
            ),
            "received_at": now - timedelta(hours=2, minutes=40),
            "is_unread": True,
            "is_starred": False,
            "urgency_override": "NEEDS_RESPONSE",
            "confidence_score": 0.93,
            "one_sentence_summary": "Sarah Chen invited you to a Mobile Launch Architecture & Staffing Sync on Thursday at 2:00 PM EST and needs calendar confirmation.",
            "detailed_summary": (
                "Sarah Chen is coordinating the Mobile Launch sync with Marcus and Jennie to lock the launch checklist, "
                "rollback runbook, and on-call staffing. She asked you to confirm availability for Thursday at 2:00 PM EST."
            ),
            "classification_reason": "Direct scheduling confirmation request for a cross-functional launch milestone meeting.",
            "requires_action": True,
            "action_description": "Confirm attendance for Thursday 2:00 PM Mobile Launch Sync with Sarah Chen",
            "deadline": "Thursday at 2:00 PM EST",
            "deadline_is_explicit": True,
            "deadline_confidence": 0.93,
            "suggested_reply": (
                "Hi Sarah,\n\nThursday at 2:00 PM EST works well for me. I've accepted the calendar hold and will bring "
                "the updated engineering rollback runbook to the session.\n\nBest,\nAlex"
            ),
            "entities": ["Sarah Chen", "Mobile Launch", "Marcus", "Jennie"],
            "review_required": False,
            "task": {
                "title": "Confirm & prepare rollback runbook for Thursday 2 PM Mobile Launch Sync",
                "description": "Reply to Sarah Chen and review on-call staffing allocations ahead of the meeting.",
                "priority": "MEDIUM",
                "due_date_text": "Thursday at 2:00 PM EST",
                "is_deadline_explicit": True,
                "assigned_to_name": "Sarah Chen",
            },
        },
        {
            "external_id": "demo-msg-004",
            "thread_id": "thread-004",
            "source": "slack",
            "sender_name": "Devon Brooks",
            "sender_email_or_handle": "@devon.brooks",
            "subject_or_channel": "#eng-platform-core",
            "preview": "Important Team Update: v2.8 AI Inference Gateway deployed to production — latency down 38%",
            "body": (
                "Team update: We just completed the canary rollout of v2.8 AI Inference Gateway across us-east and eu-central.\n\n"
                "Key highlights:\n"
                "- P95 structured output latency dropped by 38% (from 1.42s to 0.88s)\n"
                "- Zero schema validation regressions across 14,000 test payloads\n"
                "- Automated Redis fallback queue verified under synthetic load\n\n"
                "No action needed from product leads, but please review the updated observability dashboard before Monday's sprint retro."
            ),
            "received_at": now - timedelta(hours=4, minutes=10),
            "is_unread": False,
            "is_starred": False,
            "urgency_override": "IMPORTANT",
            "confidence_score": 0.94,
            "one_sentence_summary": "Devon Brooks announced the successful production rollout of v2.8 AI Inference Gateway with a 38% P95 latency reduction.",
            "detailed_summary": (
                "Platform engineering completed the v2.8 AI Inference Gateway rollout across US and EU regions, reducing P95 latency "
                "to 0.88s with zero validation regressions. Recommended reading prior to Monday's sprint retrospective."
            ),
            "classification_reason": "Significant core infrastructure milestone affecting product performance; informational with optional pre-retro review.",
            "requires_action": False,
            "action_description": "Review v2.8 observability metrics prior to Monday sprint retro",
            "deadline": "Before Monday retro (AI-inferred)",
            "deadline_is_explicit": False,
            "deadline_confidence": 0.76,
            "suggested_reply": (
                "Awesome milestone @devon.brooks! A 38% P95 latency drop is huge—congrats to the platform team."
            ),
            "entities": ["Devon Brooks", "v2.8 AI Inference Gateway", "Redis"],
            "review_required": False,
            "task": None,
        },
        {
            "external_id": "demo-msg-005",
            "thread_id": "thread-005",
            "source": "gmail",
            "sender_name": "GreenWatch Ops",
            "sender_email_or_handle": "reports@greenwatch-analytics.com",
            "subject_or_channel": "Weekly Cloud Infrastructure Carbon & Cost Digest — Week 45",
            "preview": "Routine weekly summary of cloud compute utilization, idle cluster savings, and sustainability metrics.",
            "body": (
                "Hello Instantly Engineering,\n\n"
                "Here is your automated Week 45 cloud efficiency digest:\n"
                "- Total compute spend: $14,280 (-4.2% WoW)\n"
                "- Staging cluster auto-sleep saved 184 GPU hours\n"
                "- Carbon intensity score: 94/100 (Optimal)\n\n"
                "This is an automated routine informational report. No action is required."
            ),
            "received_at": now - timedelta(hours=6, minutes=5),
            "is_unread": False,
            "is_starred": False,
            "urgency_override": "FYI_ONLY",
            "confidence_score": 0.96,
            "one_sentence_summary": "Automated weekly cloud cost and sustainability report showing a 4.2% week-over-week compute spend reduction.",
            "detailed_summary": (
                "Routine Week 45 digest from GreenWatch Ops reporting $14,280 in compute spend (-4.2% WoW) and 184 saved GPU hours. "
                "Logged for reference only."
            ),
            "classification_reason": "Automated weekly telemetry digest with no anomalies or action requests.",
            "requires_action": False,
            "action_description": None,
            "deadline": None,
            "deadline_is_explicit": True,
            "deadline_confidence": None,
            "suggested_reply": None,
            "entities": ["GreenWatch Ops", "Week 45"],
            "review_required": False,
            "task": None,
        },
        {
            "external_id": "demo-msg-006",
            "thread_id": "thread-006",
            "source": "gmail",
            "sender_name": "CloudScale Summit",
            "sender_email_or_handle": "marketing@cloudscalesummit.expo",
            "subject_or_channel": "Flash Sale: 50% Off VIP Passes to CloudScale AI Expo + Exclusive Merch!",
            "preview": "Limited time promotional offer! Register your executive team before midnight to claim 50% off VIP passes.",
            "body": (
                "Don't miss out on the biggest SaaS expo of the season!\n\n"
                "Use promo code INSTANTVIP50 for a limited time offer of 50% off all executive passes.\n"
                "Click here to unsubscribe from future promotional newsletters."
            ),
            "received_at": now - timedelta(hours=8, minutes=30),
            "is_unread": False,
            "is_starred": False,
            "urgency_override": "NO_ACTION",
            "confidence_score": 0.99,
            "one_sentence_summary": "Promotional marketing email offering discounted conference passes; safe to ignore.",
            "detailed_summary": (
                "Cold marketing blast from CloudScale Summit advertising a 50% discount code. "
                "Filtered out of active priority queues."
            ),
            "classification_reason": "Bulk promotional newsletter with unsubscribe footer and zero operational relevance.",
            "requires_action": False,
            "action_description": None,
            "deadline": None,
            "deadline_is_explicit": True,
            "deadline_confidence": None,
            "suggested_reply": None,
            "entities": ["CloudScale Summit"],
            "review_required": False,
            "task": None,
        },
        {
            "external_id": "demo-msg-007",
            "thread_id": "thread-007",
            "source": "slack",
            "sender_name": "Priya Nair",
            "sender_email_or_handle": "@priya.nair",
            "subject_or_channel": "#design-systems",
            "preview": "Ambiguous scope question: Not sure if we should bundle the command palette redesign into 2.9 or hold for Q1?",
            "body": (
                "Hey @alex, thoughts on maybe folding the new keyboard command palette and multi-workspace switcher "
                "into the 2.9 point release, or should we hold off until the broader Q1 navigation refresh?\n\n"
                "Some enterprise beta users mentioned it, though engineering capacity is tight. Whenever you get a chance, "
                "which direction should we prioritize?"
            ),
            "received_at": now - timedelta(hours=3, minutes=20),
            "is_unread": True,
            "is_starred": False,
            "urgency_override": "NEEDS_RESPONSE",
            "confidence_score": 0.67,
            "one_sentence_summary": "Priya Nair asked for product direction on whether to ship the command palette redesign in v2.9 or defer to Q1.",
            "detailed_summary": (
                "Priya raised a strategic scope trade-off between including the command palette in v2.9 versus waiting for Q1. "
                "Because timeline and engineering capacity trade-offs are ambiguous, AI marked this for human review."
            ),
            "classification_reason": "Ambiguous scope decision requiring human product judgment; confidence below 75% threshold triggers review indicator.",
            "requires_action": True,
            "action_description": "Clarify v2.9 vs Q1 scope decision for command palette with Priya Nair",
            "deadline": "This sprint (AI-inferred)",
            "deadline_is_explicit": False,
            "deadline_confidence": 0.65,
            "suggested_reply": (
                "Hey Priya — Let's ship the keyboard shortcut bindings in v2.9 since that's low-risk, and hold the full "
                "visual command palette overhaul for the Q1 navigation refresh so we don't overload sprint capacity."
            ),
            "entities": ["Priya Nair", "v2.9", "Q1"],
            "review_required": True,
            "task": {
                "title": "Resolve v2.9 vs Q1 command palette scope trade-off with Priya",
                "description": "Confirm whether keyboard command palette ships in v2.9 or Q1 navigation refresh.",
                "priority": "MEDIUM",
                "due_date_text": "End of current sprint (AI-inferred)",
                "is_deadline_explicit": False,
                "assigned_to_name": "Alex Morgan",
            },
        },
        {
            "external_id": "demo-msg-008",
            "thread_id": "thread-008",
            "source": "gmail",
            "sender_name": "Jordan Vance",
            "sender_email_or_handle": "j.vance@northstar-enterprise.com",
            "subject_or_channel": "Follow-up Request: SOC2 Type II Penetration Test Attestation Letter",
            "preview": "Following up on my note from Tuesday—our CISO needs the signed SOC2 attestation letter to finalize vendor onboarding.",
            "body": (
                "Hi Alex,\n\n"
                "Following up on our security review thread from Tuesday. Our CISO's compliance team is ready to approve "
                "Instantly for our 450-seat deployment, but we still need the signed SOC2 Type II penetration test attestation letter.\n\n"
                "Could you send that over by tomorrow morning at 10:00 AM so we can close the ticket before our procurement freeze?\n\n"
                "Thanks,\nJordan Vance\nDirector of Enterprise IT, Northstar"
            ),
            "received_at": now - timedelta(minutes=52),
            "is_unread": True,
            "is_starred": True,
            "urgency_override": "IMMEDIATE",
            "confidence_score": 0.95,
            "one_sentence_summary": "Customer Jordan Vance followed up requesting the signed SOC2 Type II attestation letter by tomorrow at 10:00 AM.",
            "detailed_summary": (
                "Northstar Enterprise (450-seat deployment) is blocked only on receiving Instantly's signed SOC2 Type II "
                "penetration test attestation before their procurement freeze tomorrow at 10:00 AM."
            ),
            "classification_reason": "Customer follow-up tied to a 450-seat enterprise deal and an explicit tomorrow 10:00 AM procurement cutoff.",
            "requires_action": True,
            "action_description": "Send signed SOC2 Type II penetration test attestation to Jordan Vance",
            "deadline": "Tomorrow at 10:00 AM",
            "deadline_is_explicit": True,
            "deadline_confidence": 0.95,
            "suggested_reply": (
                "Hi Jordan,\n\nThank you for following up. I have attached our signed 2026 SOC2 Type II attestation letter "
                "and executive penetration test summary. Please let me know once your CISO's team confirms receipt so we can "
                "finalize onboarding ahead of your 10:00 AM cutoff.\n\nBest regards,\nAlex"
            ),
            "entities": ["Jordan Vance", "Northstar", "SOC2", "CISO"],
            "review_required": False,
            "task": {
                "title": "Send SOC2 Type II attestation letter to Jordan Vance (Northstar)",
                "description": "Attach signed SOC2 Type II report before Northstar's procurement freeze tomorrow at 10:00 AM.",
                "priority": "CRITICAL",
                "due_date_text": "Tomorrow at 10:00 AM",
                "is_deadline_explicit": True,
                "assigned_to_name": "Alex Morgan",
            },
        },
    ]


def ensure_demo_workspace_seeded(db: Session, force_reset: bool = False) -> tuple[User, Workspace]:
    user = db.query(User).filter(User.email == "alex.morgan@instantly.ai").first()
    if not user:
        user = User(
            email="alex.morgan@instantly.ai",
            full_name="Alex Morgan",
            job_title="VP of Product & Operations",
            hashed_password=get_password_hash("InstantlyDemo2026!"),
            is_active=True,
        )
        db.add(user)
        db.flush()

    pref = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not pref:
        pref = UserPreference(
            user_id=user.id,
            default_reply_tone="professional",
            ai_provider="heuristic",
            ai_model_name="gpt-4o-mini",
            auto_extract_tasks=True,
            morning_brief_time="08:00",
            high_priority_notifications=True,
            demo_mode_enabled=True,
        )
        db.add(pref)

    workspace = db.query(Workspace).filter(Workspace.slug == "apex-intelligence").first()
    if not workspace:
        workspace = Workspace(
            name="Apex Product Workspace",
            slug="apex-intelligence",
            owner_id=user.id,
            is_demo=True,
        )
        db.add(workspace)
        db.flush()

    # Ensure team members exist
    teammates = [
        ("alex.morgan@instantly.ai", "Alex Morgan", "VP of Product & Operations", "Owner"),
        ("sarah.chen@instantly.team", "Sarah Chen", "Staff Product Manager", "Admin"),
        ("marcus.okoye@instantly.team", "Marcus Okoye", "Security & Compliance Lead", "Member"),
        ("priya.nair@instantly.team", "Priya Nair", "Principal Design Architect", "Member"),
    ]
    for email, name, title, role in teammates:
        tm_user = db.query(User).filter(User.email == email).first()
        if not tm_user:
            tm_user = User(
                email=email,
                full_name=name,
                job_title=title,
                hashed_password=get_password_hash("InstantlyTeam2026!"),
                is_active=True,
            )
            db.add(tm_user)
            db.flush()
        membership = (
            db.query(WorkspaceMembership)
            .filter(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.user_id == tm_user.id,
            )
            .first()
        )
        if not membership:
            db.add(
                WorkspaceMembership(
                    workspace_id=workspace.id,
                    user_id=tm_user.id,
                    role=role,
                    status="Active",
                )
            )

    if force_reset:
        workspace.is_demo = True
        db.query(InternalComment).delete()
        db.query(MessageAssignment).delete()
        db.query(SuggestedReply).delete()
        db.query(AIAnalysis).delete()
        db.query(Task).filter(Task.workspace_id == workspace.id).delete()
        db.query(Message).filter(Message.workspace_id == workspace.id).delete()
        db.query(Conversation).filter(Conversation.workspace_id == workspace.id).delete()
        db.query(AuditEvent).filter(AuditEvent.workspace_id == workspace.id).delete()
        db.query(Notification).filter(Notification.workspace_id == workspace.id).delete()
        db.flush()

    if not workspace.is_demo and not force_reset:
        db.commit()
        return user, workspace

    existing_count = db.query(Message).filter(Message.workspace_id == workspace.id).count()
    if existing_count > 0 and not force_reset:
        db.commit()
        return user, workspace

    now = datetime.now(timezone.utc)

    # Integrations metadata
    for platform, acct, scopes in [
        ("gmail", "alex.morgan@instantly.ai (Demo Feed)", "gmail.readonly, userinfo.email"),
        ("slack", "Apex Product Slack (Demo Feed)", "channels:history, channels:read, im:history"),
    ]:
        integ = (
            db.query(Integration)
            .filter(Integration.workspace_id == workspace.id, Integration.platform == platform)
            .first()
        )
        if not integ:
            integ = Integration(
                workspace_id=workspace.id,
                platform=platform,
                status="demo",
                account_identifier=acct,
                scopes=scopes,
                last_synced_at=now - timedelta(minutes=4),
            )
            db.add(integ)
        else:
            if force_reset:
                integ.status = "demo"
                integ.account_identifier = acct
                integ.scopes = scopes
                integ.error_message = None
            integ.last_synced_at = now - timedelta(minutes=4)

    catalog = get_demo_messages_catalog(now)
    for item in catalog:
        conv = Conversation(
            workspace_id=workspace.id,
            external_thread_id=item["thread_id"],
            platform=item["source"],
            subject_or_channel=item["subject_or_channel"],
            participants_json=json.dumps([item["sender_name"], "Alex Morgan"]),
            last_message_at=item["received_at"],
        )
        db.add(conv)
        db.flush()

        msg = Message(
            workspace_id=workspace.id,
            conversation_id=conv.id,
            external_id=item["external_id"],
            source=item["source"],
            sender_name=item["sender_name"],
            sender_email_or_handle=item["sender_email_or_handle"],
            subject_or_channel=item["subject_or_channel"],
            preview=item["preview"],
            body=item["body"],
            received_at=item["received_at"],
            is_unread=item["is_unread"],
            is_starred=item["is_starred"],
            is_demo=True,
            priority_status="pending" if item["requires_action"] else "completed",
        )
        db.add(msg)
        db.flush()

        analysis = AIAnalysis(
            message_id=msg.id,
            urgency=item["urgency_override"],
            confidence_score=item["confidence_score"],
            one_sentence_summary=item["one_sentence_summary"],
            detailed_summary=item["detailed_summary"],
            classification_reason=item["classification_reason"],
            requires_action=item["requires_action"],
            action_description=item["action_description"],
            deadline=item["deadline"],
            deadline_is_explicit=item["deadline_is_explicit"],
            deadline_confidence=item["deadline_confidence"],
            suggested_reply=item["suggested_reply"],
            detected_entities_json=json.dumps(item["entities"]),
            review_required=item["review_required"],
            provider_used="heuristic",
            analyzed_at=now,
        )
        db.add(analysis)

        if item["suggested_reply"]:
            db.add(
                SuggestedReply(
                    message_id=msg.id,
                    tone="professional",
                    content=item["suggested_reply"],
                    is_saved_draft=True,
                )
            )

        if item["task"]:
            t_data = item["task"]
            db.add(
                Task(
                    workspace_id=workspace.id,
                    message_id=msg.id,
                    title=t_data["title"],
                    description=t_data["description"],
                    priority=t_data["priority"],
                    status="pending",
                    due_date_text=t_data["due_date_text"],
                    is_deadline_explicit=t_data["is_deadline_explicit"],
                    assigned_to_name=t_data["assigned_to_name"],
                    is_demo=True,
                )
            )

        if item["external_id"] == "demo-msg-002":
            db.add(
                MessageAssignment(
                    message_id=msg.id,
                    assignee_name="Marcus Okoye",
                    assignee_email="marcus.okoye@instantly.team",
                    assigned_by_name="Alex Morgan",
                    note="Verify Section 4.2 token rotation window with Legal.",
                )
            )
            db.add(
                InternalComment(
                    message_id=msg.id,
                    author_name="Sarah Chen",
                    author_role="Admin",
                    content="Acme Global's renewal is tied to this SSO addendum—let's prioritize before Friday.",
                )
            )

    # Add 1 completed task so dashboard completed action stats are immediately meaningful
    db.add(
        Task(
            workspace_id=workspace.id,
            title="Publish v2.8 AI Inference Gateway release notes to #eng-platform-core",
            description="Verified P95 latency reduction metrics with Devon Brooks.",
            priority="MEDIUM",
            status="completed",
            due_date_text="Completed today",
            is_deadline_explicit=True,
            assigned_to_name="Devon Brooks",
            is_demo=True,
            completed_at=now - timedelta(hours=2),
        )
    )

    # Seed invitations, sync history, notifications, and audit events
    if db.query(WorkspaceInvitation).filter(WorkspaceInvitation.workspace_id == workspace.id).count() == 0:
        db.add(
            WorkspaceInvitation(
                workspace_id=workspace.id,
                email="elena.rostova@horizon-ventures.io",
                role="Member",
                invited_by_id=user.id,
                status="Pending",
            )
        )

    db.add(
        SyncHistory(
            workspace_id=workspace.id,
            platform="demo",
            status="completed",
            messages_fetched=8,
            messages_analyzed=8,
            tasks_extracted=5,
            started_at=now - timedelta(minutes=5),
            completed_at=now - timedelta(minutes=4),
        )
    )

    db.add(
        Notification(
            workspace_id=workspace.id,
            title="2 Immediate Deadlines Detected",
            body="Q4 Board Deck ARR Sign-off (2:00 PM) and Northstar SOC2 Attestation (Tomorrow 10:00 AM) require action.",
            severity="critical",
            link="/priority",
        )
    )
    db.add(
        Notification(
            workspace_id=workspace.id,
            title="1 Ambiguous Scope Thread Flagged",
            body="Priya Nair's #design-systems message has 67% confidence and needs human product direction.",
            severity="warning",
            link="/ai-brief",
        )
    )

    db.add(
        AuditEvent(
            workspace_id=workspace.id,
            actor_name="Instantly AI Engine",
            event_type="TRIAGE_COMPLETED",
            description="Analyzed 8 multi-channel communications and extracted 5 actionable tasks.",
        )
    )

    db.commit()
    return user, workspace


def serialize_message(msg: Message, db: Optional[Session] = None) -> dict:
    analysis = msg.ai_analysis
    entities = []
    if analysis and analysis.detected_entities_json:
        try:
            entities = json.loads(analysis.detected_entities_json)
        except Exception:
            entities = []

    effective_urgency = msg.manual_priority_override or (analysis.urgency if analysis else "FYI_ONLY")
    effective_action = msg.custom_action_override or (
        analysis.action_description if analysis else None
    )

    ai_dict = None
    if analysis:
        ai_dict = {
            "message_id": msg.id,
            "source": msg.source,
            "sender": msg.sender_name,
            "subject_or_channel": msg.subject_or_channel,
            "received_at": msg.received_at,
            "urgency": effective_urgency,
            "confidence_score": analysis.confidence_score,
            "one_sentence_summary": analysis.one_sentence_summary,
            "detailed_summary": analysis.detailed_summary,
            "classification_reason": analysis.classification_reason,
            "requires_action": analysis.requires_action or bool(msg.manual_priority_override in ("IMMEDIATE", "NEEDS_RESPONSE")),
            "action_description": effective_action,
            "deadline": analysis.deadline,
            "deadline_is_explicit": analysis.deadline_is_explicit,
            "deadline_confidence": analysis.deadline_confidence,
            "suggested_reply": analysis.suggested_reply,
            "detected_entities": entities,
            "review_required": analysis.review_required,
            "provider_used": analysis.provider_used,
        }

    return {
        "id": msg.id,
        "workspace_id": msg.workspace_id,
        "conversation_id": msg.conversation_id,
        "external_id": msg.external_id,
        "source": msg.source,
        "sender_name": msg.sender_name,
        "sender_email_or_handle": msg.sender_email_or_handle,
        "sender_avatar": msg.sender_avatar,
        "subject_or_channel": msg.subject_or_channel,
        "preview": msg.preview,
        "body": msg.body,
        "received_at": msg.received_at,
        "is_unread": msg.is_unread,
        "is_starred": msg.is_starred,
        "is_demo": msg.is_demo,
        "priority_status": msg.priority_status,
        "snoozed_until": msg.snoozed_until,
        "custom_action_override": msg.custom_action_override,
        "manual_priority_override": msg.manual_priority_override,
        "effective_urgency": effective_urgency,
        "effective_action_description": effective_action,
        "ai_analysis": ai_dict,
        "suggested_replies": [
            {
                "id": r.id,
                "message_id": r.message_id,
                "tone": r.tone,
                "custom_instructions": r.custom_instructions,
                "content": r.content,
                "is_saved_draft": r.is_saved_draft,
                "gmail_draft_created": r.gmail_draft_created,
                "created_at": r.created_at,
            }
            for r in sorted(msg.suggested_replies, key=lambda x: x.created_at, reverse=True)
        ],
        "assignments": [
            {
                "id": a.id,
                "message_id": a.message_id,
                "assignee_name": a.assignee_name,
                "assignee_email": a.assignee_email,
                "assigned_by_name": a.assigned_by_name,
                "note": a.note,
                "created_at": a.created_at,
            }
            for a in msg.assignments
        ],
        "comments": [
            {
                "id": c.id,
                "message_id": c.message_id,
                "author_name": c.author_name,
                "author_role": c.author_role,
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in sorted(msg.comments, key=lambda x: x.created_at)
        ],
        "thread_messages_count": 1,
    }


def purge_demo_data_for_workspace(db: Session, workspace_id: str) -> None:
    """Removes all demo messages, demo tasks, and demo notifications so live data is never mixed with fake data."""
    demo_tasks = (
        db.query(Task)
        .filter(Task.workspace_id == workspace_id, Task.is_demo.is_(True))
        .all()
    )
    for t in demo_tasks:
        db.delete(t)
    db.flush()

    demo_msgs = (
        db.query(Message)
        .filter(Message.workspace_id == workspace_id, Message.is_demo.is_(True))
        .all()
    )
    demo_conv_ids = {m.conversation_id for m in demo_msgs if m.conversation_id}
    for m in demo_msgs:
        db.delete(m)
    db.flush()

    if demo_conv_ids:
        demo_convs = (
            db.query(Conversation)
            .filter(
                Conversation.workspace_id == workspace_id,
                Conversation.id.in_(demo_conv_ids),
            )
            .all()
        )
        for c in demo_convs:
            db.delete(c)
        db.flush()


def delete_platform_messages_for_workspace(db: Session, workspace_id: str, platform: str) -> int:
    """Deletes synced non-demo messages and associated tasks/conversations for a disconnected platform."""
    msgs = (
        db.query(Message)
        .filter(
            Message.workspace_id == workspace_id,
            Message.source == platform,
            Message.is_demo.is_(False),
        )
        .all()
    )
    msg_ids = [m.id for m in msgs]
    conv_ids = {m.conversation_id for m in msgs if m.conversation_id}

    if msg_ids:
        linked_tasks = (
            db.query(Task)
            .filter(Task.workspace_id == workspace_id, Task.message_id.in_(msg_ids))
            .all()
        )
        for t in linked_tasks:
            db.delete(t)
        db.flush()

    for m in msgs:
        db.delete(m)
    db.flush()

    if conv_ids:
        convs = (
            db.query(Conversation)
            .filter(
                Conversation.workspace_id == workspace_id,
                Conversation.id.in_(conv_ids),
            )
            .all()
        )
        for c in convs:
            db.delete(c)
        db.flush()

    return len(msg_ids)


def _refresh_gmail_credential(db: Session, gmail_integ: Integration, now: datetime) -> Optional[str]:
    """Refreshes an expired Gmail access token or marks the integration as needs_reconnect."""
    cred = gmail_integ.credential
    if not cred or not cred.encrypted_refresh_token:
        gmail_integ.status = "needs_reconnect"
        gmail_integ.error_message = "Gmail session expired. Please reconnect your account."
        db.commit()
        return None

    try:
        refresh_tok = decrypt_secret(cred.encrypted_refresh_token)
        token_data = GmailConnector.refresh_access_token(refresh_tok)
        new_access = token_data.get("access_token")
        if not new_access:
            raise ValueError("No access_token returned from refresh")

        cred.encrypted_access_token = encrypt_secret(new_access)
        if token_data.get("refresh_token"):
            cred.encrypted_refresh_token = encrypt_secret(token_data["refresh_token"])
        expires_in = int(token_data.get("expires_in", 3600))
        cred.token_expiry = now + timedelta(seconds=expires_in)
        if token_data.get("scope"):
            gmail_integ.scopes = token_data["scope"]
        gmail_integ.error_message = None
        db.commit()
        return new_access
    except Exception:
        gmail_integ.status = "needs_reconnect"
        gmail_integ.error_message = "Gmail authorization expired or was revoked. Please reconnect."
        db.commit()
        return None


def _map_urgency_to_task_priority(urgency: str) -> str:
    return {
        "IMMEDIATE": "CRITICAL",
        "NEEDS_RESPONSE": "HIGH",
        "IMPORTANT": "MEDIUM",
        "FYI_ONLY": "LOW",
        "NO_ACTION": "LOW",
    }.get(urgency, "MEDIUM")


def run_synchronization_and_triage(db: Session, workspace_id: str) -> dict:
    """Pulls live messages from connected platforms, runs AI triage, and logs a SyncHistory record."""
    now = datetime.now(timezone.utc)
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    gmail_integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == workspace_id, Integration.platform == "gmail")
        .first()
    )

    fetched_live_count = 0
    analyzed_count = 0
    extracted_tasks = 0
    sync_status = "completed"
    sync_error: Optional[str] = None

    # 1. If Gmail is connected live, pull real messages from Gmail API
    if gmail_integ and gmail_integ.status == "connected" and gmail_integ.credential:
        if ws and ws.is_demo:
            ws.is_demo = False
        purge_demo_data_for_workspace(db, workspace_id)

        cred = gmail_integ.credential
        access_token: Optional[str] = decrypt_secret(cred.encrypted_access_token)

        # Check if access token is expired or within 60s of expiry
        if cred.token_expiry:
            expiry = (
                cred.token_expiry
                if cred.token_expiry.tzinfo
                else cred.token_expiry.replace(tzinfo=timezone.utc)
            )
            if expiry <= now + timedelta(seconds=60):
                access_token = _refresh_gmail_credential(db, gmail_integ, now)

        if access_token and gmail_integ.status == "connected":
            raw_messages: list[dict] = []
            try:
                raw_messages = GmailConnector.fetch_recent_messages(
                    access_token=access_token,
                    max_results=50,
                    days=7,
                )
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (401, 403):
                    refreshed = _refresh_gmail_credential(db, gmail_integ, now)
                    if refreshed:
                        try:
                            raw_messages = GmailConnector.fetch_recent_messages(
                                access_token=refreshed,
                                max_results=50,
                                days=7,
                            )
                        except Exception as retry_exc:
                            sync_status = "failed"
                            sync_error = f"Gmail sync failed after token refresh: {type(retry_exc).__name__}"
                    else:
                        sync_status = "failed"
                        sync_error = gmail_integ.error_message
                else:
                    sync_status = "partial"
                    sync_error = f"Gmail API returned HTTP {exc.response.status_code}"
                    gmail_integ.error_message = "Temporary error talking to Gmail. Please try syncing again."
            except Exception as exc:
                sync_status = "partial"
                sync_error = f"Gmail network error: {type(exc).__name__}"
                gmail_integ.error_message = "Could not reach Gmail right now. Please try again shortly."

            for item in raw_messages:
                fetched_live_count += 1
                ext_id = item.get("external_id")
                if not ext_id:
                    continue

                existing_msg = (
                    db.query(Message)
                    .filter(
                        Message.workspace_id == workspace_id,
                        Message.source == "gmail",
                        Message.external_id == ext_id,
                    )
                    .first()
                )
                if existing_msg:
                    existing_msg.is_unread = item.get("is_unread", existing_msg.is_unread)
                    existing_msg.is_starred = item.get("is_starred", existing_msg.is_starred)
                    continue

                thread_id = item.get("thread_id") or ext_id
                conv = (
                    db.query(Conversation)
                    .filter(
                        Conversation.workspace_id == workspace_id,
                        Conversation.platform == "gmail",
                        Conversation.external_thread_id == thread_id,
                    )
                    .first()
                )
                if not conv:
                    conv = Conversation(
                        workspace_id=workspace_id,
                        external_thread_id=thread_id,
                        platform="gmail",
                        subject_or_channel=item["subject_or_channel"],
                        participants_json=json.dumps([item["sender_name"], item.get("recipient") or "Me"]),
                        last_message_at=item["received_at"],
                    )
                    db.add(conv)
                    db.flush()
                else:
                    if item["received_at"] > (
                        conv.last_message_at
                        if conv.last_message_at.tzinfo
                        else conv.last_message_at.replace(tzinfo=timezone.utc)
                    ):
                        conv.last_message_at = item["received_at"]

                msg = Message(
                    workspace_id=workspace_id,
                    conversation_id=conv.id,
                    external_id=ext_id,
                    source="gmail",
                    sender_name=item["sender_name"],
                    sender_email_or_handle=item["sender_email_or_handle"],
                    subject_or_channel=item["subject_or_channel"],
                    preview=item["preview"],
                    body=item["body"],
                    received_at=item["received_at"],
                    is_unread=item.get("is_unread", True),
                    is_starred=item.get("is_starred", False),
                    is_demo=False,
                    priority_status="pending",
                )
                db.add(msg)
                db.flush()

                result = ai_engine.analyze_message(
                    message_id=msg.id,
                    source=msg.source,
                    sender=msg.sender_name,
                    subject_or_channel=msg.subject_or_channel,
                    body=msg.body,
                    received_at=msg.received_at,
                )
                msg.priority_status = "pending" if result.requires_action else "completed"

                analysis = AIAnalysis(
                    message_id=msg.id,
                    urgency=result.urgency,
                    confidence_score=result.confidence_score,
                    one_sentence_summary=result.one_sentence_summary,
                    detailed_summary=result.detailed_summary,
                    classification_reason=result.classification_reason,
                    requires_action=result.requires_action,
                    action_description=result.action_description,
                    deadline=result.deadline,
                    deadline_is_explicit=result.deadline_is_explicit,
                    deadline_confidence=result.deadline_confidence,
                    suggested_reply=result.suggested_reply,
                    detected_entities_json=json.dumps(result.detected_entities),
                    review_required=result.review_required,
                    provider_used=result.provider_used,
                    analyzed_at=now,
                )
                msg.ai_analysis = analysis
                db.add(analysis)

                if result.suggested_reply:
                    db.add(
                        SuggestedReply(
                            message_id=msg.id,
                            tone="professional",
                            content=result.suggested_reply,
                            is_saved_draft=False,
                            gmail_draft_created=False,
                        )
                    )

                if result.requires_action:
                    task_title = (result.action_description or f"Follow up: {msg.subject_or_channel}")[:500]
                    db.add(
                        Task(
                            workspace_id=workspace_id,
                            message_id=msg.id,
                            title=task_title,
                            description=result.one_sentence_summary,
                            priority=_map_urgency_to_task_priority(result.urgency),
                            status="pending",
                            due_date_text=result.deadline or "Action required",
                            is_deadline_explicit=result.deadline_is_explicit,
                            assigned_to_name=gmail_integ.account_identifier or "Workspace Owner",
                            is_demo=False,
                        )
                    )
                    extracted_tasks += 1

                db.flush()
                analyzed_count += 1

            if sync_status == "completed":
                gmail_integ.last_synced_at = now
                gmail_integ.error_message = None

    # 1b. If Slack is connected live, pull real messages from Slack API using the user's token
    slack_integ = (
        db.query(Integration)
        .filter(Integration.workspace_id == workspace_id, Integration.platform == "slack")
        .first()
    )
    if slack_integ and slack_integ.status == "connected" and slack_integ.credential:
        if ws and ws.is_demo:
            ws.is_demo = False
        purge_demo_data_for_workspace(db, workspace_id)

        slack_token = decrypt_secret(slack_integ.credential.encrypted_access_token)
        if slack_token:
            slack_raw_messages: list[dict] = []
            try:
                slack_raw_messages = SlackConnector.fetch_recent_messages(
                    access_token=slack_token,
                    max_channels=8,
                    messages_per_channel=10,
                )
            except Exception as exc:
                sync_status = "partial"
                sync_error = f"Slack sync error: {type(exc).__name__}"
                slack_integ.error_message = "Could not fetch Slack messages. Please check permissions or reconnect."

            for item in slack_raw_messages:
                fetched_live_count += 1
                ext_id = item.get("external_id")
                if not ext_id:
                    continue

                existing_msg = (
                    db.query(Message)
                    .filter(
                        Message.workspace_id == workspace_id,
                        Message.source == "slack",
                        Message.external_id == ext_id,
                    )
                    .first()
                )
                if existing_msg:
                    continue

                thread_id = item.get("thread_id") or ext_id
                conv = (
                    db.query(Conversation)
                    .filter(
                        Conversation.workspace_id == workspace_id,
                        Conversation.platform == "slack",
                        Conversation.external_thread_id == thread_id,
                    )
                    .first()
                )
                if not conv:
                    conv = Conversation(
                        workspace_id=workspace_id,
                        external_thread_id=thread_id,
                        platform="slack",
                        subject_or_channel=item["subject_or_channel"],
                        participants_json=json.dumps([item["sender_name"], "Me"]),
                        last_message_at=item["received_at"],
                    )
                    db.add(conv)
                    db.flush()
                else:
                    if item["received_at"] > (
                        conv.last_message_at
                        if conv.last_message_at.tzinfo
                        else conv.last_message_at.replace(tzinfo=timezone.utc)
                    ):
                        conv.last_message_at = item["received_at"]

                msg = Message(
                    workspace_id=workspace_id,
                    conversation_id=conv.id,
                    external_id=ext_id,
                    source="slack",
                    sender_name=item["sender_name"],
                    sender_email_or_handle=item["sender_email_or_handle"],
                    subject_or_channel=item["subject_or_channel"],
                    preview=item["preview"],
                    body=item["body"],
                    received_at=item["received_at"],
                    is_unread=item.get("is_unread", True),
                    is_starred=item.get("is_starred", False),
                    is_demo=False,
                    priority_status="pending",
                )
                db.add(msg)
                db.flush()

                result = ai_engine.analyze_message(
                    message_id=msg.id,
                    source=msg.source,
                    sender=msg.sender_name,
                    subject_or_channel=msg.subject_or_channel,
                    body=msg.body,
                    received_at=msg.received_at,
                )
                msg.priority_status = "pending" if result.requires_action else "completed"

                analysis = AIAnalysis(
                    message_id=msg.id,
                    urgency=result.urgency,
                    confidence_score=result.confidence_score,
                    one_sentence_summary=result.one_sentence_summary,
                    detailed_summary=result.detailed_summary,
                    classification_reason=result.classification_reason,
                    requires_action=result.requires_action,
                    action_description=result.action_description,
                    deadline=result.deadline,
                    deadline_is_explicit=result.deadline_is_explicit,
                    deadline_confidence=result.deadline_confidence,
                    suggested_reply=result.suggested_reply,
                    detected_entities_json=json.dumps(result.detected_entities),
                    review_required=result.review_required,
                    provider_used=result.provider_used,
                    analyzed_at=now,
                )
                msg.ai_analysis = analysis
                db.add(analysis)

                if result.suggested_reply:
                    db.add(
                        SuggestedReply(
                            message_id=msg.id,
                            tone="professional",
                            content=result.suggested_reply,
                            is_saved_draft=False,
                            gmail_draft_created=False,
                        )
                    )

                if result.requires_action:
                    task_title = (result.action_description or f"Follow up: {msg.subject_or_channel}")[:500]
                    db.add(
                        Task(
                            workspace_id=workspace_id,
                            message_id=msg.id,
                            title=task_title,
                            description=result.one_sentence_summary,
                            priority=_map_urgency_to_task_priority(result.urgency),
                            status="pending",
                            due_date_text=result.deadline or "Action required",
                            is_deadline_explicit=result.deadline_is_explicit,
                            assigned_to_name=slack_integ.account_identifier or "Workspace Owner",
                            is_demo=False,
                        )
                    )
                    extracted_tasks += 1

                db.flush()
                analyzed_count += 1

            if sync_status == "completed":
                slack_integ.last_synced_at = now
                slack_integ.error_message = None

    # 2. Evaluate any existing unanalyzed messages in the workspace
    messages_query = db.query(Message).filter(Message.workspace_id == workspace_id)
    if ws and not ws.is_demo:
        messages_query = messages_query.filter(Message.is_demo.is_(False))
    messages = messages_query.all()

    for msg in messages:
        if not msg.ai_analysis:
            analyzed_count += 1
            result = ai_engine.analyze_message(
                message_id=msg.id,
                source=msg.source,
                sender=msg.sender_name,
                subject_or_channel=msg.subject_or_channel,
                body=msg.body,
                received_at=msg.received_at,
            )
            analysis = AIAnalysis(
                message_id=msg.id,
                urgency=result.urgency,
                confidence_score=result.confidence_score,
                one_sentence_summary=result.one_sentence_summary,
                detailed_summary=result.detailed_summary,
                classification_reason=result.classification_reason,
                requires_action=result.requires_action,
                action_description=result.action_description,
                deadline=result.deadline,
                deadline_is_explicit=result.deadline_is_explicit,
                deadline_confidence=result.deadline_confidence,
                suggested_reply=result.suggested_reply,
                detected_entities_json=json.dumps(result.detected_entities),
                review_required=result.review_required,
                provider_used=result.provider_used,
                analyzed_at=now,
            )
            db.add(analysis)
            if result.requires_action and result.action_description:
                extracted_tasks += 1

    if ws and ws.is_demo:
        analyzed_count = max(analyzed_count, len(messages))

    integrations = db.query(Integration).filter(Integration.workspace_id == workspace_id).all()
    for integ in integrations:
        if integ.status in ("connected", "demo") and sync_status == "completed":
            integ.last_synced_at = now

    total_fetched = fetched_live_count if (ws and not ws.is_demo) else len(messages)

    sync_entry = SyncHistory(
        workspace_id=workspace_id,
        platform="gmail" if (gmail_integ and gmail_integ.status == "connected") else "all",
        status=sync_status,
        messages_fetched=total_fetched,
        messages_analyzed=analyzed_count,
        tasks_extracted=extracted_tasks,
        error_detail=sync_error,
        started_at=now - timedelta(seconds=1),
        completed_at=now,
    )
    db.add(sync_entry)
    db.add(
        AuditEvent(
            workspace_id=workspace_id,
            actor_name="Instantly Sync",
            event_type="MANUAL_SYNC",
            description=f"Synchronized {total_fetched} communications across connected feeds.",
        )
    )
    db.commit()
    return {
        "status": sync_status,
        "messages_fetched": total_fetched,
        "messages_analyzed": analyzed_count,
        "synced_at": now,
    }


def generate_markdown_report(db: Session, workspace_id: str) -> str:
    _, workspace = ensure_demo_workspace_seeded(db)
    messages = (
        db.query(Message)
        .filter(Message.workspace_id == workspace.id)
        .order_by(Message.received_at.desc())
        .all()
    )
    tasks = db.query(Task).filter(Task.workspace_id == workspace.id).all()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    immediate = [m for m in messages if (m.manual_priority_override or (m.ai_analysis.urgency if m.ai_analysis else "")) == "IMMEDIATE"]
    needs_resp = [m for m in messages if (m.manual_priority_override or (m.ai_analysis.urgency if m.ai_analysis else "")) == "NEEDS_RESPONSE"]
    pending_tasks = [t for t in tasks if t.status != "completed"]

    lines = [
        "# INSTANTLY — Executive Communications Intelligence Briefing",
        f"**Workspace:** {workspace.name} {'(DEMO DATA)' if workspace.is_demo else ''}",
        f"**Generated At:** {now_str}",
        "",
        "## 1. Executive Summary",
        f"- **Total Consolidated Communications:** {len(messages)}",
        f"- **Immediate Attention Required:** {len(immediate)}",
        f"- **Awaiting Response / Decision:** {len(needs_resp)}",
        f"- **Open Action Items / Tasks:** {len(pending_tasks)}",
        "",
        "## 2. Immediate Attention & Critical Deadlines",
    ]
    for m in immediate:
        summary = m.ai_analysis.one_sentence_summary if m.ai_analysis else m.preview
        deadline = m.ai_analysis.deadline if m.ai_analysis and m.ai_analysis.deadline else "ASAP"
        lines.append(f"- **[{m.source.upper()}] {m.sender_name}** — *{m.subject_or_channel}*")
        lines.append(f"  - **Summary:** {summary}")
        lines.append(f"  - **Deadline:** {deadline}")

    lines.append("")
    lines.append("## 3. Messages Requiring Response")
    for m in needs_resp:
        summary = m.ai_analysis.one_sentence_summary if m.ai_analysis else m.preview
        lines.append(f"- **[{m.source.upper()}] {m.sender_name}** — *{m.subject_or_channel}*: {summary}")

    lines.append("")
    lines.append("## 4. Extracted Action Items & Follow-ups")
    for t in pending_tasks:
        dtype = "Explicit Deadline" if t.is_deadline_explicit else "AI-Inferred Timeline"
        lines.append(f"- **[ ] [{t.priority}] {t.title}** — Due: `{t.due_date_text or 'TBD'}` ({dtype})")

    return "\n".join(lines)

