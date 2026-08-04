// src/lib_render/sync.ts
import { syncQueue, getDb, getCurrentUserId } from './db';
import { api } from './api';

let isSyncing = false;

export async function performSync(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('[Sync] Aborting sync: No user ID active in session context');
      return;
    }

    const pendingItems = await syncQueue.getPending();
    if (!pendingItems || pendingItems.length === 0) return;

    const payload = pendingItems.map((item) => ({
      queue_id: item.id,
      entity_type: item.entityType,
      entity_id: item.entityId,
      operation: item.operation,
      payload: JSON.parse(item.payload),
      client_timestamp: item.clientTimestamp,
    }));

    const response = await api.post<{ success: boolean; synced_ids: number[] }>('/data/sync', {
      changes: payload,
    });

    if (response?.success && Array.isArray(response.synced_ids) && response.synced_ids.length > 0) {
      await syncQueue.removeBatch(response.synced_ids);
      console.log(`[Sync] Successfully synced ${response.synced_ids.length} changes for user ${userId}.`);
    }
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
  } finally {
    isSyncing = false;
  }
}

export async function fetchRemoteHexes(): Promise<void> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('[Sync] Aborting fetchRemoteHexes: No active user ID');
      return;
    }

    // Backend implicitly uses req.user.id from the JWT token
    const remoteHexes = await api.get<
      Array<{
        h3_index: string;
        visit_count: number;
        first_visited_at: string;
        last_visited_at: string;
        updated_at: number;
      }>
    >('/data/get-hexes');

    if (!Array.isArray(remoteHexes)) {
      console.warn('[Sync] Unexpected response format from server:', remoteHexes);
      return;
    }

    const db = await getDb();

    // Upsert remote hexes into SQLite scoped by user_id
    for (const hex of remoteHexes) {
      await db.runAsync(
        `INSERT INTO user_hexes (user_id, h3_index, visit_count, first_visited_at, last_visited_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, h3_index) DO UPDATE SET
           visit_count = MAX(user_hexes.visit_count, excluded.visit_count),
           last_visited_at = excluded.last_visited_at,
           updated_at = excluded.updated_at`,
        [
          userId,
          hex.h3_index,
          hex.visit_count ?? 1,
          hex.first_visited_at,
          hex.last_visited_at,
          hex.updated_at ?? Date.now(),
        ]
      );
    }

    console.log(`[Sync] Synced ${remoteHexes.length} hexes for user ${userId}`);
  } catch (error) {
    console.error('[Sync] Failed to pull remote hexes:', error);
  }
}