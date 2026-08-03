export interface HexRecord {
  h3_index: string;
  visit_count: number;
  first_visited_at: string;
  last_visited_at: string;
  updated_at: string;
}

export interface SyncItemPayload {
  h3_index: string;
  first_visited_at: string;
  last_visited_at: string;
  visit_count: number;
}

export interface SyncQueueChange {
  queue_id: number;
  entity_type: 'hex' | string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | string;
  payload: SyncItemPayload;
  client_timestamp: number;
}

export interface BatchSyncRequestBody {
  changes: SyncQueueChange[];
}

export interface LatLng {
    latitude: number;
    longitude: number;
}