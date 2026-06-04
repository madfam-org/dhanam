"""
Regression guard for Playwright API startup environment.

Run from repo root:
    python3 -m unittest discover -s tests/fixtures/workflow-guards -p 'test_*.py' -v
"""
from __future__ import annotations

import unittest
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ENV_EXAMPLE = REPO_ROOT / "apps" / "api" / ".env.example"
CI_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"
POSTHOG_HOST = "https://analytics.madfam.io"


def _read_env_value(path: Path, key: str) -> str | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None


class PlaywrightApiEnvTests(unittest.TestCase):
    def test_api_env_example_posthog_host_is_valid_uri(self):
        value = _read_env_value(API_ENV_EXAMPLE, "POSTHOG_HOST")

        self.assertIsNotNone(value)
        parsed = urlparse(value or "")
        self.assertIn(parsed.scheme, {"http", "https"})
        self.assertTrue(parsed.netloc)

    def test_playwright_jobs_override_posthog_host_after_copying_example_env(self):
        workflow = CI_WORKFLOW.read_text(encoding="utf-8")
        posthog_override = f'echo "POSTHOG_HOST={POSTHOG_HOST}" >> apps/api/.env'

        self.assertGreaterEqual(
            workflow.count(posthog_override),
            2,
            "Both web and admin Playwright jobs must provide a valid POSTHOG_HOST",
        )
        self.assertNotIn("POSTHOG_HOST=replace-with-posthog-host", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
