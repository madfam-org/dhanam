"""
Regression guard for Dhanam web Docker builds that consume private packages.

Run from repo root:
    python3 -m unittest discover -s tests/fixtures -p 'test_*.py' -v
"""
from __future__ import annotations

import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_DOCKERFILE = REPO_ROOT / "apps" / "web" / "Dockerfile"
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
SECRET_REF = "npm_madfam_token=${{ secrets.NPM_MADFAM_TOKEN }}"


class WebDockerNpmAuthTests(unittest.TestCase):
    def test_web_dockerfile_uses_buildkit_secret_for_private_registry(self):
        dockerfile = WEB_DOCKERFILE.read_text(encoding="utf-8")

        self.assertTrue(
            dockerfile.startswith("# syntax=docker/dockerfile:"),
            "BuildKit syntax is required for RUN --mount=type=secret",
        )
        self.assertIn(
            "RUN --mount=type=secret,id=npm_madfam_token,required=true",
            dockerfile,
        )
        self.assertIn("//npm.madfam.io/:_authToken=%s", dockerfile)
        self.assertNotIn("ARG NPM_MADFAM_TOKEN", dockerfile)
        self.assertNotIn("ENV NPM_MADFAM_TOKEN", dockerfile)

    def test_every_web_docker_build_workflow_passes_npm_secret(self):
        workflow_files = sorted(WORKFLOWS_DIR.glob("*.yml"))
        web_build_workflows: list[Path] = []

        for workflow in workflow_files:
            text = workflow.read_text(encoding="utf-8")
            if "apps/web/Dockerfile" not in text:
                continue
            web_build_workflows.append(workflow)
            self.assertIn(
                SECRET_REF,
                text,
                f"{workflow.relative_to(REPO_ROOT)} builds apps/web/Dockerfile without the npm secret",
            )
            self.assertNotIn(
                "NPM_MADFAM_TOKEN=${{ secrets.NPM_MADFAM_TOKEN }}",
                text,
                f"{workflow.relative_to(REPO_ROOT)} must not pass npm auth as a Docker build arg",
            )

        self.assertGreaterEqual(
            len(web_build_workflows),
            1,
            "Expected at least one workflow to build apps/web/Dockerfile",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
