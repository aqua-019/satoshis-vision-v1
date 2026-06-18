import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layout/AppShell";
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
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "20px 48px 60px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1500, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "mempool", "tx", shortHash(id)]} />
        <LiveTxDetail txid={id} data={data} onBack={() => navigate("/mempool")} />
      </div>
    </AppShell>
  );
}
