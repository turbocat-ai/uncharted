import Dexie, { Table } from 'dexie';

export interface VisitedHex {
  /** The unique H3 Resolution 10 index string (Primary Key) */
  h3Index: string;
  /** Timestamp when the hex was first discovered */
  firstVisitedAt: Date;
  /** Timestamp when the hex was last entered */
  lastVisitedAt: Date;
  /** Total number of times the user entered this hex */
  visitCount: number;
}

export class FogExplorerDB extends Dexie {
  visitedHexes!: Table<VisitedHex, string>; // Primary key is h3Index

  constructor() {
    super('FogExplorerDB');
    
    // Define schema and indexes
    this.version(1).stores({
      visitedHexes: 'h3Index, firstVisitedAt, lastVisitedAt',
    });
  }
}

// Export a single database instance
export const db = new FogExplorerDB();

/**
 * Logs a visit to an H3 hex.
 * If the hex hasn't been visited before, it creates a new entry.
 * If it has been visited, it updates lastVisitedAt and increments visitCount.
 * 
 * @param h3Index - The H3 hex index string
 * @returns Promise<boolean> - Returns true if it was a NEW hex discovery, false otherwise.
 */
export async function logHexVisit(h3Index: string): Promise<boolean> {
  const now = new Date();
  const existing = await db.visitedHexes.get(h3Index);

  if (existing) {
    await db.visitedHexes.update(h3Index, {
      lastVisitedAt: now,
      visitCount: existing.visitCount + 1,
    });
    return false; // Hex was already unlocked
  } else {
    await db.visitedHexes.add({
      h3Index,
      firstVisitedAt: now,
      lastVisitedAt: now,
      visitCount: 1,
    });
    return true; // Newly unlocked hex!
  }
}

/**
 * Retrieves all stored hex records from IndexedDB.
 */
export async function getAllVisitedHexes(): Promise<VisitedHex[]> {
  return await db.visitedHexes.toArray();
}

/**
 * Clears all stored exploration data.
 * Useful for debugging or resetting user progress.
 */
export async function clearExplorationHistory(): Promise<void> {
  await db.visitedHexes.clear();
}