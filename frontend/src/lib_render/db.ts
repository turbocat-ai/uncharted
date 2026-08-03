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
  if (currentDb && currentUserId === userId) {
    return currentDb;
  }

  // Reuse existing promise if initialization is already in progress for this user
  if (initPromise && currentUserId === userId) {
    return initPromise;
  }

  currentUserId = userId;

  initPromise = (async () => {
    const dbName = `${userId}.db`;
    const db = await SQLite.openDatabaseAsync(dbName);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS user_hexes (
        h3_index TEXT PRIMARY KEY NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 1,
        first_visited_at TEXT NOT NULL,
        last_visited_at TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        client_timestamp INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_hexes_last_visited ON user_hexes(last_visited_at);
    `);

    currentDb = db;
    console.log(`[DB] Switched SQLite connection to ${dbName}`);
    return db;
  })();

  return initPromise;
}

/**
 * Ensures the database is initialized before executing queries.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (currentDb) return currentDb;
  if (initPromise) return await initPromise;

  throw new Error('Database not initialized! Call initUserDatabase(userId) after login.');
}

/**
 * Logs a visit to an H3 hex using the user_hexes table schema.
 */
export async function logHexVisit(h3Index: string): Promise<boolean> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const existing = await db.getFirstAsync<{
    h3_index: string;
    visit_count: number;
    first_visited_at: string;
    last_visited_at: string;
    updated_at: number;
  }>('SELECT * FROM user_hexes WHERE h3_index = ?', [h3Index]);

  let isNewDiscovery = false;
  let firstVisitedAt = nowIso;
  let lastVisitedAt = nowIso;
  let newVisitCount = 1;
  let operation = 'INSERT';

  if (existing) {
    operation = 'UPDATE';
    firstVisitedAt = existing.first_visited_at;
    newVisitCount = existing.visit_count + 1;

    await db.runAsync(
      `UPDATE user_hexes 
       SET last_visited_at = ?, visit_count = ?, updated_at = ? 
       WHERE h3_index = ?`,
      [nowIso, newVisitCount, nowMs, h3Index]
    );
  } else {
    isNewDiscovery = true;

    await db.runAsync(
      `INSERT INTO user_hexes (h3_index, visit_count, first_visited_at, last_visited_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [h3Index, 1, nowIso, nowIso, nowMs]
    );
  }

  const payloadData = {
    h3_index: h3Index,
    first_visited_at: firstVisitedAt,
    last_visited_at: lastVisitedAt,
    visit_count: newVisitCount,
  };

  await db.runAsync(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, client_timestamp, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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

  return isNewDiscovery;
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
    }>('SELECT * FROM sync_queue WHERE status = "pending" ORDER BY id ASC');

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