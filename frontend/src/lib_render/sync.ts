import { syncQueue, getDb } from './db';
import { api } from './api';

let isSyncing = false;

/**
 * Triggers a sync cycle to push pending local changes to the Express server
 * and pull down any remote updates.
 */
export async function performSync(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const pendingItems = await syncQueue.getPending();
    if (pendingItems.length === 0) {
      isSyncing = false;
      return;
    }

    // Format queue items for the backend sync endpoint
    const payload = pendingItems.map((item) => ({
      queue_id: item.id,
      entity_type: item.entityType,
      entity_id: item.entityId,
      operation: item.operation,
      payload: JSON.parse(item.payload),
      client_timestamp: item.clientTimestamp,
    }));

    // Send payload to Express server
    const response = await api.post<{ success: boolean; synced_ids: number[] }>('/data/sync', {
      changes: payload,
    });

    if (response.success && response.synced_ids?.length > 0) {
      // Remove successfully processed items from local queue
      await syncQueue.removeBatch(response.synced_ids);
      console.log(`[Sync] Successfully synced ${response.synced_ids.length} changes.`);
    }
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Pulls down remote user hexes on login or startup to seed/reconcile local user_hexes.
 */
export async function fetchRemoteHexes(): Promise<void> {
  try {
    const remoteHexes = await api.get<
      Array<{
        h3_index: string;
        visit_count: number;
        first_visited_at: string;
        last_visited_at: string;
        updated_at: number;
      }>
    >('/data/get-hexes');

    const db = getDb();

    // Upsert remote hexes into local SQLite cache
    for (const hex of remoteHexes) {
      await (await db).runAsync(
        `INSERT INTO user_hexes (h3_index, visit_count, first_visited_at, last_visited_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(h3_index) DO UPDATE SET
           visit_count = MAX(visited_hexes.visit_count, excluded.visit_count),
           last_visited_at = excluded.last_visited_at,
           updated_at = excluded.updated_at`,
        [hex.h3_index, hex.visit_count, hex.first_visited_at, hex.last_visited_at, hex.updated_at]
      );
    }
  } catch (error) {
    console.error('[Sync] Failed to pull remote hexes:', error);
  }
}