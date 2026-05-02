# xmr.irish v4.0 documentation

This directory contains design specifications and architectural references for xmr.irish v4.0.

## Specs

- **`v4-phase4-genui-spec.md`** — GenUI 12-step pipeline specification for Phase 5's interactive simulations. Defines the spec data model, the engine pipeline, and rendering layer architecture. WebGL primary; SVG fallback. Provisional name; v5.0 will rename.
- **`v4-phase5-simulations.md`** — Five simulation briefs that Phase 5 implements against. Each brief is a standalone implementation contract.

## Status

- Phase 1-3: complete (page rebuilds shipped through Prompts M-R)
- Phase 4: spec only (this directory). No implementation yet.
- Phase 5: implementation in progress (Prompts T+ deliver each simulation)
- Phase 6: pre-launch checklist; not started

## Conventions

- Specs are normative. Implementation prompts cite specific sections.
- Deviations from a spec require a spec amendment first, not a unilateral implementation decision.
- After v4.0 ships, spec docs become read-only historical record. v5.0 will create new docs.
