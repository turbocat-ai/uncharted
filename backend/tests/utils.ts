import db from '../src/db/pg_adaptor.js';
import type { LatLng } from '../src/types/dataTypes.js';
import { latLngToCell, cellToBoundary } from 'h3-js';

const H3_RESOLUTION = 10

export function getH3Index(latitude: number, longitude: number): string {
    return latLngToCell(latitude, longitude, H3_RESOLUTION);
}


export async function getOrCreateTestUser(username: string, email: string) {
    console.log(`\n[Seed] Getting User ${username}...`); 
    let user = await db.oneOrNone('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    
    if (!user) {
        user = await db.one(
        `INSERT INTO users (username, email, pwd_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email`,
        [username, email, '$2a$10$UnusedHashForManualTestingOnly']
        );
    }
    return parseInt(user.id, 10);
}


export async function populateCoordList(userId: number, coordsList: LatLng[]) {  
    console.log(`\n[Seed] Populating ${coordsList.length} hexes for user ID ${userId}...`);
    
    const hexList = []

    for(let i = 0; i < coordsList.length; i++) {
        const coord = coordsList[i];
        if (coord) {
            const currHex = getH3Index(coord.latitude, coord.longitude);
            hexList.push(currHex)
        }
    }

    for (let i = 0; i < hexList.length; i++) {
        // Generate valid H3 index strings for testing
        const h3Index = hexList[i]
        
        await db.none(
        `INSERT INTO user_hexes (user_id, h3_index, visit_count, first_visited_at, last_visited_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW(), $4)
        ON CONFLICT (user_id, h3_index) DO UPDATE
        SET visit_count = user_hexes.visit_count + 1,
            last_visited_at = NOW(),
            updated_at = EXCLUDED.updated_at`,
        [userId, h3Index, i + 1, Date.now()]
        );
    }
    console.log('[Seed] Population complete.');
}

// removes all hex ids and resets user_hexes table
export async function removeAllHexes() {
    console.log(`\n[Seed] Removing all hexes globally...`); 
    await db.tx(async t => {
    return t.batch([
        t.none('DELETE FROM user_hexes'),
        t.none('ALTER SEQUENCE user_hexes_id_seq RESTART WITH 1')
        ]);
    });
}

// Removes specified hexes for a user. If user == -1, removes all hexes with that ID
export async function removeHexIDUser(userID: number, hexIDs: string[]) {
    console.log(`\n[Seed] Removing ${hexIDs.length} hexes for user ${userID}...`); 
    if(userID == -1 && hexIDs.length > 0) {
        db.none('DELETE FROM user_hexes WHERE h3_index = ANY($1)', [hexIDs])
    } else if (userID != 1 && hexIDs.length > 0) {
        db.none('DELEE FROM user_hexes WHERE user_id = $1 AND h3_index = ANY($2)', [userID, hexIDs])
    }
}