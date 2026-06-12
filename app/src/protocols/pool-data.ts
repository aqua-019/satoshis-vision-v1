/**
 * protocols/pool-data.ts — illustrative pool-distribution data for the Skyline
 * educational simulator.
 *
 * Pool attribution is physically unmeasurable on-chain (Monero coinbases don't
 * tag pools, and this site queries no third-party pool API), so these shares
 * are teaching material, not telemetry. They live here — inside protocols/ —
 * because the educational simulators are the one surface allowed to show
 * illustrative figures, and Skyline labels them as such.
 */

export interface Pool {
  name: string;
  /** fraction of last-24h shares, 0..1 */
  share: number;
  /** pool fee, 0..1 */
  fee: number;
  type: "decentralized" | "centralized" | "solo";
  /** recommended in our UI */
  rec: boolean;
  /** display hex */
  color: string;
}

export const POOLS: Pool[] = [
  { name: "P2Pool",         share: 0.072, fee: 0.000, type: "decentralized", rec: true,  color: "#ff7a1a" },
  { name: "Nanopool",       share: 0.058, fee: 0.010, type: "centralized",   rec: false, color: "#5ed3f4" },
  { name: "SupportXMR",     share: 0.310, fee: 0.006, type: "centralized",   rec: false, color: "#ff4d6d" },
  { name: "MineXMR",        share: 0.018, fee: 0.010, type: "centralized",   rec: false, color: "#ffd400" },
  { name: "HashVault",      share: 0.042, fee: 0.009, type: "centralized",   rec: false, color: "#b87aff" },
  { name: "MoneroOcean",    share: 0.054, fee: 0.001, type: "decentralized", rec: false, color: "#4ade80" },
  { name: "Solo / Unknown", share: 0.446, fee: 0.000, type: "solo",          rec: false, color: "rgba(255,255,255,0.5)" },
];
