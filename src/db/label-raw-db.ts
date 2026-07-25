import Dexie, { type EntityTable } from 'dexie';
import type { KeyframeRecord } from '@/schemas/keyframe';

export const db = new Dexie('label-raw') as Dexie & {
  keyframes: EntityTable<KeyframeRecord, 'id'>;
};

db.version(1).stores({
  keyframes: '++id, [volumeId+sliceIndex], rawMaskHash',
});
