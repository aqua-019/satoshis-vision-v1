#!/usr/bin/env bash
# aqua-lead.sh — launch the L3 lead with automated model detection.
# Policy: Fable 5 default; Opus 4.8 fallback when Fable is unavailable
# (usage limit reached, model not offered, or outage).
#
# Usage (Git Bash, from the repo root):   ./scripts/aqua-lead.sh [claude args...]
# Reminder: run /effort high after launch — teammates and delegated work
# follow the lead's effort level.

set -u
LEAD="claude-opus-5"       # v3 default: near-Fable at half rate, Max default
FALLBACK="claude-opus-4-8" # Fable 5 stays a manual escalation (bills credits)

echo "[aqua-lead] probing ${LEAD} availability..." >&2
if claude -p "ok" --model "$LEAD" --max-turns 1 >/dev/null 2>&1; then
  MODEL="$LEAD"
  echo "[aqua-lead] ${LEAD} available — leading with Fable." >&2
else
  MODEL="$FALLBACK"
  echo "[aqua-lead] ${LEAD} unavailable — falling back to ${FALLBACK}." >&2
fi

# MinTTY (standalone Git Bash) needs winpty for an interactive terminal —
# and winpty can only launch real executables, so target the npm shim
# claude.cmd, not the extensionless `claude` shell shim. The VS Code
# integrated terminal needs neither.
if command -v winpty >/dev/null 2>&1 && [ "${TERM_PROGRAM:-}" != "vscode" ]; then
  exec winpty claude.cmd --model "$MODEL" "$@"
else
  exec claude --model "$MODEL" "$@"
fi

# Headless equivalent for scripted/outer loops (fleet, cron):
#   claude -p "<prompt>" --model claude-fable-5 --fallback-model claude-opus-4-8
