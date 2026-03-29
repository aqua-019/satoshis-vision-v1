#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Validate key files exist
for f in index.html CLAUDE.md netlify.toml vercel.json .mcp.json; do
  if [ ! -f "$f" ]; then
    echo "WARNING: Expected file missing: $f" >&2
  fi
done

# Count HTML pages as a sanity check
html_count=$(find . -maxdepth 1 -name '*.html' | wc -l)
echo "Environment ready: $html_count HTML pages found in project root"

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
