import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def wait_for_url(url: str, timeout: int = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status < 500:
                    return True
        except Exception:
            pass
        time.sleep(1.5)
    return False


def main() -> int:
    print("Starting FastAPI backend on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(BACKEND_DIR),
    )

    print("Starting Next.js frontend on port 3000...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
    )

    try:
        if not wait_for_url("http://127.0.0.1:8000/health", timeout=45):
            print("Backend failed to become ready on port 8000.")
            return 1
        print("Backend is healthy!")

        if not wait_for_url("http://localhost:3000/login", timeout=90):
            print("Frontend failed to become ready on port 3000.")
            return 1
        print("Frontend is ready!")

        npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
        res = subprocess.run(
            [npx_cmd, "playwright", "test"],
            cwd=str(FRONTEND_DIR),
        )
        return res.returncode
    finally:
        print("Stopping servers...")
        frontend_proc.terminate()
        backend_proc.terminate()
        try:
            frontend_proc.wait(timeout=5)
            backend_proc.wait(timeout=5)
        except Exception:
            frontend_proc.kill()
            backend_proc.kill()


if __name__ == "__main__":
    sys.exit(main())

