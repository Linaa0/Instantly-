# INSTANTLY — REST API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive OpenAPI / Swagger UI is served automatically at `http://localhost:8000/docs`.

## 1. Authentication & Session Management

- `POST /auth/register`: Register a new user account and attach to workspace. Returns JWT `access_token` and `UserOut`.
- `POST /auth/login`: Authenticate with email and password.
- `POST /auth/demo-session`: Initialize or resume the pre-seeded demonstration workspace session.
- `GET /auth/me`: Retrieve current authenticated user profile, workspace, and RBAC role.
- `POST /auth/logout`: Terminate current session.

## 2. Overview & Synchronization

- `GET /overview`: Returns calculated workspace metrics (`total_unread`, `urgent_messages`, `messages_requiring_response`, `completed_actions`, `pending_actions`), the structured 5-part `morning_brief`, 7-day `activity_series`, and `top_priority_messages`.
- `POST /sync`: Triggers communication synchronization and AI triage across connected feeds and logs a `SyncHistory` entry.
- `POST /demo/reset`: Safely restores the demonstration workspace to its clean initial 8-message state.

## 3. Unified Inbox & Message Intelligence

- `GET /messages`: List messages with query parameters:
  - `search`: Keyword query
  - `search_field`: `all | sender | subject | content`
  - `source`: `all | gmail | slack`
  - `urgency`: `ALL | IMMEDIATE | NEEDS_RESPONSE | IMPORTANT | FYI_ONLY | NO_ACTION`
  - `unread_only`: `true | false`
  - `sort_by`: `newest | oldest | priority`
- `GET /messages/{message_id}`: Retrieve full message details, original body, structured `ai_analysis`, `suggested_replies`, `assignments`, and `comments`.
- `PATCH /messages/{message_id}`: Update read status, star status, `priority_status` (`pending | completed | snoozed`), `custom_action_override`, or `manual_priority_override`.

## 4. AI Reply Assistant & Team Collaboration

- `POST /messages/{message_id}/generate-reply`: Generate a new contextual reply draft with `tone` (`professional | friendly | concise | custom`) and optional `custom_instructions`.
- `POST /messages/{message_id}/save-reply`: Save an edited reply draft and optionally stage a Gmail draft (`create_gmail_draft: true`).
- `POST /messages/{message_id}/assign`: Assign a communication to a workspace teammate.
- `POST /messages/{message_id}/comments`: Post an internal team comment on a communication.

## 5. Tasks & Follow-ups

- `GET /tasks`: List extracted and manual tasks (`status_filter`, `priority`).
- `POST /tasks`: Create a task with `title`, `description`, `priority`, `due_date_text`, `is_deadline_explicit`, and optional `message_id`.
- `PATCH /tasks/{task_id}`: Update task title, priority, due date, or status (`pending | completed | snoozed`).
- `DELETE /tasks/{task_id}`: Permanently delete a task.

## 6. Analytics, Reports, Integrations, Team & Settings

- `GET /analytics?range_days=7`: Retrieve database-computed analytics for Recharts visualizations.
- `GET /reports/export`: Generate and download a Markdown executive briefing report.
- `GET /integrations`: List Gmail and Slack connection status, scopes, and credential readiness.
- `POST /integrations/{platform}/connect`: Initiate real OAuth 2.0 flow or return honest missing-credential guidance.
- `POST /integrations/{platform}/disconnect`: Revoke stored credentials and disconnect platform.
- `GET /team` & `POST /team/invitations`: Inspect team workspace members, roles, assignments, audit log, and invite members.
- `GET /settings/preferences` & `PUT /settings/preferences`: Read and persist user and AI provider preferences.

