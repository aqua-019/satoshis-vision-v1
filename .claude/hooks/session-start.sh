#!/bin/bash
set -euo pipefail

# Only run in Claude Code Remote (web) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install htmlhint for linting static HTML files
npm install -g htmlhint
