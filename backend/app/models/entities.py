import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), default="Product Lead")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="user", cascade="all, delete-orphan"
    )
    preferences: Mapped[Optional["UserPreference"]] = relationship(
        "UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="workspace", cascade="all, delete-orphan"
    )
    integrations: Mapped[list["Integration"]] = relationship(
        "Integration", back_populates="workspace", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="workspace", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="Owner")  # Owner | Admin | Member
    status: Mapped[str] = mapped_column(String(50), default="Active")  # Active | Invited
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="memberships")


class WorkspaceInvitation(Base):
    __tablename__ = "workspace_invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="Member")
    invited_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending")  # Pending | Accepted | Revoked
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("workspace_id", "platform", name="uq_workspace_platform"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # gmail | slack
    status: Mapped[str] = mapped_column(String(50), default="disconnected")  # connected | disconnected | error | demo
    account_identifier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    scopes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="integrations")
    credential: Mapped[Optional["IntegrationCredential"]] = relationship(
        "IntegrationCredential", back_populates="integration", uselist=False, cascade="all, delete-orphan"
    )


class IntegrationCredential(Base):
    __tablename__ = "integration_credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id"), unique=True, nullable=False
    )
    encrypted_access_token: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    integration: Mapped["Integration"] = relationship("Integration", back_populates="credential")


class OAuthState(Base):
    __tablename__ = "oauth_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    state_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # gmail | slack
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    external_thread_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    subject_or_channel: Mapped[str] = mapped_column(String(512), nullable=False)
    participants_json: Mapped[str] = mapped_column(Text, default="[]")
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("workspace_id", "source", "external_id", name="uq_workspace_source_external_id"),
        Index("ix_messages_workspace_received", "workspace_id", "received_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("conversations.id"), index=True, nullable=True
    )
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # gmail | slack
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_email_or_handle: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_avatar: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    subject_or_channel: Mapped[str] = mapped_column(String(512), nullable=False)
    preview: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    is_unread: Mapped[bool] = mapped_column(Boolean, default=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    priority_status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )  # pending | completed | snoozed | ignored
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    custom_action_override: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manual_priority_override: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="messages")
    conversation: Mapped[Optional["Conversation"]] = relationship("Conversation", back_populates="messages")
    ai_analysis: Mapped[Optional["AIAnalysis"]] = relationship(
        "AIAnalysis", back_populates="message", uselist=False, cascade="all, delete-orphan"
    )
    suggested_replies: Mapped[list["SuggestedReply"]] = relationship(
        "SuggestedReply", back_populates="message", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["MessageAssignment"]] = relationship(
        "MessageAssignment", back_populates="message", cascade="all, delete-orphan"
    )
    comments: Mapped[list["InternalComment"]] = relationship(
        "InternalComment", back_populates="message", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="message")


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    message_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("messages.id"), unique=True, index=True, nullable=False
    )
    urgency: Mapped[str] = mapped_column(
        String(50), index=True, nullable=False
    )  # IMMEDIATE | NEEDS_RESPONSE | IMPORTANT | FYI_ONLY | NO_ACTION
    confidence_score: Mapped[float] = mapped_column(Float, default=0.92)
    one_sentence_summary: Mapped[str] = mapped_column(Text, nullable=False)
    detailed_summary: Mapped[str] = mapped_column(Text, nullable=False)
    classification_reason: Mapped[str] = mapped_column(Text, nullable=False)
    requires_action: Mapped[bool] = mapped_column(Boolean, default=False)
    action_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deadline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    deadline_is_explicit: Mapped[bool] = mapped_column(Boolean, default=True)
    deadline_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    suggested_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detected_entities_json: Mapped[str] = mapped_column(Text, default="[]")
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)
    provider_used: Mapped[str] = mapped_column(String(50), default="heuristic")
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    message: Mapped["Message"] = relationship("Message", back_populates="ai_analysis")


class SuggestedReply(Base):
    __tablename__ = "suggested_replies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    message_id: Mapped[str] = mapped_column(String(36), ForeignKey("messages.id"), index=True, nullable=False)
    tone: Mapped[str] = mapped_column(String(50), default="professional")  # professional | friendly | concise | custom
    custom_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_saved_draft: Mapped[bool] = mapped_column(Boolean, default=False)
    gmail_draft_created: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    message: Mapped["Message"] = relationship("Message", back_populates="suggested_replies")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    message_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("messages.id"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(50), default="HIGH")  # CRITICAL | HIGH | MEDIUM | LOW
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending | in_progress | completed | snoozed
    due_date_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deadline_explicit: Mapped[bool] = mapped_column(Boolean, default=True)
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_to_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="tasks")
    message: Mapped[Optional["Message"]] = relationship("Message", back_populates="tasks")


class MessageAssignment(Base):
    __tablename__ = "message_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    message_id: Mapped[str] = mapped_column(String(36), ForeignKey("messages.id"), index=True, nullable=False)
    assignee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    assignee_email: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_by_name: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    message: Mapped["Message"] = relationship("Message", back_populates="assignments")


class InternalComment(Base):
    __tablename__ = "internal_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    message_id: Mapped[str] = mapped_column(String(36), ForeignKey("messages.id"), index=True, nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(100), default="Member")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    message: Mapped["Message"] = relationship("Message", back_populates="comments")


class SyncHistory(Base):
    __tablename__ = "sync_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # all | gmail | slack | demo
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # completed | partial | failed | running
    messages_fetched: Mapped[int] = mapped_column(Integer, default=0)
    messages_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    tasks_extracted: Mapped[int] = mapped_column(Integer, default=0)
    error_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    default_reply_tone: Mapped[str] = mapped_column(String(50), default="professional")
    ai_provider: Mapped[str] = mapped_column(String(50), default="heuristic")
    ai_model_name: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")
    auto_extract_tasks: Mapped[bool] = mapped_column(Boolean, default=True)
    morning_brief_time: Mapped[str] = mapped_column(String(20), default="08:00")
    high_priority_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    demo_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="preferences")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="info")  # critical | warning | info | success
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

