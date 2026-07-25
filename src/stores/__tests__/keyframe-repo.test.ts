import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KeyframeRecord } from '@/schemas/keyframe';

const store = new Map<number, KeyframeRecord>();
let autoId = 1;

vi.mock('@/db/label-raw-db', () => ({
  db: {
    keyframes: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn(() => undefined),
      toArray: vi.fn(() => []),
      put: vi.fn((record: KeyframeRecord) => {
        const id = autoId++;
        store.set(id, { ...record, id });
        return id;
      }),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/services/cmd', () => ({ logMessage: vi.fn() }));

import {
  getKeyframe,
  putKeyframe,
  deleteKeyframe,
  getKeyframesByVolume,
  deleteKeyframesByVolume,
  toggleMaskVisible,
} from '@/db/keyframe-repo';
import { db } from '@/db/label-raw-db';
import { logMessage } from '@/services/cmd';

function mockFirst(value: KeyframeRecord | undefined) {
  vi.mocked(
    db.keyframes.where('[volumeId+sliceIndex]').equals([] as never).first
  ).mockResolvedValue(value as never);
}

function mockToArray(value: KeyframeRecord[]) {
  vi.mocked(db.keyframes.where('volumeId').equals('' as never).toArray).mockResolvedValue(
    value as never
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  autoId = 1;
});

describe('keyframe-repo', () => {
  describe('getKeyframe', () => {
    it('returns undefined when not found', async () => {
      mockFirst(undefined);
      const result = await getKeyframe('vol-1', 0);
      expect(result).toBeUndefined();
    });

    it('logs error and returns undefined on failure', async () => {
      vi.mocked(
        db.keyframes.where('[volumeId+sliceIndex]').equals([] as never).first
      ).mockRejectedValue(new Error('db error') as never);
      const result = await getKeyframe('vol-1', 0);
      expect(result).toBeUndefined();
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('getKeyframe failed')
      );
    });
  });

  describe('putKeyframe', () => {
    it('creates new record when none exists', async () => {
      mockFirst(undefined);
      await putKeyframe('vol-1', 0, { objects: [], maskUrl: null });
      expect(db.keyframes.put).toHaveBeenCalledWith(
        expect.objectContaining({
          volumeId: 'vol-1',
          sliceIndex: 0,
          objects: [],
          maskUrl: null,
          maskVisible: true,
          rawMaskHash: null,
        })
      );
    });

    it('updates existing record', async () => {
      const existing: KeyframeRecord = {
        id: 1,
        volumeId: 'vol-1',
        sliceIndex: 0,
        objects: [],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      mockFirst(existing);
      await putKeyframe('vol-1', 0, { maskUrl: 'new-url' });
      expect(db.keyframes.update).toHaveBeenCalledWith(1, { maskUrl: 'new-url' });
    });

    it('logs error and re-throws on failure', async () => {
      mockFirst(undefined);
      vi.mocked(db.keyframes.put).mockRejectedValue(new Error('put error') as never);
      await expect(putKeyframe('vol-1', 0, {})).rejects.toThrow('put error');
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('putKeyframe failed')
      );
    });
  });

  describe('deleteKeyframe', () => {
    it('deletes existing record', async () => {
      const existing: KeyframeRecord = {
        id: 5,
        volumeId: 'vol-1',
        sliceIndex: 2,
        objects: [],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      mockFirst(existing);
      await deleteKeyframe('vol-1', 2);
      expect(db.keyframes.delete).toHaveBeenCalledWith(5);
    });

    it('does nothing when record not found', async () => {
      mockFirst(undefined);
      await deleteKeyframe('vol-1', 99);
      expect(db.keyframes.delete).not.toHaveBeenCalled();
    });

    it('logs error and re-throws on failure', async () => {
      const existing: KeyframeRecord = {
        id: 1,
        volumeId: 'vol-1',
        sliceIndex: 0,
        objects: [],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      mockFirst(existing);
      vi.mocked(db.keyframes.delete).mockRejectedValue(new Error('delete error') as never);
      await expect(deleteKeyframe('vol-1', 0)).rejects.toThrow('delete error');
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('deleteKeyframe failed')
      );
    });
  });

  describe('getKeyframesByVolume', () => {
    it('returns all keyframes for a volume', async () => {
      const records: KeyframeRecord[] = [
        {
          id: 1,
          volumeId: 'vol-1',
          sliceIndex: 0,
          objects: [],
          maskUrl: null,
          maskVisible: true,
          rawMaskHash: null,
        },
        {
          id: 2,
          volumeId: 'vol-1',
          sliceIndex: 1,
          objects: [],
          maskUrl: null,
          maskVisible: true,
          rawMaskHash: null,
        },
      ];
      mockToArray(records);
      const result = await getKeyframesByVolume('vol-1');
      expect(result).toEqual(records);
    });

    it('logs error and returns empty array on failure', async () => {
      vi.mocked(db.keyframes.where('volumeId').equals('' as never).toArray).mockRejectedValue(
        new Error('db error') as never
      );
      const result = await getKeyframesByVolume('vol-1');
      expect(result).toEqual([]);
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('getKeyframesByVolume failed')
      );
    });
  });

  describe('deleteKeyframesByVolume', () => {
    it('deletes all keyframes for a volume', async () => {
      vi.mocked(db.keyframes.delete).mockResolvedValue(undefined as never);
      await deleteKeyframesByVolume('vol-1');
      expect(db.keyframes.where('volumeId').equals('vol-1').delete).toHaveBeenCalled();
    });

    it('logs error and re-throws on failure', async () => {
      vi.mocked(db.keyframes.where('volumeId').equals('' as never).delete).mockRejectedValue(
        new Error('db error') as never
      );
      await expect(deleteKeyframesByVolume('vol-1')).rejects.toThrow('db error');
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('deleteKeyframesByVolume failed')
      );
    });
  });

  describe('toggleMaskVisible', () => {
    it('flips maskVisible from true to false', async () => {
      const existing: KeyframeRecord = {
        id: 1,
        volumeId: 'vol-1',
        sliceIndex: 0,
        objects: [],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      mockFirst(existing);
      await toggleMaskVisible('vol-1', 0);
      expect(db.keyframes.update).toHaveBeenCalledWith(1, { maskVisible: false });
    });

    it('flips maskVisible from false to true', async () => {
      const existing: KeyframeRecord = {
        id: 2,
        volumeId: 'vol-1',
        sliceIndex: 1,
        objects: [],
        maskUrl: null,
        maskVisible: false,
        rawMaskHash: null,
      };
      mockFirst(existing);
      await toggleMaskVisible('vol-1', 1);
      expect(db.keyframes.update).toHaveBeenCalledWith(2, { maskVisible: true });
    });

    it('does nothing when record not found', async () => {
      mockFirst(undefined);
      await toggleMaskVisible('vol-1', 99);
      expect(db.keyframes.update).not.toHaveBeenCalled();
    });

    it('logs error and re-throws on failure', async () => {
      const existing: KeyframeRecord = {
        id: 1,
        volumeId: 'vol-1',
        sliceIndex: 0,
        objects: [],
        maskUrl: null,
        maskVisible: true,
        rawMaskHash: null,
      };
      mockFirst(existing);
      vi.mocked(db.keyframes.update).mockRejectedValue(new Error('update error') as never);
      await expect(toggleMaskVisible('vol-1', 0)).rejects.toThrow('update error');
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('toggleMaskVisible failed')
      );
    });
  });
});
