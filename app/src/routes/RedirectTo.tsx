/**
 * routes/RedirectTo.tsx — client-side mirrors of vercel.json's 12 server 301s.
 *
 * `<Navigate to="/live/mempool" replace />` takes a STRING LITERAL. A visitor
 * following a shared link like `/mempool?v=reactor` would land on
 * `/live/mempool` with the query silently DISCARDED — breaking every deep
 * link this restructure promises to keep alive (`?v=`, `?p=`, `?range=`,
 * `?block=`). That is exactly the defect Requirement 1 ("never break a
 * shared link") exists to catch, so a bare `<Navigate to="literal">` is wrong
 * here even though it is the obvious first draft. `RedirectTo` instead reads
 * the CURRENT location's search + hash and appends them to the destination,
 * so a redirect never drops what the visitor actually asked for.
 *
 * `RedirectTo` itself covers the 9 static→static redirects, where `to` needs
 * no route param. Three of the 12 redirects also carry a route PARAM the
 * destination needs — `/education/:tab`, `/simulate/:id`,
 * `/mempool/tx/:txid` — so each gets its own tiny sibling below that reads
 * `useParams()` and builds the target, then appends search/hash the same
 * way. `/simulate/:id`'s target (`/learn/sim?p=<id>`) already carries a
 * query string of its own, so `RedirectToSim` MERGES `p` into whatever
 * search the visitor's URL already had rather than concatenating two `?`
 * strings (which would be malformed) or dropping the visitor's own params.
 */

import * as React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

/** Literal destination, no route param. Used for the 9 static redirects. */
export function RedirectTo({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}

/** `/education/:tab` → `/learn/:tab`. */
export function RedirectToEduTab() {
  const { tab } = useParams<{ tab: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`/learn/${tab ?? ""}${search}${hash}`} replace />;
}

/** `/mempool/tx/:txid` → `/live/mempool/tx/:txid`. */
export function RedirectToMempoolTx() {
  const { txid } = useParams<{ txid: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`/live/mempool/tx/${txid ?? ""}${search}${hash}`} replace />;
}

/**
 * `/simulate/:id` → `/learn/sim?p=:id`. Merges `p` into the CURRENT search
 * rather than replacing it wholesale, so any other param already on the old
 * URL survives the redirect too — the same "compose onto what's there"
 * discipline routes/useUrlState.ts's setter follows for the same reason.
 */
export function RedirectToSim() {
  const { id } = useParams<{ id: string }>();
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  if (id) params.set("p", id);
  const qs = params.toString();
  return <Navigate to={`/learn/sim${qs ? `?${qs}` : ""}${hash}`} replace />;
}
