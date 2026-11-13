import {
  AnalyticsData,
  DashboardOverview,
  IntegrationStatus,
  InternalComment,
  MessageAssignment,
  MessageItem,
  SuggestedReply,
  TaskItem,
  TeamWorkspaceData,
  UrgencyCategory,
  UserPreferences,
  UserProfile,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("instantly_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let errDetail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errDetail = errJson.detail;
    } catch {
      // ignore json parse error
    }
    throw new Error(errDetail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: UserProfile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, full_name: string, password: string) =>
    request<{ access_token: string; user: UserProfile }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, full_name, password }),
    }),
  startDemoSession: () =>
    request<{ access_token: string; user: UserProfile }>("/auth/demo-session", {
      method: "POST",
    }),
  getMe: () => request<UserProfile>("/auth/me"),
  logout: () =>
    request<{ status: string }>("/auth/logout", {
      method: "POST",
    }),

  // Overview & Sync
  getOverview: () => request<DashboardOverview>("/overview"),
  triggerSync: () =>
    request<{ status: string; messages_fetched: number; messages_analyzed: number; synced_at: string }>("/sync", {
      method: "POST",
    }),
  resetDemo: () =>
    request<{ status: string; message: string }>("/demo/reset", {
      method: "POST",
    }),
  purgeDemo: () =>
    request<{ status: string; message: string }>("/workspace/purge-demo", {
      method: "POST",
    }),

  // Messages & Inbox
  getMessages: (params?: {
    search?: string;
    search_field?: string;
    source?: string;
    urgency?: string;
    unread_only?: boolean;
    requires_action_only?: boolean;
    sort_by?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.search_field) query.set("search_field", params.search_field);
    if (params?.source && params.source !== "all") query.set("source", params.source);
    if (params?.urgency && params.urgency !== "ALL") query.set("urgency", params.urgency);
    if (params?.unread_only) query.set("unread_only", "true");
    if (params?.requires_action_only) query.set("requires_action_only", "true");
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    const qs = query.toString();
    return request<MessageItem[]>(`/messages${qs ? `?${qs}` : ""}`);
  },
  getMessage: (id: string) => request<MessageItem>(`/messages/${id}`),
  updateMessage: (
    id: string,
    payload: {
      is_unread?: boolean;
      is_starred?: boolean;
      priority_status?: "pending" | "completed" | "snoozed" | "ignored";
      snooze_hours?: number;
      custom_action_override?: string;
      manual_priority_override?: UrgencyCategory;
    }
  ) =>
    request<MessageItem>(`/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // AI Reply Assistant
  generateReply: (
    messageId: string,
    tone: "professional" | "friendly" | "concise" | "custom",
    custom_instructions?: string,
    channel?: "gmail" | "slack"
  ) =>
    request<SuggestedReply>(`/messages/${messageId}/generate-reply`, {
      method: "POST",
      body: JSON.stringify({ tone, custom_instructions, channel }),
    }),
  saveReply: (
    messageId: string,
    tone: string,
    content: string,
    create_gmail_draft = false
  ) =>
    request<SuggestedReply>(`/messages/${messageId}/save-reply`, {
      method: "POST",
      body: JSON.stringify({ tone, content, create_gmail_draft }),
    }),
  sendReply: (
    messageId: string,
    payload: {
      channel: "gmail" | "slack";
      recipient?: string;
      subject?: string;
      content: string;
      tone?: string;
    }
  ) =>
    request<{
      status: string;
      channel: string;
      recipient: string;
      subject?: string | null;
      content: string;
      external_delivery: boolean;
      compose_url?: string | null;
      message: string;
    }>(`/messages/${messageId}/send-reply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Message Team Collaboration
  assignMessage: (
    messageId: string,
    assignee_name: string,
    assignee_email: string,
    note?: string
  ) =>
    request<MessageAssignment>(`/messages/${messageId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignee_name, assignee_email, note }),
    }),
  addComment: (messageId: string, content: string) =>
    request<InternalComment>(`/messages/${messageId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // Tasks & Follow-ups
  getTasks: (status_filter?: string, priority?: string) => {
    const query = new URLSearchParams();
    if (status_filter && status_filter !== "all") query.set("status_filter", status_filter);
    if (priority && priority !== "ALL") query.set("priority", priority);
    const qs = query.toString();
    return request<TaskItem[]>(`/tasks${qs ? `?${qs}` : ""}`);
  },
  createTask: (payload: {
    title: string;
    description?: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    due_date_text?: string;
    is_deadline_explicit?: boolean;
    message_id?: string;
    assigned_to_name?: string;
  }) =>
    request<TaskItem>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTask: (
    id: string,
    payload: {
      title?: string;
      description?: string | null;
      priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      status?: "pending" | "in_progress" | "completed" | "snoozed";
      due_date_text?: string | null;
      is_deadline_explicit?: boolean;
      snooze_hours?: number;
      assigned_to_name?: string | null;
    }
  ) =>
    request<TaskItem>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTask: (id: string) =>
    request<{ status: string; id: string }>(`/tasks/${id}`, {
      method: "DELETE",
    }),

  // Analytics & Report
  getAnalytics: (range_days = 7) =>
    request<AnalyticsData>(`/analytics?range_days=${range_days}`),
  exportReport: () =>
    request<{ filename: string; content: string; generated_at: string }>(
      "/reports/export"
    ),

  // Integrations
  getIntegrations: () => request<IntegrationStatus[]>("/integrations"),
  connectIntegration: (platform: "gmail" | "slack") =>
    request<{
      connected: boolean;
      requires_credentials: boolean;
      authorization_url?: string | null;
      message?: string;
    }>(`/integrations/${platform}/connect`, {
      method: "POST",
    }),
  disconnectIntegration: (platform: "gmail" | "slack") =>
    request<{ status: string }>(`/integrations/${platform}/disconnect`, {
      method: "POST",
    }),
  restoreDemoIntegration: (platform: "gmail" | "slack") =>
    request<{ status: string }>(`/integrations/${platform}/restore-demo`, {
      method: "POST",
    }),

  // Team & Notifications & Settings
  getTeam: () => request<TeamWorkspaceData>("/team"),
  inviteTeamMember: (email: string, role: "Owner" | "Admin" | "Member") =>
    request<{ id: string; email: string; role: string; status: string }>(
      "/team/invitations",
      {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }
    ),
  getNotifications: () =>
    request<
      {
        id: string;
        title: string;
        body: string;
        severity: string;
        is_read: boolean;
        link?: string;
        created_at: string;
      }[]
    >("/notifications"),
  markNotificationsRead: () =>
    request<{ status: string }>("/notifications/mark-all-read", {
      method: "POST",
    }),
  getPreferences: () => request<UserPreferences>("/settings/preferences"),
  updatePreferences: (payload: Partial<UserPreferences> & { full_name?: string; job_title?: string }) =>
    request<UserPreferences>("/settings/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

