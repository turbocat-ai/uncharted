// src/lib_render/sync.ts
import { syncQueue, getDb, getCurrentUserId } from './db';
import { api } from './api';

let isSyncing = false;

export async function performSync(): Promise<void> {
  if (isSyncing) return;

  // 1. Skip sync calls in local dev mode if backend isn't reachable or using mock token
  if (__DEV__ && process.env.EXPO_PUBLIC_DISABLE_DEV_SYNC === 'true') {
    console.log('[Sync] Dev mode active: Skipping remote sync.');
    return;
  }

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
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
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
    // Graceful error logging so app doesn't crash
    console.warn('[Sync] Sync request skipped/failed (Check backend URL / Auth header):', error);
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

    // Skip network request in local dev mode if dev sync is disabled
    if (__DEV__ && process.env.EXPO_PUBLIC_DISABLE_DEV_SYNC === 'true') {
      console.log('[Sync] Dev mode active: Skipping fetchRemoteHexes.');
      return;
    }

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
    console.warn('[Sync] Skipped pulling remote hexes (Backend offline or unauthorized):', error);
  }
}