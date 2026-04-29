import { db, locations } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * P2 — Location graph helpers.
 *
 * Every location declares an explicit `connectedTo: string[]` adjacency list.
 * Players may visit a location only if it is the current one or directly
 * connected. New procedurally-generated locations are appended to this graph
 * — they cannot become reachable until both directions of the edge are wired.
 */

export interface GraphEdge {
  from: string;
  to: string;
}

/**
 * Make sure the edge `a ↔ b` exists in both adjacency lists. Idempotent.
 */
export async function connectLocations(a: string, b: string): Promise<void> {
  if (a === b) return;
  const [locA, locB] = await Promise.all([
    db.select().from(locations).where(eq(locations.id, a)).limit(1),
    db.select().from(locations).where(eq(locations.id, b)).limit(1),
  ]);
  if (!locA[0] || !locB[0]) return;
  const aNeighbors = new Set([...(locA[0].connectedTo as string[] | null ?? []), b]);
  const bNeighbors = new Set([...(locB[0].connectedTo as string[] | null ?? []), a]);
  await db.update(locations).set({ connectedTo: [...aNeighbors] }).where(eq(locations.id, a));
  await db.update(locations).set({ connectedTo: [...bNeighbors] }).where(eq(locations.id, b));
}

/** Returns true iff `to` is in `from`.connectedTo. Used as a server-side guard. */
export async function isReachableFrom(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  const [row] = await db.select().from(locations).where(eq(locations.id, from)).limit(1);
  if (!row) return false;
  const neighbors = (row.connectedTo as string[] | null) ?? [];
  return neighbors.includes(to);
}

/**
 * BFS reachability check from a starter id. Used by integrity report
 * (admin) and to flag orphan locations.
 */
export async function findUnreachableFrom(starterId: string): Promise<string[]> {
  const all = await db.select().from(locations);
  const map = new Map(all.map((l) => [l.id, (l.connectedTo as string[] | null) ?? []]));
  const visited = new Set<string>();
  const queue: string[] = [starterId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const n of map.get(cur) ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return all.filter((l) => !visited.has(l.id)).map((l) => l.id);
}
