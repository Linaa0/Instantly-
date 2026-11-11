# INSTANTLY — Developer Setup & Live Integration Guide

## 1. Prerequisites

- **Python**: 3.11+ (tested with Python 3.12 / 3.14) and `uv`
- **Node.js**: 20+ / 22+ and `npm`
- **Database**: SQLite works out of the box for local development (`sqlite:///./instantly.db`); PostgreSQL 16 and Redis 7 are pre-configured in `docker-compose.yml`.

## 2. Environment Configuration

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

All demonstration features work immediately without external API keys (`DEMO_MODE=true`, `AI_PROVIDER=heuristic`).

## 3. Starting the Backend (FastAPI)

```bash
cd backend
uv pip install --system -e ".[dev]"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 4. Starting the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## 5. Using the CLI

```bash
python -m instantly_cli.main status
python -m instantly_cli.main run
python -m instantly_cli.main sync
python -m instantly_cli.main report --output briefing.md
python -m instantly_cli.main serve
```

## 6. Configuring Live Gmail OAuth 2.0

1. Open the Google Cloud Console and create an OAuth 2.0 Client ID (Web Application).
2. Enable the **Gmail API**.
3. Add `http://localhost:8000/api/v1/integrations/gmail/callback` as an Authorized Redirect URI.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
5. Navigate to **Integrations** in Instantly and click **Authorize Live Google OAuth**.

## 7. Configuring Live Slack OAuth 2.0

1. Create a Slack App at `https://api.slack.com/apps`.
2. Add Bot Token Scopes: `channels:history`, `channels:read`, `groups:history`, `im:history`, `users:read`.
3. Add Redirect URL: `http://localhost:8000/api/v1/integrations/slack/callback`.
4. Set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` (or `SLACK_BOT_TOKEN`) in `.env`.

