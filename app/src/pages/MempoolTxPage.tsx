import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layout/AppShell";
import { useMoneroLive } from "@/data/DataContext";
import { Crumbs } from "@/design/primitives";
import { shortHash } from "@/data/types";
import { FullTxDetail, txSynthFromId } from "@/mempool/tx-detail";
import { pinTxBlockHeight } from "@/mempool/conf";

export function MempoolTxPage() {
  const data = useMoneroLive();
  const navigate = useNavigate();
  const { txid } = useParams();
  const id = txid ?? "";
  // Pin the block height ONCE per id; confirmations derive live from the tip.
  const pinRef = React.useRef<{ id: string; h: number | null } | null>(null);
  if (!pinRef.current || pinRef.current.id !== id) {
    pinRef.current = { id, h: pinTxBlockHeight(id, data) };
  }
  return (
    <AppShell hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "20px 48px 60px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1500, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "mempool", "tx", shortHash(id)]} />
        <FullTxDetail tx={txSynthFromId(id, data, pinRef.current.h)} onBack={() => navigate("/mempool")} />
      </div>
    </AppShell>
  );
}
