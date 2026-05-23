#!/usr/bin/env python3
"""
Public repository leakage guard.

Fails CI when banned operator secrets, real MADFAM identifiers, or
infrastructure topology literals appear in tracked source/docs.

See docs/PUBLIC_REPO_SECURITY_REMEDIATION.md.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".turbo",
    "generated",
}

SKIP_FILES = {
    "pnpm-lock.yaml",
    "PUBLIC_REPO_SECURITY_REMEDIATION.md",
    "check-public-repo-leakage.py",
}

# Paths where synthetic test fixtures may reference banned literals.
ALLOWLIST_SUBSTRINGS = (
    "/__tests__/",
    ".spec.ts",
    ".test.ts",
    ".test.tsx",
    "docs/reports/historical/",
)

# Agent context docs scheduled for Phase 2 slim-down (operator email only).
PHASE2_DOC_ALLOWLIST = {
    "AGENTS.md",
    "CLAUDE.md",
    "llms.txt",
    "llms-full.txt",
}

RULES: list[tuple[str, re.Pattern[str]]] = [
    ("real business RFC (IMA2501164Y7)", re.compile(r"IMA2501164Y7")),
    ("real personal RFC (RULA900317GPA)", re.compile(r"RULA900317GPA")),
    ("insecure HMAC fallback", re.compile(r"default-hmac-key")),
    ("plaintext demo password literal", re.compile(r"(?<![A-Z_])demo123(?![A-Z_])")),
    ("plaintext madfam password literal", re.compile(r"madfam123")),
    ("Hetzner node codename foundry-cp", re.compile(r"foundry-cp")),
    ("Hetzner node codename foundry-worker", re.compile(r"foundry-worker-01")),
    ("Hetzner node codename foundry-builder", re.compile(r"foundry-builder-01")),
]

SCRIPT_OPERATOR_EMAIL = re.compile(
    r"admin@madfam\.io",
    re.IGNORECASE,
)


def should_scan(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    if path.name in SKIP_FILES or rel in SKIP_FILES:
        return False
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    if path.suffix not in {
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".md",
        ".yaml",
        ".yml",
        ".json",
        ".py",
        ".sh",
    }:
        return False
    return True


def is_allowlisted(rel: str) -> bool:
    if any(token in rel for token in ALLOWLIST_SUBSTRINGS):
        return True
    basename = rel.rsplit("/", 1)[-1]
    return basename in PHASE2_DOC_ALLOWLIST


def is_operator_script(rel: str) -> bool:
    return rel.startswith("apps/api/scripts/") or rel.startswith("scripts/")


def scan_file(path: Path) -> list[str]:
    rel = path.relative_to(ROOT).as_posix()
    if is_allowlisted(rel):
        return []

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []

    hits: list[str] = []
    for label, pattern in RULES:
        if pattern.search(text):
            hits.append(f"{rel}: banned {label}")

    if is_operator_script(rel) and SCRIPT_OPERATOR_EMAIL.search(text):
        hits.append(f"{rel}: hardcoded admin@madfam.io in operator script")

    return hits


def main() -> int:
    violations: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or not should_scan(path):
            continue
        violations.extend(scan_file(path))

    if violations:
        print("Public repo leakage check FAILED:\n", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
        print(
            "\nSee docs/PUBLIC_REPO_SECURITY_REMEDIATION.md for remediation guidance.",
            file=sys.stderr,
        )
        return 1

    print("Public repo leakage check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
