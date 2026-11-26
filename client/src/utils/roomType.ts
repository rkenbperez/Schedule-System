export type RoomKind = 'laboratory' | 'lecture' | 'general';

/**
 * Infer a room kind from its name, matching the backend's importer contract
 * (the catalog has no room-type column).
 */
export function roomTypeFromName(name: string): RoomKind {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('laboratory') || normalized.includes('lab')) {
    return 'laboratory';
  }
  if (normalized.includes('lecture')) {
    return 'lecture';
  }
  return 'general';
}

/**
 * True when a room can host the given meeting mode.
 * Laboratory meetings need a lab; synchronous meetings need a lecture or
 * general room; asynchronous meetings are unrestricted.
 */
export function roomMatchesMode(
  roomName: string,
  mode: string | null | undefined
): boolean {
  const normalizedMode = (mode || '').toLowerCase();
  const kind = roomTypeFromName(roomName);

  if (normalizedMode === 'lab' || normalizedMode === 'laboratory') {
    return kind === 'laboratory';
  }
  if (normalizedMode === 'sync' || normalizedMode === 'synchronous') {
    return kind !== 'laboratory';
  }
  return true;
}
