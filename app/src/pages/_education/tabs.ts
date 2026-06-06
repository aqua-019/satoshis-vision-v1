/**
 * pages/_education/tabs.ts — education hub tab metadata + resolver.
 *
 * The Education surface is a tabbed hub routed via /education and
 * /education/:tab (journey, timeline, quotes, simulators).
 */

export interface EduTabMeta {
  id: string;
  label: string;
}

export const EDU_TABS: readonly EduTabMeta[] = [
  { id: "journey", label: "Journey" },
  { id: "timeline", label: "Timeline" },
  { id: "quotes", label: "Quotes" },
  { id: "simulators", label: "Simulators" },
];

/** Resolve a (possibly undefined) :tab param to a valid tab id, defaulting to journey. */
export function resolveTab(tab: string | undefined): string {
  return EDU_TABS.some((t) => t.id === tab) ? (tab as string) : "journey";
}
