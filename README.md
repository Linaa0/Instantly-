# INSTANTLY

> **"Your communications. Intelligent. Instantly."**
>
> **AI-Powered Communications Intelligence and Productivity Platform**

Instantly consolidates communications across **Gmail** and **Slack**, analyzes their urgency using structured AI (`Instructor` + `Pydantic`), surfaces executive daily briefings, extracts explicit and AI-inferred deadlines into a unified task queue, and drafts context-aware replies.

---

## 1. Core Features

- **Overview Command Center ("Your day, in focus.")**: Real-time KPI cards, 5-part AI Executive Daily Briefing, Workspace Focus Score, and 7-day communication activity chart.
- **Unified Inbox**: Master-detail triage interface for Gmail and Slack supporting search by sender/subject/content, urgency filtering, source filtering, read/star controls, and separated original vs. AI analysis panels.
- **AI Brief**: Communications organized into 5 structured urgency tiers (`IMMEDIATE`, `NEEDS_RESPONSE`, `IMPORTANT`, `FYI_ONLY`, `NO_ACTION`) with classification rationales, confidence scores, and human-review indicators for ambiguous or flagged threads.
- **Actionable Priority Queue**: Dedicated execution queue separating AI analysis completion from human task completion, with inline action editing, manual priority overrides, snoozing, and teammate assignment.
- **AI Reply Assistant**: Generates editable reply drafts in `Professional`, `Friendly`, `Concise`, or `Custom` tones with one-click copy, draft saving, and explicit confirmation before staging Gmail drafts.
- **Tasks & Follow-ups**: Extracted and manual tasks distinguishing **Explicit Deadlines** from **AI-Inferred Dates**, linked directly to source communications.
- **Analytics Workspace**: Recharts visualizations (Area, Bar, Donut) computed from stored database records with 7/30/90-day range filtering and Markdown briefing export.
- **Platform Integrations**: Honest Gmail and Slack OAuth 2.0 management with least-privilege scopes, Fernet-encrypted credentials, and zero fake connections.
- **Team Collaboration & RBAC**: Multi-user workspace memberships (`Owner`, `Admin`, `Member`), invitations, message assignments, internal thread comments, and security audit logging.
- **First-Class CLI**: `instantly run`, `instantly serve`, `instantly sync`, `instantly report`, and `instantly status` powered by `Typer` and `Rich`.

---

## 2. Architecture & Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript (Strict), Tailwind CSS, Lucide React, TanStack Query, Recharts |
| **Backend** | Python, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| **Database** | PostgreSQL 16 (production / Docker) & SQLite (zero-config local persistence) |
| **AI Engine** | Instructor, Pydantic Structured Outputs, OpenAI / Groq / Deterministic Local Engine |
| **Security** | Bcrypt password hashing, HS256 JWT sessions, Fernet symmetric token encryption, prompt-injection sanitization |
| **CLI** | Typer, Rich |
| **Testing** | Pytest, Vitest, Testing Library, Playwright E2E |

See detailed documentation in:
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api.md`](docs/api.md)
- [`docs/security.md`](docs/security.md)
- [`docs/setup.md`](docs/setup.md)

---

## 3. Quick Start & Installation

### Option A: Local Development (Zero External Credentials Required)

1. **Clone & Configure Environment**
   ```bash
   cp .env.example .env
   ```

2. **Install & Start Backend (Port 8000)**
   ```bash
   cd backend
   uv pip install --system -e ".[dev]"
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Install & Start Frontend (Port 3000)**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Explore the Application**
   - Open `http://localhost:3000` (or `http://localhost:3000/login` to test authentication or click **Launch Interactive Demo Workspace**).

### Option B: Docker Compose (PostgreSQL + Redis + Backend + Frontend)

```bash
docker compose up --build
```

---

## 4. CLI Usage

Run from the repository root (with `PYTHONPATH=backend;cli`):

```bash
python -m instantly_cli.main status
python -m instantly_cli.main run
python -m instantly_cli.main sync
python -m instantly_cli.main report --output executive-briefing.md
python -m instantly_cli.main serve --port 8000
```

---

## 5. Running Automated Tests

### Backend Tests (`pytest`)
```bash
cd backend
pytest -v
```

### Frontend Unit & Component Tests (`vitest`) + Typecheck + Lint
```bash
cd frontend
npm run typecheck
npm run lint
npm run test
```

### End-to-End Browser Tests (`playwright`)
```bash
cd frontend
npx playwright test
```

---

## 6. Known Limitations & Next Steps

- **Live OAuth Credentials**: Gmail (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and Slack (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`) require developer app credentials in `.env` to perform live OAuth handshakes. Without them, Instantly clearly explains what environment variables are needed and serves the labeled **DEMO DATA** workspace.
- **Email Delivery for Team Invitations**: Workspace invitations are persisted in the database (`workspace_invitations`) and logged in the security audit trail; connecting an outbound transactional SMTP provider (e.g., Resend/SendGrid) is the recommended next step for production deployment.

