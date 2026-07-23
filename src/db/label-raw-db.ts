import Dexie, { type EntityTable } from 'dexie';
import type { AnnotationObject } from '@/schemas/annotation';

export interface KeyframeRecord {
  id?: number;
  volumeId: string;
  sliceIndex: number;
  objects: AnnotationObject[];
  maskUrl: string | null;
  maskVisible: boolean;
  rawMaskHash: string | null;
}

export interface SliceSummary {
  sliceIndex: number;
  annotationCount: number;
  hasMask: boolean;
  maskVisible: boolean;
}

export const db = new Dexie('label-raw') as Dexie & {
  keyframes: EntityTable<KeyframeRecord, 'id'>;
};

db.version(1).stores({
  keyframes: '++id, [volumeId+sliceIndex], rawMaskHash',
});
