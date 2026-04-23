const envList = (raw: string | undefined, fallback: string[]): string[] =>
  (raw ?? '').split(',').map(s => s.trim()).filter(Boolean).length
    ? (raw as string).split(',').map(s => s.trim()).filter(Boolean)
    : fallback;

const envNum = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  MONEROD_HOST: process.env.MONEROD_HOST || '127.0.0.1',
  MONEROD_RPC_PORT: envNum(process.env.MONEROD_RPC_PORT, 18081),
  MONEROD_ZMQ_PORT: envNum(process.env.MONEROD_ZMQ_PORT, 18082),

  MONEROD_FALLBACK_NODES: envList(process.env.MONEROD_FALLBACK_NODES, [
    'https://node.moneroworld.com:18089',
    'https://node.sethforprivacy.com:18089',
    'https://xmr-node.cakewallet.com:18081',
    'https://nodes.hashvault.pro:18081',
  ]),

  SERVER_PORT: envNum(process.env.SERVER_PORT, 3001),
  CORS_ORIGINS: envList(process.env.CORS_ORIGINS, [
    'https://xmr.irish',
    'https://www.xmr.irish',
    'http://localhost:3000',
    'http://localhost:5173',
  ]),

  DB_PATH: process.env.DB_PATH || './data/relay.db',
  LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

  POLL_INTERVAL_MS: 15_000,
  NETWORK_POLL_MS: 30_000,
  SNAPSHOT_INTERVAL_MS: 60_000,
  BLOCKS_HISTORY: 1_000,

  RPC_TIMEOUT_MS: 10_000,

  BLOCK_TARGET_SECONDS: 120,
  PICONERO_PER_XMR: 1_000_000_000_000,
} as const;

export type AppConfig = typeof config;
