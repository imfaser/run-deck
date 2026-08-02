import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/cmds', () => ({
  openRaw: vi.fn(),
  rawSlice: vi.fn(),
  dbUpsertImage: vi.fn(),
  dbSetAnnotations: vi.fn(),
  dbListAnnotationsByImage: vi.fn(),
  dbGetImageByHash: vi.fn().mockResolvedValue(null),
  logMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('swr', () => ({
  mutate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { mutate } from 'swr';
import {
  openRaw,
  rawSlice,
  dbUpsertImage,
  dbSetAnnotations,
  dbListAnnotationsByImage,
} from '@/services/cmds';
import { useLabel3DVolumeStore } from '@/store/label-3d-volume';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';

const volumeRes = {
  volumeId: 'vol-1',
  totalSlices: 5,
  sliceWidth: 100,
  sliceHeight: 100,
};

const sliceRes = (index: number) => ({
  data: new Array(100 * 100).fill(128),
  width: 100,
  height: 100,
  min: 0,
  max: 255,
  imageHash: `hash-${index}`,
});

// jsdom 无 canvas 2d context，stub grayscaleToDataUrl 依赖的 API
const ctxMock = {
  createImageData: () => ({ data: new Uint8ClampedArray(100 * 100 * 4) }),
  putImageData: vi.fn(),
};
const toDataUrlMock = vi.fn(() => 'data:image/png;base64,xx');
class FakeCanvas {
  width = 100;
  height = 100;
  getContext() {
    return ctxMock;
  }
  toDataURL() {
    return toDataUrlMock();
  }
}
vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
  tag === 'canvas' ? (new FakeCanvas() as unknown as HTMLElement) : document.createElement(tag)
);

beforeEach(() => {
  vi.clearAllMocks();
  useLabel3DVolumeStore.setState({
    volume: null,
    currentIndex: 0,
    currentImageHash: null,
    sliceImageUrl: null,
    isLoadingSlice: false,
    isSaving: false,
    dirtyConfirm: null,
    pendingIndex: null,
    pendingDeleteIndex: null,
  });
  useLabel3DCanvasStore.setState({
    mode: 'create',
    tool: 'p_point',
    objects: [],
    selectedObjectId: null,
    selectedAnnotationId: null,
    currentObjectId: null,
    stageScale: 1,
    stagePos: { x: 0, y: 0 },
    cursorImagePos: null,
    fitImageTrigger: 0,
    pendingAnnotation: null,
    showObjectSelectPopup: false,
    dirty: false,
    imageWidth: 0,
    imageHeight: 0,
  });
});

describe('label-3d-volume store', () => {
  describe('deleteSlice on current slice', () => {
    it('clears annotations immediately via saveEmptyForHash', async () => {
      vi.mocked(dbSetAnnotations).mockResolvedValue({} as never);
      useLabel3DVolumeStore.setState({
        volume: volumeRes as never,
        currentIndex: 3,
        currentImageHash: 'hash-3',
      });
      useLabel3DCanvasStore.setState({ objects: [] });

      await useLabel3DVolumeStore.getState().deleteSlice(3);

      expect(dbSetAnnotations).toHaveBeenCalledWith('hash-3', []);
      expect(mutate).toHaveBeenCalledWith(['slice-summaries', 'vol-1']);
      expect(useLabel3DVolumeStore.getState().pendingDeleteIndex).toBeNull();
    });
  });

  describe('deleteSlice on non-current slice', () => {
    it('sets pendingDeleteIndex and requests the slice load', () => {
      vi.mocked(rawSlice).mockResolvedValue(sliceRes(2) as never);
      vi.mocked(dbListAnnotationsByImage).mockResolvedValue([]);
      useLabel3DVolumeStore.setState({
        volume: volumeRes as never,
        currentIndex: 0,
        currentImageHash: 'hash-0',
      });

      useLabel3DVolumeStore.getState().deleteSlice(2);

      expect(useLabel3DVolumeStore.getState().pendingDeleteIndex).toBe(2);
      expect(useLabel3DVolumeStore.getState().isLoadingSlice).toBe(true);
    });

    it('clears the target slice annotations after it loads', async () => {
      vi.mocked(dbSetAnnotations).mockResolvedValue({} as never);
      vi.mocked(rawSlice).mockResolvedValue(sliceRes(2) as never);
      vi.mocked(dbListAnnotationsByImage).mockResolvedValue([]);
      useLabel3DVolumeStore.setState({
        volume: volumeRes as never,
        currentIndex: 0,
        currentImageHash: 'hash-0',
      });

      await useLabel3DVolumeStore.getState().deleteSlice(2);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(dbSetAnnotations).toHaveBeenCalledWith('hash-2', []);
      expect(useLabel3DVolumeStore.getState().pendingDeleteIndex).toBeNull();
    });
  });

  describe('requestLoadSlice', () => {
    it('opens dirty confirm when current slice is dirty', () => {
      useLabel3DCanvasStore.setState({ dirty: true });
      useLabel3DVolumeStore.setState({ volume: volumeRes as never });

      useLabel3DVolumeStore.getState().requestLoadSlice(1);

      expect(useLabel3DVolumeStore.getState().dirtyConfirm).toBe('save');
      expect(useLabel3DVolumeStore.getState().pendingIndex).toBe(1);
    });

    it('loads directly when not dirty', () => {
      vi.mocked(rawSlice).mockResolvedValue(sliceRes(1) as never);
      vi.mocked(dbListAnnotationsByImage).mockResolvedValue([]);
      useLabel3DVolumeStore.setState({ volume: volumeRes as never });

      useLabel3DVolumeStore.getState().requestLoadSlice(1);

      expect(rawSlice).toHaveBeenCalledWith('vol-1', 1);
    });
  });

  describe('cancelDirty', () => {
    it('clears pending navigation and confirm state', () => {
      useLabel3DVolumeStore.setState({
        dirtyConfirm: 'save',
        pendingIndex: 2,
        pendingDeleteIndex: 3,
      });

      useLabel3DVolumeStore.getState().cancelDirty();

      const s = useLabel3DVolumeStore.getState();
      expect(s.dirtyConfirm).toBeNull();
      expect(s.pendingIndex).toBeNull();
      expect(s.pendingDeleteIndex).toBeNull();
    });
  });

  describe('saveCurrent', () => {
    it('writes annotations and refreshes SWR caches', async () => {
      vi.mocked(dbSetAnnotations).mockResolvedValue({} as never);
      vi.mocked(dbUpsertImage).mockResolvedValue({} as never);
      useLabel3DVolumeStore.setState({
        volume: volumeRes as never,
        currentIndex: 0,
        currentImageHash: 'hash-0',
      });
      useLabel3DCanvasStore.setState({ dirty: true, imageWidth: 100, imageHeight: 100 });

      const ok = await useLabel3DVolumeStore.getState().saveCurrent();

      expect(ok).toBe(true);
      expect(dbSetAnnotations).toHaveBeenCalled();
      expect(mutate).toHaveBeenCalledWith(['slice-annotations', 'hash-0']);
      expect(mutate).toHaveBeenCalledWith(['slice-summaries', 'vol-1']);
      expect(useLabel3DCanvasStore.getState().dirty).toBe(false);
    });

    it('skips upsert_image when empty and only clears annotations', async () => {
      vi.mocked(dbSetAnnotations).mockResolvedValue({} as never);
      useLabel3DVolumeStore.setState({
        volume: volumeRes as never,
        currentIndex: 0,
        currentImageHash: 'hash-0',
      });
      useLabel3DCanvasStore.setState({ objects: [] });

      const ok = await useLabel3DVolumeStore.getState().saveCurrent();

      expect(ok).toBe(true);
      expect(dbUpsertImage).not.toHaveBeenCalled();
      expect(dbSetAnnotations).toHaveBeenCalledWith('hash-0', []);
    });

    it('returns false when no current image is loaded', async () => {
      const ok = await useLabel3DVolumeStore.getState().saveCurrent();
      expect(ok).toBe(false);
    });
  });

  describe('openVolume', () => {
    it('opens volume and loads slice 0', async () => {
      vi.mocked(openRaw).mockResolvedValue(volumeRes as never);
      vi.mocked(rawSlice).mockResolvedValue(sliceRes(0) as never);
      vi.mocked(dbListAnnotationsByImage).mockResolvedValue([]);

      const res = await useLabel3DVolumeStore
        .getState()
        .openVolume(
          { x: 100, y: 100, z: 5, dtype: 'uint8', endian: 'little', axis: 'z' },
          '/tmp/vol.raw'
        );

      expect(res).toEqual(volumeRes);
      expect(rawSlice).toHaveBeenCalledWith('vol-1', 0);
      expect(useLabel3DVolumeStore.getState().currentImageHash).toBe('hash-0');
      expect(useLabel3DVolumeStore.getState().isLoadingSlice).toBe(false);
    });
  });
});
