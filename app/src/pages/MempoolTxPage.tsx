import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { shortHash } from "@/data/types";
import { LiveTxDetail } from "@/mempool/tx-detail";

export function MempoolTxPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { txid } = useParams();
  const id = txid ?? "";
  // No ribbon on this deep-link page — the detail panel's own re-poll (useLiveTx →
  // useTxRaw) resolves the REAL block height from the node and flips pending →
  // confirmed on its own. The block is never guessed from the txid hash.
  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      {/* D0744 — this page's visible heading is the transaction hash inside
          LiveTxDetail, which is not an <h1> and should not become one (it is
          rendered by a component the /mempool views also embed inline). The
          landmark still needs an accessible name, so the name is stated once,
          here, screen-reader-only. `.sr-only` is position:absolute with a 1px
          box: it occupies ZERO layout space, so this changes no pixel. */}
      <h1 id="page-title" className="sr-only">Transaction {shortHash(id)}</h1>
      <Crumbs items={["xmr.irish", "mempool", "tx", shortHash(id)]} />
      <LiveTxDetail txid={id} data={data} onBack={() => navigate("/mempool")} />
    </PageShell>
  );
}
