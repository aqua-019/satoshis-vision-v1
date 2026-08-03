// nav/registries.mjs — bare-Node-safe re-export shim for ia.ts.
//
// ia.ts (src/nav/ia.ts) needs real data from a handful of existing TS
// registries — MONERO_TABS, EDU_TABS, the three protocol-meta arrays — but
// cannot import them DIRECTLY for a narrow, empirically-verified reason:
//
//   - Node's native TS type-stripping requires an EXPLICIT file extension on
//     a relative ESM specifier (`import "../pages/monero/tabs"` fails with
//     ERR_MODULE_NOT_FOUND under bare `node`, which is how verify-ia.mjs
//     loads ia.ts).
//   - TypeScript (this repo's tsconfig has no `allowImportingTsExtensions`,
//     and tsconfig.json is out of scope for this change) REJECTS an
//     explicit `.ts` extension in an import specifier with TS5097.
//
// Those two constraints are mutually exclusive for a `.ts` file importing
// another `.ts` file directly. A plain `.mjs` file is invisible to `tsc`
// (`allowJs` is false, so it is never opened for type-checking) but fully
// resolvable by both Vite/esbuild AND bare Node when given its real
// extension — so it can do what a `.ts` file structurally cannot: hold an
// explicit `.ts`-extensioned import. This file is that seam. ia.ts imports
// IT with an explicit `.mjs` extension, which every environment accepts.
//
// Each re-export below was verified importable under bare Node before this
// file was written (`node --input-type=module -e "import(...)"`) — none of
// these three source files carries a `@/` alias or a `.tsx`/JSX dependency,
// which is exactly what makes them safe here. registries.d.mts is this
// file's companion declaration, same pattern as scripts/routes.d.mts.

export { MONERO_TABS } from "../pages/monero/tabs.ts";
export { EDU_TABS } from "../pages/_education/tabs.ts";
export {
  PROTOCOL_PRIMITIVES_META,
  PROTOCOL_FUTURE_META,
  PROTOCOL_METAPHORS_META,
} from "../views/protocol-meta.ts";
