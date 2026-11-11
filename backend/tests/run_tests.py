import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "cli"))

from tests.test_instantly_backend import (  # noqa: E402
    Base,
    TestClient,
    app,
    test_ai_engine_classification_and_injection_defense,
    test_authentication_and_permissions,
    test_cli_commands,
    test_duplicate_message_prevention,
    test_encryption_and_password_security,
    test_engine,
    test_gmail_oauth_callback_and_live_sync_lifecycle,
    test_health_endpoint,
    test_integrations_honest_credential_handling,
    test_overview_and_demo_seeding,
    test_reply_generation_and_task_lifecycle,
    test_unified_inbox_search_and_filters,
)


class InstantlyBackendTestSuite(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=test_engine)
        self.client = TestClient(app)

    def tearDown(self):
        Base.metadata.drop_all(bind=test_engine)

    def test_01_health(self):
        test_health_endpoint(self.client)

    def test_02_security(self):
        test_encryption_and_password_security()

    def test_03_ai_engine(self):
        test_ai_engine_classification_and_injection_defense()

    def test_04_overview(self):
        test_overview_and_demo_seeding(self.client)

    def test_05_inbox(self):
        test_unified_inbox_search_and_filters(self.client)

    def test_06_duplicate_prevention(self):
        test_duplicate_message_prevention()

    def test_07_replies_and_tasks(self):
        test_reply_generation_and_task_lifecycle(self.client)

    def test_08_auth_and_rbac(self):
        test_authentication_and_permissions(self.client)

    def test_09_integrations(self):
        test_integrations_honest_credential_handling(self.client)

    def test_09b_gmail_oauth_and_live_sync(self):
        test_gmail_oauth_callback_and_live_sync_lifecycle(self.client)

    def test_10_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            test_cli_commands(Path(tmp))


if __name__ == "__main__":
    unittest.main(verbosity=2)

