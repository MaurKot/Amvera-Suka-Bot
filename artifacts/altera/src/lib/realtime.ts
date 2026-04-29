import { useEffect, useRef } from "react";

export interface AlteraEvent {
  channel: "world" | "character" | "location";
  type: string;
  scope?: string;
  payload: Record<string, unknown>;
  ts: number;
}

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** Subscribe to Server-Sent Events from the API. */
export function useRealtimeEvents(handler: (ev: AlteraEvent) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const url = `${BASE}/api/events`;
    let es: EventSource | null = null;
    let cancelled = false;
    let backoff = 1000;

    function connect() {
      if (cancelled) return;
      try {
        es = new EventSource(url, { withCredentials: true });
      } catch {
        return;
      }
      es.onopen = () => {
        backoff = 1000;
      };
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as AlteraEvent;
          handlerRef.current(data);
        } catch {
          /* ignore */
        }
      };
      // Named events
      const names = [
        "ready",
        "location_discovered",
        "character_entered",
        "character_left",
        "npc_dialogue",
        "narrative_flag",
        "quest_completed",
        "quest_accepted",
      ];
      for (const n of names) {
        es.addEventListener(n, (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data) as AlteraEvent;
            handlerRef.current(data);
          } catch {
            /* ignore */
          }
        });
      }
      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);
}
