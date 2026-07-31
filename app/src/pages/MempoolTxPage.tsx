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
      <Crumbs items={["xmr.irish", "mempool", "tx", shortHash(id)]} />
      <LiveTxDetail txid={id} data={data} onBack={() => navigate("/mempool")} />
    </PageShell>
  );
}
