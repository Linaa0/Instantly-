# INSTANTLY — Security & AI Safety Architecture

## 1. Authentication & Authorization

- **Password Security**: User passwords are salted and hashed using `bcrypt` (`backend/app/security/auth.py`). Plaintext passwords are never logged or stored.
- **Session & JWT Tokens**: Signed HS256 JWT tokens with configurable expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`) authenticate API requests.
- **Role-Based Access Control (RBAC)**: Every workspace membership enforces `Owner`, `Admin`, or `Member` roles on the backend. Sensitive operations (such as inviting new workspace members) verify role permissions server-side.
- **Workspace Isolation**: All queries filter by `workspace_id` so cross-workspace data leakage is prevented.

## 2. Encrypted Credential Storage

- External OAuth access and refresh tokens are stored in a dedicated `integration_credentials` table separate from `integrations`.
- Tokens are encrypted at rest using symmetric **Fernet (AES-128-CBC + HMAC-SHA256)** encryption derived from `ENCRYPTION_KEY`.
- Disconnecting an integration deletes its `IntegrationCredential` record immediately.

## 3. Prompt Injection & Untrusted Content Defense

Incoming emails and Slack messages are treated as untrusted external payloads:
1. **Pre-Inference Sanitization**: `sanitize_untrusted_text()` (`backend/app/ai/engine.py`) scans incoming content for instruction-override patterns (`ignore all previous instructions`, `system prompt`, `developer mode`, etc.).
2. **Quarantine & Human Review Flag**: If an injection pattern is detected, the message is prevented from manipulating the LLM, flagged with `review_required = True`, and surfaced with a **Needs Human Review** badge in the UI.
3. **Strict Structural Validation**: All LLM responses must pass `Pydantic` validation (`StructuredLLMOutput` / `AIAnalysisSchema`) via `instructor`.
4. **No Automatic Sending**: The AI Reply Assistant never transmits emails or Slack messages autonomously. Creating a live Gmail draft requires explicit user confirmation.

