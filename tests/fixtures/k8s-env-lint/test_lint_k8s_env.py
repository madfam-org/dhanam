"""
Unit tests for scripts/lint-k8s-env.py.

Run from repo root:
    python3 tests/fixtures/k8s-env-lint/test_lint_k8s_env.py

Or with unittest:
    python3 -m unittest discover -s tests/fixtures/k8s-env-lint -p 'test_*.py'

Asserts:
- valid.yaml: zero violations, exit 0
- invalid.yaml: two violations (METAMAP_CLIENT_ID + LEGACY_FLAG), exit 1
"""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts" / "lint-k8s-env.py"
FIXTURES = Path(__file__).resolve().parent


def _run(*paths):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *(str(p) for p in paths)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )


class LintK8sEnvTests(unittest.TestCase):
    def test_valid_fixture_has_no_violations(self):
        result = _run(FIXTURES / "valid.yaml")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_invalid_fixture_reports_both_violations_and_exits_nonzero(self):
        result = _run(FIXTURES / "invalid.yaml")
        self.assertEqual(result.returncode, 1, result.stderr or result.stdout)
        # Both violations are reported.
        self.assertIn("METAMAP_CLIENT_ID", result.stderr)
        self.assertIn('container "api"', result.stderr)
        self.assertIn("LEGACY_FLAG", result.stderr)
        self.assertIn('container "cron"', result.stderr)
        self.assertIn("has both 'value' and 'valueFrom'", result.stderr)
        self.assertIn("2 violation(s) found", result.stderr)

    def test_directory_walk_picks_up_both_fixtures(self):
        result = _run(FIXTURES)
        # invalid.yaml present → exit 1, valid.yaml clean → only invalid violations.
        self.assertEqual(result.returncode, 1, result.stderr or result.stdout)
        self.assertEqual(result.stderr.count("has both 'value' and 'valueFrom'"), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
