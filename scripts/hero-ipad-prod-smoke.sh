#!/usr/bin/env bash
# Post-deploy smoke for hero iPad showcase on dhan.am production.
set -euo pipefail

LANDING_URL="${1:-https://dhan.am/en}"
APP_URL="${2:-https://app.dhan.am}"
GLB_URL="${3:-https://dhan.am/landing/models/ipad-pro.glb}"

echo "==> Landing HTML markers: $LANDING_URL"
html="$(curl -fsSL "$LANDING_URL")"

for marker in 'data-hero-ipad-root' 'data-landing-section="hero"' 'id="landing-hero"'; do
  if printf '%s' "$html" | rg -q "$marker"; then
    echo "  ok: $marker"
  else
    echo "  warn: missing $marker (may hydrate client-side only)"
  fi
done

echo "==> iPad GLB asset"
curl -fsSI "$GLB_URL" | rg -i 'HTTP/|content-type|content-length'

echo "==> Embed route CSP (frame-ancestors for marketing parent)"
csp="$(curl -fsSI "${APP_URL}/embed/demo/dashboard?persona=maria&showcase=1" | rg -i 'content-security-policy' || true)"
if printf '%s' "$csp" | rg -q 'frame-ancestors.*dhan\.am'; then
  echo "  ok: embed allows dhan.am parent"
else
  echo "  fail: embed CSP missing dhan.am in frame-ancestors"
  printf '%s\n' "$csp"
  exit 1
fi

echo "==> Landing frame-src allows app embed"
landing_csp="$(curl -fsSI "$LANDING_URL" | rg -i 'content-security-policy' || true)"
if printf '%s' "$landing_csp" | rg -q 'frame-src.*app\.dhan\.am'; then
  echo "  ok: landing frame-src includes app.dhan.am"
else
  echo "  warn: frame-src not visible or missing app.dhan.am"
  printf '%s\n' "$landing_csp"
fi

echo "==> Smoke complete"
