/**
 * design/canvasColor.ts — CSS custom property -> concrete colour, for canvas.
 *
 * A LEAF WITH A BUNDLING JOB. This lived in mempool/useMemCanvas.ts, and p3·12
 * first moved it into design/chart-kit.tsx — the obvious home, since chart-kit
 * already hosts `canvasCursor` and imports nothing but React. That cost **757
 * eager bytes on every route**, measured: `design/primitives.tsx` imports
 * chart-kit and primitives is in the eager entry, so anything added to chart-kit
 * is added to first paint. The branch's entry chunk carried the `var(…)` regex
 * and the `#ffffff` fallback; the baseline's did not.
 *
 * So it lives here instead — a module whose only importers are LAZY (the
 * mempool canvas hook, and the markets hero). Same singularity, no first-paint
 * cost. The rule this leaves behind: a shared leaf is not free, it is free ONLY
 * if every importer is on the same side of the eager/lazy line.
 *
 * Canvas cannot consume var(), and the palette is theme-scoped (L2 rebinds
 * chrome colours per :root[data-theme]), so draw loops need this once per theme
 * change — never per frame.
 */
export function cssColor(nameOrValue: string, el?: Element | null): string {
  const s = nameOrValue.trim();
  // Accepts BOTH `--tk-accent` and `var(--tk-accent)` / `var(--x, #fff)`.
  // The palette constants in the codebase are written the second way
  // (FEE_TIER_COLORS is ["var(--c-50)", …]), and a bare startsWith("--") test
  // silently passes those straight through — canvas then throws
  // "could not be parsed as a color" from inside addColorStop, which unmounts
  // the whole view. Cheap to get wrong, loud but late to discover.
  const wrapped = s.match(/^var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)$/);
  const name = wrapped ? wrapped[1] : s.startsWith("--") ? s : null;
  if (!name) return s;
  const host = el ?? document.documentElement;
  const v = getComputedStyle(host).getPropertyValue(name).trim();
  if (v) return v;
  const fallback = wrapped?.[2]?.trim();
  return fallback ? cssColor(fallback, el) : "#ffffff";
}
