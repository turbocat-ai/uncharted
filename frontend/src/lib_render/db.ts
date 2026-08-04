import * as SQLite from 'expo-sqlite';

export interface UserHex {
  h3Index: string;
  visitCount: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string;
  clientTimestamp: number;
  status: string;
  retryCount: number;
  createdAt: string;
}

let currentDb: SQLite.SQLiteDatabase | null = null;
let currentUserId: number | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initializes or switches to a user-specific SQLite database file ({userId}.db).
 */

export async function initUserDatabase(userId: number): Promise<SQLite.SQLiteDatabase> {
  if (currentDb && currentUserId === userId) return currentDb;

  if (currentDb) {
    try {
      await currentDb.closeAsync();
    } catch (e) {
      console.warn('[DB] Resetting database connection...');
    } finally {
      currentDb = null;
    }
  }

  currentUserId = userId;
  const db = await SQLite.openDatabaseAsync(`${userId}.db`);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS user_hexes (
      user_id INTEGER NOT NULL,
      h3_index TEXT NOT NULL,
      visit_count INTEGER NOT NULL DEFAULT 1,
      first_visited_at TEXT NOT NULL,
      last_visited_at TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, h3_index)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    client_timestamp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  `);

  currentDb = db;
  return db;
}

export function getCurrentUserId(): number | null {
  return currentUserId;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!currentDb) {
    throw new Error('[DB] Database not initialized! Call initUserDatabase(userId) after login.');
  }
  return currentDb;
}

/**
 * Logs a visit to an H3 hex using the user_hexes table schema atomically.
*/
export async function logHexVisit(h3Index: string): Promise<boolean> {
  const db = await getDb();
  const userId = getCurrentUserId(); // Ensure we get the active userId
  if (!userId) {
    throw new Error('[logHexVisit] Cannot log hex visit without an active userId.');
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  let isNewDiscovery = false;

  try {
    await db.withTransactionAsync(async () => {
      // 1. Check existing record
      const existing = await db.getFirstAsync<{
        h3_index: string;
        visit_count: number;
        first_visited_at: string;
      }>(
        'SELECT h3_index, visit_count, first_visited_at FROM user_hexes WHERE user_id = ? AND h3_index = ?',
        [userId, h3Index]
      );

      let operation = 'INSERT';
      let firstVisitedAt = nowIso;
      let newVisitCount = 1;

      if (existing) {
        operation = 'UPDATE';
        firstVisitedAt = existing.first_visited_at;
        newVisitCount = existing.visit_count + 1;
      } else {
        isNewDiscovery = true;
      }

      // 2. Updated UPSERT with matching composite key constraint
      await db.runAsync(
        `INSERT INTO user_hexes (user_id, h3_index, visit_count, first_visited_at, last_visited_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, h3_index) DO UPDATE SET
           visit_count = user_hexes.visit_count + 1,
           last_visited_at = excluded.last_visited_at,
           updated_at = excluded.updated_at`,
        [userId, h3Index, 1, nowIso, nowIso, nowMs]
      );

      // 3. Queue for synchronization
      const payloadData = {
        user_id: userId,
        h3_index: h3Index,
        first_visited_at: firstVisitedAt,
        last_visited_at: nowIso,
        visit_count: newVisitCount,
      };

      await db.runAsync(
        `INSERT INTO sync_queue (
          user_id,
          entity_type,
          entity_id,
          operation,
          payload,
          client_timestamp,
          status,
          retry_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'hex',
          h3Index,
          operation,
          JSON.stringify(payloadData),
          nowMs,
          'pending',
          0,
          nowIso,
        ]
      );
    });

    return isNewDiscovery;
  } catch (error) {
    console.error(`[logHexVisit Error] Failed to log visit for hex ${h3Index}:`, error);
    throw error;
  }
}


/**
 * Retrieves all stored hex records from SQLite.
 */
export async function getAllVisitedHexes(): Promise<UserHex[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    h3_index: string;
    visit_count: number;
    first_visited_at: string;
    last_visited_at: string;
    updated_at: number;
  }>('SELECT h3_index, visit_count, first_visited_at, last_visited_at, updated_at FROM user_hexes');

  return rows.map((row) => ({
    h3Index: row.h3_index,
    visitCount: row.visit_count,
    firstVisitedAt: row.first_visited_at,
    lastVisitedAt: row.last_visited_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Clears all local hex history and sync queue for the current user.
 */
export async function clearExplorationHistory(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM user_hexes;
    DELETE FROM sync_queue;
    VACUUM;
  `);
}

/**
 * Sync Queue Helper functions matching the sync_queue table schema.
 */
export const syncQueue = {
  async getPending(): Promise<SyncQueueItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: number;
      entity_type: string;
      entity_id: string;
      operation: string;
      payload: string;
      client_timestamp: number;
      status: string;
      retry_count: number;
      created_at: string;
    }>(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC`);

    return rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: row.payload,
      clientTimestamp: row.client_timestamp,
      status: row.status,
      retryCount: row.retry_count,
      createdAt: row.created_at,
    }));
  },

  async removeBatch(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
  },
};


if (typeof window !== 'undefined') {
  (window as any).clearDb = async () => {
    const db = await getDb();
    await db.execAsync('DELETE FROM user_hexes; DELETE FROM sync_queue; VACUUM;');
    console.log('✅ SQLite cache cleared inline from browser console!');
  };
}