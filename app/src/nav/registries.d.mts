// registries.d.mts — companion declaration for registries.mjs.
// See that file's header for why the shim exists. Kept hand-in-sync with
// the shape of the three source registries it re-exports.

export interface IaMoneroTabMeta {
  id: string;
  label: string;
}
export const MONERO_TABS: readonly IaMoneroTabMeta[];

export interface IaEduTabMeta {
  id: string;
  label: string;
}
export const EDU_TABS: readonly IaEduTabMeta[];

export type IaProtocolGroup =
  | "Privacy primitive"
  | "Future protocol"
  | "Economics"
  | "Consensus";

export interface IaProtocolMetaBase {
  id: string;
  label: string;
  kicker: string;
  tone: "acc" | "priv";
  sub: string;
  group: IaProtocolGroup;
}
export const PROTOCOL_PRIMITIVES_META: readonly IaProtocolMetaBase[];
export const PROTOCOL_FUTURE_META: readonly IaProtocolMetaBase[];
export const PROTOCOL_METAPHORS_META: readonly IaProtocolMetaBase[];

/** One mempool view, as views/mempool-meta.ts declares it minus its component.
 *  Only `id`/`label` are declared here — ia.ts reads nothing else, and a
 *  narrower declaration is one fewer thing to keep in sync by hand. */
export interface IaMempoolViewMeta {
  id: string;
  label: string;
}
export const MEMPOOL_VIEW_META: readonly IaMempoolViewMeta[];
