import sys
import webbrowser
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

# Ensure backend package is importable when invoked from root or cli folder
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database.session import Base, SessionLocal, engine  # noqa: E402
from app.models.entities import Integration, Message, SyncHistory, Task  # noqa: E402
from app.services.workspace_service import (  # noqa: E402
    ensure_demo_workspace_seeded,
    generate_markdown_report,
    run_synchronization_and_triage,
)

app = typer.Typer(
    name="instantly",
    help="INSTANTLY — AI-Powered Communications Intelligence CLI",
    add_completion=False,
)
console = Console()


def _init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    ensure_demo_workspace_seeded(db)
    return db


@app.command("run")
def run_command():
    """Execute communication synchronization and AI triage across connected platforms."""
    db = _init_db()
    try:
        _, ws = ensure_demo_workspace_seeded(db)
        with Progress(
            SpinnerColumn(style="bold magenta"),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            t1 = progress.add_task("[violet]Synchronizing Gmail & Slack feeds...", total=None)
            sync_res = run_synchronization_and_triage(db, ws.id)
            progress.update(t1, completed=True)

        messages = (
            db.query(Message)
            .filter(Message.workspace_id == ws.id)
            .order_by(Message.received_at.desc())
            .all()
        )
        console.print(
            Panel.fit(
                f"[bold violet]INSTANTLY AI Triage Complete[/bold violet]\n"
                f"Workspace: [bold white]{ws.name}[/bold white] ({'DEMO DATA' if ws.is_demo else 'LIVE'})\n"
                f"Messages Processed: [bold cyan]{sync_res['messages_analyzed']}[/bold cyan]",
                border_style="violet",
            )
        )

        table = Table(title="Prioritized Communications Queue", show_lines=True)
        table.add_column("Urgency", style="bold")
        table.add_column("Platform", style="cyan")
        table.add_column("Sender", style="white")
        table.add_column("Subject / Channel", style="bright_white")
        table.add_column("AI Summary & Deadline", style="dim")

        for m in messages:
            urg = m.manual_priority_override or (m.ai_analysis.urgency if m.ai_analysis else "FYI_ONLY")
            summary = m.ai_analysis.one_sentence_summary if m.ai_analysis else m.preview
            deadline = f" [Deadline: {m.ai_analysis.deadline}]" if (m.ai_analysis and m.ai_analysis.deadline) else ""
            table.add_row(urg, m.source.upper(), m.sender_name, m.subject_or_channel, f"{summary}{deadline}")

        console.print(table)
    finally:
        db.close()


@app.command("sync")
def sync_command():
    """Synchronize connected communication services (Gmail & Slack)."""
    db = _init_db()
    try:
        _, ws = ensure_demo_workspace_seeded(db)
        res = run_synchronization_and_triage(db, ws.id)
        console.print(
            f"[bold green]✓ Synchronization succeeded[/bold green] — "
            f"Fetched: {res['messages_fetched']} | Analyzed: {res['messages_analyzed']} | Timestamp: {res['synced_at'].isoformat()}"
        )
    finally:
        db.close()


@app.command("status")
def status_command():
    """Show integration connection status, synchronization health, and queue metrics."""
    db = _init_db()
    try:
        _, ws = ensure_demo_workspace_seeded(db)
        integrations = db.query(Integration).filter(Integration.workspace_id == ws.id).all()
        tasks_pending = db.query(Task).filter(Task.workspace_id == ws.id, Task.status != "completed").count()
        last_sync = (
            db.query(SyncHistory)
            .filter(SyncHistory.workspace_id == ws.id)
            .order_by(SyncHistory.completed_at.desc())
            .first()
        )

        table = Table(title=f"INSTANTLY System & Integration Status — {ws.name}")
        table.add_column("Platform", style="bold violet")
        table.add_column("Connection Status", style="cyan")
        table.add_column("Account / Feed", style="white")
        table.add_column("Last Synced", style="dim")

        for i in integrations:
            last_str = i.last_synced_at.strftime("%Y-%m-%d %H:%M UTC") if i.last_synced_at else "Never"
            table.add_row(i.platform.upper(), i.status.upper(), i.account_identifier or "N/A", last_str)

        console.print(table)
        console.print(
            f"Open Action Items: [bold yellow]{tasks_pending}[/bold yellow] | "
            f"Last Sync Status: [bold green]{last_sync.status.upper() if last_sync else 'READY'}[/bold green]"
        )
    finally:
        db.close()


@app.command("report")
def report_command(
    output: Optional[Path] = typer.Option(
        default=Path("instantly-briefing-report.md"),
        help="File path where the Markdown executive briefing will be saved.",
    )
):
    """Generate and save the latest executive AI briefing in Markdown format."""
    db = _init_db()
    try:
        _, ws = ensure_demo_workspace_seeded(db)
        md_content = generate_markdown_report(db, ws.id)
        output_path = output or Path("instantly-briefing-report.md")
        output_path.write_text(md_content, encoding="utf-8")
        console.print(
            Panel.fit(
                f"[bold green]✓ Executive AI Briefing saved to:[/bold green] [underline]{output_path.resolve()}[/underline]",
                border_style="green",
            )
        )
    finally:
        db.close()


@app.command("serve")
def serve_command(
    port: int = typer.Option(default=8000, help="Port for the FastAPI backend server."),
    open_browser: bool = typer.Option(default=False, help="Open the web dashboard in default browser."),
):
    """Start the local FastAPI backend server or open the web dashboard."""
    import uvicorn

    if open_browser:
        webbrowser.open("http://localhost:3000")
    console.print(f"[bold violet]Starting INSTANTLY API Server on http://localhost:{port}[/bold violet]")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    app()

