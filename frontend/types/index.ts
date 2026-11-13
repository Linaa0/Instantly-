export type UrgencyCategory =
  | "IMMEDIATE"
  | "NEEDS_RESPONSE"
  | "IMPORTANT"
  | "FYI_ONLY"
  | "NO_ACTION";

export interface AIAnalysis {
  message_id: string;
  source: string;
  sender: string;
  subject_or_channel: string;
  received_at: string;
  urgency: UrgencyCategory;
  confidence_score: number;
  one_sentence_summary: string;
  detailed_summary: string;
  classification_reason: string;
  requires_action: boolean;
  action_description?: string | null;
  deadline?: string | null;
  deadline_is_explicit: boolean;
  deadline_confidence?: number | null;
  suggested_reply?: string | null;
  detected_entities: string[];
  review_required: boolean;
  provider_used: string;
}

export interface SuggestedReply {
  id: string;
  message_id: string;
  tone: string;
  custom_instructions?: string | null;
  content: string;
  is_saved_draft: boolean;
  gmail_draft_created: boolean;
  created_at: string;
}

export interface InternalComment {
  id: string;
  message_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
}

export interface MessageAssignment {
  id: string;
  message_id: string;
  assignee_name: string;
  assignee_email: string;
  assigned_by_name: string;
  note?: string | null;
  created_at: string;
}

export interface MessageItem {
  id: string;
  workspace_id: string;
  conversation_id?: string | null;
  external_id: string;
  source: "gmail" | "slack";
  sender_name: string;
  sender_email_or_handle: string;
  sender_avatar?: string | null;
  subject_or_channel: string;
  preview: string;
  body: string;
  received_at: string;
  is_unread: boolean;
  is_starred: boolean;
  is_demo: boolean;
  priority_status: "pending" | "completed" | "snoozed" | "ignored";
  snoozed_until?: string | null;
  custom_action_override?: string | null;
  manual_priority_override?: UrgencyCategory | null;
  effective_urgency: UrgencyCategory;
  effective_action_description?: string | null;
  ai_analysis?: AIAnalysis | null;
  suggested_replies: SuggestedReply[];
  assignments: MessageAssignment[];
  comments: InternalComment[];
  thread_messages_count: number;
}

export interface TaskItem {
  id: string;
  workspace_id: string;
  message_id?: string | null;
  message_subject?: string | null;
  message_sender?: string | null;
  message_source?: string | null;
  title: string;
  description?: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "pending" | "in_progress" | "completed" | "snoozed";
  due_date_text?: string | null;
  due_at?: string | null;
  is_deadline_explicit: boolean;
  snoozed_until?: string | null;
  assigned_to_name?: string | null;
  is_demo: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface MorningBrief {
  important_developments: string[];
  critical_priorities: string[];
  outstanding_requests: string[];
  upcoming_deadlines: string[];
  recommended_next_steps: string[];
  executive_headline: string;
  focus_score: number;
  generated_at: string;
}

export interface ActivityPoint {
  label: string;
  gmail: number;
  slack: number;
  urgent: number;
  total: number;
}

export interface DashboardOverview {
  total_messages: number;
  total_unread: number;
  urgent_messages: number;
  messages_requiring_response: number;
  important_informational: number;
  completed_actions: number;
  pending_actions: number;
  connected_platforms: string[];
  demo_mode_active: boolean;
  last_sync_at?: string | null;
  morning_brief: MorningBrief;
  activity_series: ActivityPoint[];
  top_priority_messages: MessageItem[];
}

export interface AnalyticsData {
  range_days: number;
  demo_mode_active: boolean;
  total_messages: number;
  messages_requiring_response: number;
  response_rate_ready_pct: number;
  completed_tasks: number;
  pending_tasks: number;
  snoozed_tasks: number;
  avg_ai_confidence: number;
  review_required_count: number;
  platform_breakdown: { name: string; count: number; fill: string }[];
  urgency_distribution: {
    category: string;
    code: UrgencyCategory;
    count: number;
    color: string;
  }[];
  daily_activity: ActivityPoint[];
  weekly_comparison: {
    period: string;
    received: number;
    triaged: number;
    actions_completed: number;
  }[];
  classification_stats: {
    category: string;
    count: number;
    avg_confidence: number;
    requires_action: boolean;
  }[];
}

export interface IntegrationStatus {
  id: string;
  platform: "gmail" | "slack";
  status: "connected" | "disconnected" | "error" | "needs_reconnect" | "demo";
  account_identifier?: string | null;
  scopes: string[];
  last_synced_at?: string | null;
  error_message?: string | null;
  credentials_configured: boolean;
  configuration_instructions: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  job_title?: string | null;
  avatar_url?: string | null;
  workspace_id: string;
  workspace_name: string;
  role: string;
  is_demo: boolean;
  email_verified?: boolean;
}

export interface AuthRegisterResult {
  status: string;
  email: string;
  message: string;
  expires_in_seconds?: number;
  debug_otp?: string | null;
  access_token?: string;
  token_type?: string;
  user?: UserProfile;
}

export interface OTPResponse {
  status: string;
  email: string;
  message: string;
  expires_in_seconds?: number;
  debug_otp?: string | null;
}

export interface UserPreferences {
  default_reply_tone: string;
  ai_provider: string;
  ai_model_name: string;
  auto_extract_tasks: boolean;
  morning_brief_time: string;
  high_priority_notifications: boolean;
  demo_mode_enabled: boolean;
}

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title?: string | null;
  role: string;
  status: string;
  joined_at: string;
  assigned_count: number;
}

export interface TeamWorkspaceData {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  is_demo: boolean;
  members: TeamMember[];
  invitations: {
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
  }[];
  recent_assignments: MessageAssignment[];
  recent_comments: InternalComment[];
  audit_log: {
    id: string;
    actor_name: string;
    event_type: string;
    description: string;
    created_at: string;
  }[];
}

