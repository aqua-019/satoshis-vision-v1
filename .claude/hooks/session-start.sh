#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Validate key files exist. v6.1.0 dropped index.html and netlify.toml from this
# list: the v4 static site at the repo root was deleted (it was never served —
# vercel.json publishes app/dist), and Vercel is now the only deploy target.
for f in CLAUDE.md vercel.json .mcp.json app/index.html app/package.json; do
  if [ ! -f "$f" ]; then
    echo "WARNING: Expected file missing: $f" >&2
  fi
done

# Count app routes as a sanity check (was: HTML pages in the project root)
route_count=$(grep -c '^  "/' app/scripts/routes.mjs 2>/dev/null || echo 0)
echo "Environment ready: $route_count static routes in app/scripts/routes.mjs"

# Confirm tooling availability
echo "Python: $(python3 --version 2>&1)"
echo "Node: $(node --version 2>&1)"

# Pre-cache MCP server packages so they start faster
echo "Ensuring MCP server packages are available..."
npx -y @modelcontextprotocol/server-github --help >/dev/null 2>&1 || true
npx -y @modelcontextprotocol/server-fetch --help >/dev/null 2>&1 || true
echo "MCP servers ready"

# Check for GitHub token
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "NOTE: GITHUB_TOKEN not set — GitHub MCP server will not authenticate" >&2
fi
