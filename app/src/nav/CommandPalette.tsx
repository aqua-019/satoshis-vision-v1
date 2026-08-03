/**
 * nav/CommandPalette.tsx — the ⌘K destination search.
 *
 * `React.lazy`-loaded from layout/NavTop.tsx on the FIRST ⌘K press (see
 * nav/usePaletteHotkey.ts's header for the eager/lazy split and why it is
 * organised that way). Built on pages/future/V6Modal.tsx — "the app's only
 * createPortal … every future dialog should build on it" per that file's
 * own header — for the focus trap, scroll lock, Escape handling, focus
 * capture/restore and the present/open exit-frame mechanics. Nothing here
 * re-implements any of that; this file owns only the SEARCH content V6Modal
 * wraps.
 *
 * ── DESTINATIONS ─────────────────────────────────────────────────────────
 * Home (`/`) + 6 section roots + every nav/ia.ts leaf + 7 actions.
 *
 * nav/ia.ts's own header states Home is "owned by the brand mark, not a
 * section child" — but its DATA embeds a "Home" leaf inside the Live
 * section's Mempool column anyway (that file's own comment: "`/` has
 * nowhere else in the IA to live … this is the first, most-findable
 * slot"). `buildNavDestinations` below treats the explicit Home row as
 * canonical and SKIPS that embedded IA leaf (`item.p === R.HOME`) so the
 * palette never lists "/" twice under two different labels/sections. This
 * is a real premise mismatch between the task brief (which describes Home
 * as "deliberately not an IA leaf") and the current nav/ia.ts (where it
 * literally is one) — flagged here and in the build's own report rather
 * than silently picking a side.
 *
 * A section's ROOT destination does not use `section.path` directly:
 * `/live`, `/operate` and `/about` are groupings with nothing rendered at
 * them (nav/ia.ts's header, and layout/NavTop.tsx's own `onItemClick`
 * confirms the real behaviour: navigate to `cols[0].items[0].p`).
 *
 * `sectionRootPath` below does NOT blindly read `cols[0].items[0].p`,
 * though — a SECOND, sharper premise mismatch, found while building this:
 * for the Live section specifically, `cols[0].items[0]` IS that same
 * embedded "Home" leaf (it is the first item of the Mempool column), so the
 * naive rule resolves Live's root to "/" — identical to the palette's own
 * explicit Home row, and confirmed (against the real built app, not just
 * read from source) to be NavTop.tsx's actual live behaviour too: clicking
 * "Live" in the real top nav lands on Home, not on the mempool. That is a
 * pre-existing defect in `onItemClick`/nav/ia.ts's data shape, outside
 * every file this task owns, and is reported rather than silently patched
 * upstream. This component still cannot ship a "Live" destination that is
 * merely a second copy of "Home", so `sectionRootPath` walks each section's
 * leaves in order and returns the first one that is NOT `R.HOME` — a no-op
 * for the other five sections (none of them hit this case) and the
 * obviously-intended target for Live (`R.LIVE_MEMPOOL`, its own first REAL
 * leaf) instead of an accidental collision. verify-palette.mjs replicates
 * this exact rule offline for its own destination count.
 *
 * ── RANKING ──────────────────────────────────────────────────────────────
 * nav/fuzzy.ts's `rankDestinations` — see that file for the algorithm.
 *
 * ── KEYBOARD MODEL ───────────────────────────────────────────────────────
 * Destination rows are REAL, natively-focusable `<a href>` / `<button>`
 * elements (not a virtual-focus "combobox" list) — deliberately, because it
 * is what makes V6Modal's existing Tab-trap work correctly with zero
 * changes to that file: V6Modal computes its trap's first/last stops by
 * querying `a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])`
 * inside the dialog box, which assumes the elements it finds are the SAME
 * ones native Tab would reach. Giving every row `tabIndex={-1}` (an
 * "options are virtual, only the input is real" design) would break that
 * assumption — V6Modal's query would still find them (its selector matches
 * `a[href]` regardless of tabindex) while native Tab would skip straight
 * past them and out of the dialog, defeating the trap. Real, tabbable rows
 * make V6Modal's own logic correct as written, and are more accessible on
 * top of it: Tab cycles every result like an ordinary link list, Shift+Tab
 * from the input wraps to the last result, Tab from the last result wraps
 * back to the input — all via V6Modal's existing mechanism.
 *
 * Two ways to move the highlighted row, both kept in sync by the same `sel`
 * state: ↓ from the input moves REAL focus onto the top result (then row-
 * to-row ↑/↓ from there, clamped — no wraparound past either end, per the
 * task brief); a mouse hover/Tab landing on any row updates `sel` to match
 * via its own `onFocus`. Enter on the input activates the current `sel`;
 * Enter/Space on a focused row is native `<a>`/`<button>` activation and
 * needs no handler of its own.
 */

import * as React from "react";

