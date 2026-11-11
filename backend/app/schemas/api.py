from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

UrgencyCategory = Literal["IMMEDIATE", "NEEDS_RESPONSE", "IMPORTANT", "FYI_ONLY", "NO_ACTION"]


class AIAnalysisSchema(BaseModel):
    message_id: str
    source: str
    sender: str
    subject_or_channel: str
    received_at: datetime
    urgency: UrgencyCategory
    confidence_score: float = Field(ge=0.0, le=1.0)
    one_sentence_summary: str
    detailed_summary: str
    classification_reason: str
    requires_action: bool
    action_description: Optional[str] = None
    deadline: Optional[str] = None
    deadline_is_explicit: bool = True
    deadline_confidence: Optional[float] = None
    suggested_reply: Optional[str] = None
    detected_entities: list[str] = Field(default_factory=list)
    review_required: bool = False
    provider_used: str = "heuristic"

    model_config = ConfigDict(from_attributes=True)


class SuggestedReplyOut(BaseModel):
    id: str
    message_id: str
    tone: str
    custom_instructions: Optional[str] = None
    content: str
    is_saved_draft: bool
    gmail_draft_created: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReplyGenerationRequest(BaseModel):
    tone: Literal["professional", "friendly", "concise", "custom"] = "professional"
    custom_instructions: Optional[str] = None
    channel: Optional[Literal["gmail", "slack"]] = None


class ReplySaveRequest(BaseModel):
    tone: str = "professional"
    content: str
    create_gmail_draft: bool = False


class ReplySendRequest(BaseModel):
    channel: Literal["gmail", "slack"] = "gmail"
    recipient: Optional[str] = None
    subject: Optional[str] = None
    content: str = Field(..., min_length=1)
    tone: str = "professional"


class ReplySendOut(BaseModel):
    status: str
    channel: str
    recipient: str
    subject: Optional[str] = None
    content: str
    external_delivery: bool = False
    compose_url: Optional[str] = None
    message: str


class InternalCommentOut(BaseModel):
    id: str
    message_id: str
    author_name: str
    author_role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommentCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class AssignmentOut(BaseModel):
    id: str
    message_id: str
    assignee_name: str
    assignee_email: str
    assigned_by_name: str
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignmentCreateRequest(BaseModel):
    assignee_name: str
    assignee_email: str
    note: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    workspace_id: str
    conversation_id: Optional[str] = None
    external_id: str
    source: str
    sender_name: str
    sender_email_or_handle: str
    sender_avatar: Optional[str] = None
    subject_or_channel: str
    preview: str
    body: str
    received_at: datetime
    is_unread: bool
    is_starred: bool
    is_demo: bool
    priority_status: str
    snoozed_until: Optional[datetime] = None
    custom_action_override: Optional[str] = None
    manual_priority_override: Optional[str] = None
    effective_urgency: str
    effective_action_description: Optional[str] = None
    ai_analysis: Optional[AIAnalysisSchema] = None
    suggested_replies: list[SuggestedReplyOut] = Field(default_factory=list)
    assignments: list[AssignmentOut] = Field(default_factory=list)
    comments: list[InternalCommentOut] = Field(default_factory=list)
    thread_messages_count: int = 1

    model_config = ConfigDict(from_attributes=True)


class MessageUpdateRequest(BaseModel):
    is_unread: Optional[bool] = None
    is_starred: Optional[bool] = None
    priority_status: Optional[Literal["pending", "completed", "snoozed", "ignored"]] = None
    snooze_hours: Optional[int] = None
    custom_action_override: Optional[str] = None
    manual_priority_override: Optional[UrgencyCategory] = None


class TaskOut(BaseModel):
    id: str
    workspace_id: str
    message_id: Optional[str] = None
    message_subject: Optional[str] = None
    message_sender: Optional[str] = None
    message_source: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    due_date_text: Optional[str] = None
    due_at: Optional[datetime] = None
    is_deadline_explicit: bool
    snoozed_until: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    is_demo: bool
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    description: Optional[str] = None
    priority: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "HIGH"
    due_date_text: Optional[str] = None
    is_deadline_explicit: bool = True
    message_id: Optional[str] = None
    assigned_to_name: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]] = None
    status: Optional[Literal["pending", "in_progress", "completed", "snoozed"]] = None
    due_date_text: Optional[str] = None
    is_deadline_explicit: Optional[bool] = None
    snooze_hours: Optional[int] = None
    assigned_to_name: Optional[str] = None


class MorningBriefSection(BaseModel):
    important_developments: list[str]
    critical_priorities: list[str]
    outstanding_requests: list[str]
    upcoming_deadlines: list[str]
    recommended_next_steps: list[str]
    executive_headline: str
    focus_score: int
    generated_at: datetime


class ActivityPoint(BaseModel):
    label: str
    gmail: int
    slack: int
    urgent: int
    total: int


class DashboardOverviewOut(BaseModel):
    total_messages: int
    total_unread: int
    urgent_messages: int
    messages_requiring_response: int
    important_informational: int
    completed_actions: int
    pending_actions: int
    connected_platforms: list[str]
    demo_mode_active: bool
    last_sync_at: Optional[datetime] = None
    morning_brief: MorningBriefSection
    activity_series: list[ActivityPoint]
    top_priority_messages: list[MessageOut]


class AnalyticsOut(BaseModel):
    range_days: int
    demo_mode_active: bool
    total_messages: int
    messages_requiring_response: int
    response_rate_ready_pct: float
    completed_tasks: int
    pending_tasks: int
    snoozed_tasks: int
    avg_ai_confidence: float
    review_required_count: int
    platform_breakdown: list[dict]
    urgency_distribution: list[dict]
    daily_activity: list[ActivityPoint]
    weekly_comparison: list[dict]
    classification_stats: list[dict]


class IntegrationStatusOut(BaseModel):
    id: str
    platform: str
    status: str
    account_identifier: Optional[str] = None
    scopes: list[str]
    last_synced_at: Optional[datetime] = None
    error_message: Optional[str] = None
    credentials_configured: bool
    configuration_instructions: str


class AuthRegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    workspace_name: Optional[str] = "Apex Product Workspace"


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None
    workspace_id: str
    workspace_name: str
    role: str
    is_demo: bool


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserPreferenceOut(BaseModel):
    default_reply_tone: str
    ai_provider: str
    ai_model_name: str
    auto_extract_tasks: bool
    morning_brief_time: str
    high_priority_notifications: bool
    demo_mode_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class UserPreferenceUpdateRequest(BaseModel):
    default_reply_tone: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model_name: Optional[str] = None
    auto_extract_tasks: Optional[bool] = None
    morning_brief_time: Optional[str] = None
    high_priority_notifications: Optional[bool] = None
    demo_mode_enabled: Optional[bool] = None
    full_name: Optional[str] = None
    job_title: Optional[str] = None


class TeamMemberOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    job_title: Optional[str] = None
    role: str
    status: str
    joined_at: datetime
    assigned_count: int = 0


class TeamInvitationCreateRequest(BaseModel):
    email: EmailStr
    role: Literal["Owner", "Admin", "Member"] = "Member"


class TeamWorkspaceOut(BaseModel):
    workspace_id: str
    workspace_name: str
    workspace_slug: str
    is_demo: bool
    members: list[TeamMemberOut]
    invitations: list[dict]
    recent_assignments: list[AssignmentOut]
    recent_comments: list[InternalCommentOut]
    audit_log: list[dict]

