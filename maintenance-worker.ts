import { PrismaPg } from '@prisma/adapter-pg';
import { CloudflareSocket } from 'pg-cloudflare';
import { PrismaClient } from './src/generated/prisma/client';
import queryCompilerWasm from './src/generated/prisma/internal/query_compiler_fast_bg.wasm';

type Env = {
  HYPERDRIVE: { connectionString: string };
  EMAIL: {
    send: (message: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }) => Promise<unknown>;
  };
  ALERT_TO: string;
  ALERT_FROM: string;
  DATABASE_SIZE_LIMIT_BYTES: string;
};

type StorageState = {
  alert_level: string | null;
  last_sent_at: Date | null;
};

type StorageStats = {
  database_bytes: bigint;
  replay_bytes: bigint;
  replay_chunks: bigint;
};

const PG_CLOUDFLARE_GLOBAL = globalThis as typeof globalThis & {
  __UMAMI_PG_CLOUDFLARE_SOCKET?: typeof CloudflareSocket;
  __UMAMI_PRISMA_QUERY_COMPILER_WASM?: WebAssembly.Module;
};

PG_CLOUDFLARE_GLOBAL.__UMAMI_PG_CLOUDFLARE_SOCKET = CloudflareSocket;
PG_CLOUDFLARE_GLOBAL.__UMAMI_PRISMA_QUERY_COMPILER_WASM = queryCompilerWasm;

const WARNING_PERCENT = 80;
const CRITICAL_PERCENT = 90;
const CLEAR_PERCENT = 75;
const REPEAT_AFTER_MS = 24 * 60 * 60 * 1000;

function createClient(env: Env) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString, maxUses: 1 }),
  });
}

async function readStorageStats(prisma: PrismaClient): Promise<StorageStats> {
  const [stats] = await prisma.$queryRawUnsafe<StorageStats[]>(`
    SELECT
      (SELECT pg_database_size(current_database()))::bigint AS database_bytes,
      (SELECT pg_total_relation_size('public.session_replay'))::bigint AS replay_bytes,
      count(*)::bigint AS replay_chunks
    FROM public.session_replay
  `);

  return stats;
}

async function ensureAlertState(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.umami_storage_alert_state (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      alert_level text,
      last_sent_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.umami_storage_alert_state (singleton)
    VALUES (true)
    ON CONFLICT (singleton) DO NOTHING
  `);
}

async function readAlertState(prisma: PrismaClient): Promise<StorageState> {
  const [state] = await prisma.$queryRawUnsafe<StorageState[]>(`
    SELECT alert_level, last_sent_at
    FROM public.umami_storage_alert_state
    WHERE singleton = true
  `);
  return state;
}

async function updateAlertState(
  prisma: PrismaClient,
  level: string | null,
  sentAt: Date | null,
) {
  await prisma.$executeRawUnsafe(
    `UPDATE public.umami_storage_alert_state
     SET alert_level = $1, last_sent_at = $2, updated_at = now()
     WHERE singleton = true`,
    level,
    sentAt,
  );
}

async function monitorStorage(prisma: PrismaClient, env: Env) {
  await ensureAlertState(prisma);

  const stats = await readStorageStats(prisma);
  const usedBytes = Number(stats.database_bytes);
  const replayBytes = Number(stats.replay_bytes);
  const replayChunks = Number(stats.replay_chunks);
  const limitBytes = Number(env.DATABASE_SIZE_LIMIT_BYTES);
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) {
    throw new Error('DATABASE_SIZE_LIMIT_BYTES must be a positive number.');
  }

  const percent = (usedBytes / limitBytes) * 100;
  const level = percent >= CRITICAL_PERCENT ? 'critical' : percent >= WARNING_PERCENT ? 'warning' : null;
  const previous = await readAlertState(prisma);

  if (percent < CLEAR_PERCENT) {
    if (previous.alert_level !== null) await updateAlertState(prisma, null, null);
    console.log(`Database storage is clear at ${percent.toFixed(1)}% (${usedBytes} / ${limitBytes} bytes).`);
    return;
  }

  if (!level) {
    console.log(`Database storage is at ${percent.toFixed(1)}%; below the alert threshold.`);
    return;
  }

  const severity = { warning: 1, critical: 2 } as const;
  if (
    previous.alert_level &&
    previous.alert_level in severity &&
    severity[level] < severity[previous.alert_level as keyof typeof severity]
  ) {
    await updateAlertState(prisma, level, previous.last_sent_at);
    console.log(`Database storage eased to ${level} at ${percent.toFixed(1)}%; no downgrade email sent.`);
    return;
  }

  const lastSentAt = previous.last_sent_at ? new Date(previous.last_sent_at).getTime() : 0;
  const shouldNotify = previous.alert_level !== level || Date.now() - lastSentAt >= REPEAT_AFTER_MS;
  if (!shouldNotify) {
    console.log(`Database storage remains ${level} at ${percent.toFixed(1)}%; alert already sent.`);
    return;
  }

  const usedMiB = (usedBytes / 1024 / 1024).toFixed(1);
  const limitMiB = (limitBytes / 1024 / 1024).toFixed(0);
  const replayMiB = (replayBytes / 1024 / 1024).toFixed(1);
  const subject = `Umami storage ${level}: ${percent.toFixed(1)}% used`;
  const text = [
    `Umami's PostgreSQL database is using ${usedMiB} MiB of ${limitMiB} MiB (${percent.toFixed(1)}%).`,
    `Session replay table: ${replayMiB} MiB across ${replayChunks.toLocaleString()} chunks.`,
    'The monitor checks hourly. Unsaved replay chunks older than 30 days are purged daily; saved replays are retained.',
  ].join('\n');

  await env.EMAIL.send({ from: env.ALERT_FROM, to: env.ALERT_TO, subject, text });
  await updateAlertState(prisma, level, new Date());
  console.log(`Sent ${level} database storage alert at ${percent.toFixed(1)}%.`);
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const prisma = createClient(env);
    ctx.waitUntil(
      (async () => {
        try {
          await monitorStorage(prisma, env);
        } finally {
          await prisma.$disconnect();
        }
      })(),
    );
  },
};
