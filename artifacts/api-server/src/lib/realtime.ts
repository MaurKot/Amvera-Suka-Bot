import type { Response } from "express";
import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import { logger } from "./logger";

export type RealtimeChannel = "world" | "character" | "location";

export interface RealtimeEvent {
  channel: RealtimeChannel;
  type: string;
  scope?: string; // e.g. locationId or characterId, used for filtering
  payload: Record<string, unknown>;
  ts: number;
}

const CHANNEL = "altera_events";

type Listener = (ev: RealtimeEvent) => void;
const listeners = new Set<Listener>();
let listenClient: PoolClient | null = null;
let starting: Promise<void> | null = null;

async function ensureListenClient(): Promise<void> {
  if (listenClient) return;
  if (starting) return starting;

  starting = (async () => {
    const client = await pool.connect();
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const ev = JSON.parse(msg.payload) as RealtimeEvent;
        for (const l of listeners) {
          try {
            l(ev);
          } catch (err) {
            logger.warn({ err }, "realtime listener threw");
          }
        }
      } catch (err) {
        logger.warn({ err }, "realtime payload parse failed");
      }
    });
    client.on("error", (err) => {
      logger.error({ err }, "Postgres LISTEN client error; releasing");
      try {
        client.release(true);
      } catch {
        /* noop */
      }
      listenClient = null;
      starting = null;
    });
    await client.query(`LISTEN ${CHANNEL}`);
    listenClient = client;
    logger.info("Realtime LISTEN client ready");
  })();

  try {
    await starting;
  } finally {
    if (!listenClient) starting = null;
  }
}

/** Publish an event to all connected SSE clients via Postgres NOTIFY. */
export async function publishEvent(
  ev: Omit<RealtimeEvent, "ts">,
): Promise<void> {
  const full: RealtimeEvent = { ...ev, ts: Date.now() };
  try {
    await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, JSON.stringify(full)]);
  } catch (err) {
    logger.warn({ err }, "publishEvent failed");
  }
}

/** Subscribe an SSE response. Returns an unsubscribe function. */
export async function subscribeSSE(res: Response): Promise<() => void> {
  await ensureListenClient();
  const listener: Listener = (ev) => {
    try {
      res.write(`event: ${ev.type}\n`);
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    } catch {
      /* response closed */
    }
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