import { V6Modal } from "../pages/future/V6Modal";
import { IA, type IaSection } from "./ia";
import { rankDestinations, type FuzzyRankable, type RankedResult } from "./fuzzy";
import { useVisual, type ThemeKey, type AmbientKey } from "../design/VisualContext";
import { useViewTransitionNavigate } from "../design/useViewTransitionNavigate";
import { R } from "../../scripts/routes.mjs";

type DestKind = "home" | "section" | "leaf";

interface NavDestination extends FuzzyRankable {
  l: string;
  p: string;
  sec: string;
  kind: DestKind;
  note?: string;
}

interface ActionDestination extends FuzzyRankable {
  l: string;
  p: "action";
  sec: "Actions";
  kind: "action";
  ic: string;
  run: () => void;
}

type PaletteRow = NavDestination | ActionDestination;

/** First leaf path in a section that is NOT Home — see the file header's
 *  second premise-mismatch note. A no-op for five of the six sections. */
function sectionRootPath(section: IaSection): string {
  for (const col of section.cols) {
    for (const item of col.items) {
      if (item.p !== R.HOME) return item.p;
    }
  }
  return section.path;
}

function buildNavDestinations(): NavDestination[] {
  const rows: NavDestination[] = [{ l: "Home", p: R.HOME, sec: "Home", kind: "home" }];
  for (const section of IA) {
    rows.push({ l: section.label, p: sectionRootPath(section), sec: section.label, kind: "section" });
    for (const col of section.cols) {
      for (const item of col.items) {
        if (item.p === R.HOME) continue; // see file header — Home has its own row above
        rows.push({ l: item.l, p: item.p, sec: `${section.label} · ${col.h}`, kind: "leaf", note: item.note });
      }
    }
  }
  return rows;
}

const NAV_DESTINATIONS: readonly NavDestination[] = buildNavDestinations();
const SECTION_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === "section").length;
const LEAF_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === "leaf").length;
const HOME_COUNT = NAV_DESTINATIONS.filter((d) => d.kind === "home").length;

const THEME_ACTIONS: ReadonlyArray<{ label: string; theme: ThemeKey }> = [
  { label: "Switch theme — Classic", theme: "classic" },
  { label: "Switch theme — Indigo", theme: "indigo" },
  { label: "Switch theme — Phosphor", theme: "phosphor" },
];
const AMBIENT_ACTIONS: ReadonlyArray<{ label: string; ambient: AmbientKey }> = [
  { label: "Switch ambient — Calm", ambient: "calm" },
  { label: "Switch ambient — Busy", ambient: "busy" },
  { label: "Switch ambient — Chaotic", ambient: "chaotic" },
];
/** Static regardless of render — used for the data-cmdk-* breakdown below
 *  without needing a mounted component (see verify-palette.mjs, which
 *  cross-checks this number against its own offline count from nav/ia.ts). */
const ACTION_COUNT = THEME_ACTIONS.length + AMBIENT_ACTIONS.length + 1; // +1 = copy-link

/** Best-effort only, matching design/VisualContext.tsx's `writePref` — a
 *  clipboard write that fails (denied permission, unsupported context)
 *  should not throw into the palette's click handler. */
function copyCurrentUrl(): void {
  try {
    void navigator.clipboard?.writeText(window.location.href);
  } catch {
    /* best effort only */
  }
}

function useActionRows(): ActionDestination[] {
  const { setTheme, setAmbient } = useVisual();
  return React.useMemo<ActionDestination[]>(
    () => [
      ...THEME_ACTIONS.map((a) => ({
        l: a.label, p: "action" as const, sec: "Actions" as const, kind: "action" as const,
        ic: "◧", run: () => setTheme(a.theme),
      })),
      ...AMBIENT_ACTIONS.map((a) => ({
        l: a.label, p: "action" as const, sec: "Actions" as const, kind: "action" as const,
        ic: "◔", run: () => setAmbient(a.ambient),
      })),
      { l: "Copy link to this page", p: "action" as const, sec: "Actions" as const, kind: "action" as const, ic: "⧉", run: copyCurrentUrl },
    ],
    [setTheme, setAmbient],
  );
}

function iconFor(row: RankedResult<PaletteRow>): string {
  switch (row.kind) {
    case "action": return row.ic;
    case "home": return "⌂";
    case "section": return "§";
    default: return "→";
  }
}

/** Highlight indices come from the LABEL match only (nav/fuzzy.ts's
 *  contract) — nothing here ever reads a section-match's `idx`. */
function highlightLabel(label: string, idx: readonly number[]): React.ReactNode {
  if (idx.length === 0) return label;
  const hit = new Set(idx);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < label.length; i++) {
    out.push(hit.has(i) ? <mark key={i} className="cmdk-hit">{label[i]}</mark> : label[i]);
  }
  return out;
}

