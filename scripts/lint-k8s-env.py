#!/usr/bin/env python3
"""
Kubernetes manifest env-var conflict linter.

Walks all *.yaml under the given roots (default: infra/k8s/) and fails if any
container env entry has both `value` and `valueFrom` set. Such entries are
ambiguous: kube-apiserver accepts them but ArgoCD's diff/sync logic treats
them as drift, which is what regressed dhanam-api on 2026-05-04 (env[19]
METAMAP_CLIENT_ID, env[20] METAMAP_CLIENT_SECRET, env[45] POSTHOG_API_KEY,
env[47] METAMAP_FLOW_ID, env[49] CHECKOUT_ALLOWED_HOSTS — each had inline
`value: <plaintext>` in the live cluster while the source manifest used
`valueFrom: secretKeyRef`).

Output format:
  <file>:<line>: env var "<name>" in container "<container_name>": has both 'value' and 'valueFrom'

Exit codes:
  0 — no violations
  1 — violations found
  2 — script error (parse failure, missing dirs, etc.)

Usage:
  python3 scripts/lint-k8s-env.py                          # scan infra/k8s/
  python3 scripts/lint-k8s-env.py infra/k8s/ tests/fixtures # scan multiple roots
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write(
        "lint-k8s-env: missing PyYAML. Install with: pip install pyyaml\n"
    )
    sys.exit(2)

# K8s kinds whose pod-spec we walk. The pod template lives at different
# nesting depths depending on the kind, but in every case we end up at a
# `spec.containers` / `spec.initContainers` list whose entries each have an
# `env:` array. See _iter_pod_specs below.
WORKLOAD_KINDS = {
    "Deployment",
    "StatefulSet",
    "DaemonSet",
    "Job",
    "CronJob",
    "Pod",
    "ReplicaSet",
    "ReplicationController",
}


def _pod_spec_paths(kind: str):
    """
    Return the list of dotted-paths inside a manifest where a PodSpec lives,
    for the given kind. Each path is a tuple of keys to traverse from the
    root document object.
    """
    if kind == "Pod":
        return [("spec",)]
    if kind == "CronJob":
        return [("spec", "jobTemplate", "spec", "template", "spec")]
    # Deployment, StatefulSet, DaemonSet, Job, ReplicaSet, ReplicationController
    return [("spec", "template", "spec")]


def _walk(obj, path):
    """
    Yield (intermediate_obj) by walking ``path`` (tuple of keys). Yield
    nothing if any intermediate isn't a dict or the key is missing.
    """
    cur = obj
    for key in path:
        if not isinstance(cur, dict):
            return
        cur = cur.get(key)
        if cur is None:
            return
    yield cur


def _iter_containers(pod_spec):
    """Yield (container_dict, container_kind) for both containers and initContainers."""
    if not isinstance(pod_spec, dict):
        return
    for kind in ("initContainers", "containers"):
        items = pod_spec.get(kind)
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                yield item, kind


def _violations_for_env_entry(env_entry):
    """
    Return True if this env entry violates the rule (has both `value` and
    `valueFrom`, where `value` is anything — including the empty string —
    and `valueFrom` is non-null).

    An env entry with `value: ""` paired with `valueFrom` is also a violation
    per the user's original spec; the empty-string sentinel is ambiguous
    when a secret reference is also present.
    """
    if not isinstance(env_entry, dict):
        return False
    has_value = "value" in env_entry
    value_from = env_entry.get("valueFrom")
    has_value_from = value_from is not None
    return has_value and has_value_from


def _line_for_env_entry(file_text_lines, env_entry, fallback_line):
    """
    Best-effort line number for an env entry. PyYAML's safe_load doesn't
    track line numbers, so we scan the file text for `- name: <name>` after
    fallback_line. Returns fallback_line if not found.
    """
    if not isinstance(env_entry, dict):
        return fallback_line
    name = env_entry.get("name")
    if not isinstance(name, str):
        return fallback_line
    needle = f"name: {name}"
    for idx, line in enumerate(file_text_lines, start=1):
        if needle in line:
            return idx
    return fallback_line


def lint_file(path: Path):
    """
    Yield violation tuples (path, line, container_name, env_name) for one
    manifest file. Multi-document YAML is supported.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        sys.stderr.write(f"lint-k8s-env: cannot read {path}: {exc}\n")
        return
    if not text.strip():
        return
    text_lines = text.splitlines()

    try:
        documents = list(yaml.safe_load_all(text))
    except yaml.YAMLError as exc:
        # Don't fail the whole lint over one malformed file; report and skip.
        sys.stderr.write(f"lint-k8s-env: YAML parse error in {path}: {exc}\n")
        return

    for doc in documents:
        if not isinstance(doc, dict):
            continue
        kind = doc.get("kind")
        if kind not in WORKLOAD_KINDS:
            continue
        for spec_path in _pod_spec_paths(kind):
            for pod_spec in _walk(doc, spec_path):
                for container, _container_kind in _iter_containers(pod_spec):
                    container_name = container.get("name", "<unnamed>")
                    env_list = container.get("env")
                    if not isinstance(env_list, list):
                        continue
                    for env_entry in env_list:
                        if _violations_for_env_entry(env_entry):
                            env_name = (
                                env_entry.get("name", "<unnamed>")
                                if isinstance(env_entry, dict)
                                else "<unnamed>"
                            )
                            line = _line_for_env_entry(text_lines, env_entry, 0)
                            yield (path, line, container_name, env_name)


def collect_yaml_files(roots):
    """Yield Path objects for every *.yaml / *.yml under each root."""
    for root in roots:
        root_path = Path(root)
        if not root_path.exists():
            sys.stderr.write(f"lint-k8s-env: root does not exist: {root}\n")
            continue
        if root_path.is_file():
            if root_path.suffix in (".yaml", ".yml"):
                yield root_path
            continue
        for ext in ("*.yaml", "*.yml"):
            yield from sorted(root_path.rglob(ext))


def main(argv):
    roots = argv[1:] or ["infra/k8s"]
    violations = []
    for path in collect_yaml_files(roots):
        for v in lint_file(path):
            violations.append(v)

    for path, line, container_name, env_name in violations:
        # Format: <file>:<line>: env var "<name>" in container "<container_name>": has both 'value' and 'valueFrom'
        sys.stderr.write(
            f"{path}:{line}: env var \"{env_name}\" in container \"{container_name}\": "
            f"has both 'value' and 'valueFrom'\n"
        )

    if violations:
        sys.stderr.write(
            f"\nlint-k8s-env: {len(violations)} violation(s) found. "
            "Each env entry must use either 'value' OR 'valueFrom', not both.\n"
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
