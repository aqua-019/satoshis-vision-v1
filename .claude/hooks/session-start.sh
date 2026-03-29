#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Validate key files exist
for f in index.html CLAUDE.md netlify.toml vercel.json; do
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