function RowContent({ row, icon, label }: { row: RankedResult<PaletteRow>; icon: string; label: React.ReactNode }) {
  return (
    <>
      <span className="cmdk-ic" aria-hidden="true">{icon}</span>
      <span className="cmdk-lb">{label}</span>
      {row.kind !== "action" && row.note ? <span className="cmdk-note">{row.note}</span> : null}
      <span className="cmdk-pt">{row.kind === "action" ? "action" : row.p}</span>
    </>
  );
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const titleId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const rowRefs = React.useRef<Array<HTMLElement | null>>([]);
  const [query, setQuery] = React.useState("");
  const [sel, setSel] = React.useState(0);

  const vtNavigate = useViewTransitionNavigate();
  const actionRows = useActionRows();
  const allRows = React.useMemo<PaletteRow[]>(() => [...NAV_DESTINATIONS, ...actionRows], [actionRows]);
  const results = React.useMemo(() => rankDestinations(query, allRows), [query, allRows]);

  // Opening resets the query and focuses the input — every time `open`
  // transitions to true, not just on first mount. This effect belongs to
  // CommandPalette (the component that RENDERS <V6Modal>), so per React's
  // child-effects-before-parent-effects ordering it runs AFTER V6Modal's
  // own open-edge effect (which focuses its outer box) and correctly wins
  // the race, landing focus on the search input instead.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    inputRef.current?.focus();
  }, [open]);

  const activate = React.useCallback(
    (row: RankedResult<PaletteRow>) => {
      if (row.kind === "action") row.run();
      else vtNavigate(row.p);
      onClose();
    },
    [vtNavigate, onClose],
  );

  const focusRow = (i: number) => rowRefs.current[i]?.focus();

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (results.length === 0) return;
      e.preventDefault();
      const next = Math.min(sel, results.length - 1);
      setSel(next);
      focusRow(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = results[sel];
      if (row) activate(row);
    }
    // Escape is deliberately NOT handled here — it bubbles to V6Modal's own
    // document-level listener, which already calls onClose (see file header).
  };

  const onRowKeyDown = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(i + 1, results.length - 1);
      setSel(next);
      focusRow(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(i - 1, 0);
      setSel(prev);
      focusRow(prev);
    }
  };

  let lastSec: string | null = null;

  return (
    <V6Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div
        className="cmdk-pal"
        data-cmdk-total={NAV_DESTINATIONS.length + actionRows.length}
        data-cmdk-sections={SECTION_COUNT}
        data-cmdk-leaves={LEAF_COUNT}
        data-cmdk-home={HOME_COUNT}
        data-cmdk-actions={actionRows.length}
      >
        {/* V6Modal requires a real heading element for aria-labelledby; the
            palette's own visual "title" is the input's placeholder, so this
            one is sr-only rather than duplicated on screen. */}
        <h2 id={titleId} className="sr-only">Command palette</h2>

        <div className="cmdk-in">
          <svg className="cmdk-search-ic" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.3" cy="8.3" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="12.7" y1="12.7" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onInputKeyDown}
            placeholder="Jump to anything — page, tab, simulator, mempool view…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search destinations and actions"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="cmdk-list" data-cmdk-result-count={results.length}>
          {results.length === 0 ? (
            <div className="cmdk-empty">
              Nothing matches &ldquo;{query}&rdquo;.<br />
              Try a mempool view, a simulator, or a chapter.
            </div>
          ) : (
            results.map((row, i) => {
              const showHeader = row.sec !== lastSec;
              lastSec = row.sec;
              const isSel = i === sel;
              const icon = iconFor(row);
              const label = highlightLabel(row.l, row.idx);
              const className = "cmdk-row" + (isSel ? " is-sel" : "");
              const rowKey = `${row.kind}|${row.p}|${row.l}`;
              return (
                <React.Fragment key={rowKey}>
                  {showHeader ? <div className="cmdk-grp" role="presentation">{row.sec}</div> : null}
                  {row.kind === "action" ? (
                    <button
                      type="button"
                      ref={(el) => { rowRefs.current[i] = el; }}
                      className={className}
                      data-cmdk-kind={row.kind}
                      data-cmdk-path="action"
                      onFocus={() => setSel(i)}
                      onKeyDown={onRowKeyDown(i)}
                      onClick={() => activate(row)}
                    >
                      <RowContent row={row} icon={icon} label={label} />
                    </button>
                  ) : (
                    <a
                      href={row.p}
                      ref={(el) => { rowRefs.current[i] = el; }}
                      className={className}
                      data-cmdk-kind={row.kind}
                      data-cmdk-path={row.p}
                      onFocus={() => setSel(i)}
                      onKeyDown={onRowKeyDown(i)}
                      onClick={(e) => {
                        // Modified/non-primary clicks keep native behaviour
                        // (open in new tab, etc.) — only a plain click routes
                        // through the app's own view-transition navigate.
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        activate(row);
                      }}
                    >
                      <RowContent row={row} icon={icon} label={label} />
                    </a>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="cmdk-foot">
          <span><b>↑↓</b> move</span>
          <span><b>⏎</b> open</span>
          <span><b>Esc</b> close</span>
          <span className="cmdk-foot-count"><b>{results.length}</b> of <b>{allRows.length}</b></span>
        </div>
      </div>
    </V6Modal>
  );
}
