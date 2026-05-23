#!/usr/bin/env python3
"""Check relative markdown links in documentation entrypoints."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINK_RE = re.compile(r"\]\(([^)#]+)(?:#[^)]+)?\)")

PRIMARY_DOCS = [
    "README.md",
    "AGENTS.md",
    "ECOSYSTEM.md",
    "llms.txt",
    "docs/README.md",
    "docs/INDEX.md",
    "docs/ROADMAP.md",
    "docs/GA_REMEDIATION_ROADMAP.md",
    "docs/COMMERCIAL_GA_EXECUTION.md",
    "docs/COMMERCIAL_STABILITY_ROADMAP.md",
    "docs/DEVELOPMENT.md",
    "docs/DEPLOYMENT.md",
    "docs/API.md",
    "docs/TECH_DEBT.md",
    "docs/STABILITY_WRAP_UP_2026-05-20.md",
    "docs/STABILITY_AUDIT_2026-05-19.md",
    "docs/DOCUMENTATION_AUDIT_2026-05-22.md",
    "docs/architecture/ARCHITECTURE.md",
]


def scan_file(path: Path) -> list[tuple[str, str]]:
    broken: list[tuple[str, str]] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    base = path.parent
    for match in LINK_RE.finditer(text):
        target = match.group(1).strip()
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        resolved = (base / target).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            continue
        if not resolved.exists():
            broken.append((str(path.relative_to(ROOT)), target))
    return broken


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--primary",
        action="store_true",
        help="Scan primary entrypoint docs only",
    )
    parser.add_argument(
        "--all-docs",
        action="store_true",
        help="Scan all markdown under docs/",
    )
    args = parser.parse_args()

    paths: list[Path] = []
    if args.all_docs:
        paths = sorted(ROOT.glob("docs/**/*.md"))
    else:
        paths = [ROOT / rel for rel in PRIMARY_DOCS]

    all_broken: list[tuple[str, str]] = []
    for path in paths:
        if not path.exists():
            all_broken.append((str(path.relative_to(ROOT)), "(missing file)"))
            continue
        all_broken.extend(scan_file(path))

    if all_broken:
        print(f"Broken links: {len(all_broken)}")
        for source, target in all_broken:
            print(f"  {source} -> {target}")
        return 1

    scope = "primary entrypoints" if not args.all_docs else "docs/"
    print(f"OK: no broken relative links in {scope} ({len(paths)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
