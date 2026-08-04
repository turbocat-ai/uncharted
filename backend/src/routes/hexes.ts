import { Router, type Request, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from './auth.js';
import db from '../db/pg_adaptor.js';
import { type BatchSyncRequestBody, type HexRecord } from '../types/dataTypes.js'

const router = Router();

// Apply auth middleware to all routes in this router
router.use(authenticateToken);


/**
 * GET /api/hexes
 * Fetches all unlocked hexes for the authenticated user to hydrate client SQLite cache on login.
 */
router.get('/get-hexes', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User missing from request context' });
      return;
    }

    const query = `
      SELECT 
        h3_index,
        visit_count,
        first_visited_at,
        last_visited_at,
        updated_at
      FROM user_hexes
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);

    // Handle variations in pg drivers (pg Pool vs pg-promise vs custom wrapper)
    const rows: HexRecord[] = Array.isArray(result) 
    ? result 
    : (result?.rows || []);

    const formattedHexes: HexRecord[] = rows.map((row) => ({
    h3_index: row.h3_index,
    visit_count: row.visit_count,
    first_visited_at: row.first_visited_at,
    last_visited_at: row.last_visited_at,
    updated_at: row.updated_at,
    }));

    res.json(formattedHexes);
  } catch (error) {
    console.error('Error fetching hexes:', error);
    res.status(500).json({ error: 'Failed to retrieve hex records' });
  }
});

/**
 * POST /api/sync
 * Receives batched queue updates from client sync_queue and upserts them into global DB.
 */
router.post('/sync', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: User missing from request context' });
    return;
  }

  const { changes }: BatchSyncRequestBody = req.body;

  if (!Array.isArray(changes) || changes.length === 0) {
    res.status(400).json({ error: 'No changes provided in payload' });
    return;
  }

  const syncedIds: number[] = [];

  try {
    await db.query('BEGIN');

    for (const item of changes) {
      const { queue_id, entity_type, payload, client_timestamp } = item;

      if (entity_type === 'hex') {
        const { h3_index, first_visited_at, last_visited_at, visit_count } = payload;
        const updatedAtDate = typeof client_timestamp === 'number' 
        ? new Date(client_timestamp) 
        : client_timestamp;
        const upsertQuery = `
          INSERT INTO user_hexes (user_id, h3_index, visit_count, first_visited_at, last_visited_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, h3_index) 
          DO UPDATE SET
            visit_count = GREATEST(user_hexes.visit_count, EXCLUDED.visit_count),
            last_visited_at = EXCLUDED.last_visited_at,
            updated_at = EXCLUDED.updated_at
        `;

        await db.query(upsertQuery, [
          userId,
          h3_index,
          visit_count,
          first_visited_at,
          last_visited_at,
          updatedAtDate,
        ]);

        syncedIds.push(queue_id);
      }
    }

    await db.query('COMMIT');

    res.json({
      success: true,
      synced_ids: syncedIds,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error processing batch sync:', error);
    res.status(500).json({ error: 'Batch sync failed on server' });
  }
});

export default router;