import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useLabel3dMaskStore } from '@/stores/mask';
import { getKeyframe } from '@/db/keyframe-repo';
import { useMaskRenderer } from '@/composables/useMaskRenderer';
import { logMessage } from '@/services/cmd';

vi.mock('@/services/cmd', () => ({ logMessage: vi.fn() }));
vi.mock('@/composables/useMaskRenderer', () => ({
  useMaskRenderer: vi.fn(() => ({
    renderedMaskUrl: ref(null),
    isRendering: ref(false),
    renderMask: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
    clearMask: vi.fn(),
  })),
}));
vi.mock('@/db/keyframe-repo', () => ({
  getKeyframe: vi.fn().mockResolvedValue(undefined),
}));

const label3dState = { volumeId: null as string | null, currentIndex: 0 };
vi.mock('@/stores/label-3d', () => ({
  useLabel3dStore: vi.fn(() => ({
    get volumeId() {
      return label3dState.volumeId;
    },
    set volumeId(v: string | null) {
      label3dState.volumeId = v;
    },
    get currentIndex() {
      return label3dState.currentIndex;
    },
    set currentIndex(v: number) {
      label3dState.currentIndex = v;
    },
  })),
}));

function makeKf(rawMaskHash: string | null = null) {
  return {
    id: 1,
    volumeId: 'vol-1',
    sliceIndex: 0,
    objects: [],
    maskUrl: null,
    maskVisible: true,
    rawMaskHash,
  };
}

describe('mask store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has default maskSettings', () => {
      const store = useLabel3dMaskStore();
      expect(store.maskSettings).toEqual({
        color: '#0096ff',
        prevMaskColor: '#ef4444',
        opacity: 0.6,
        threshold: 128,
        prevMaskAssist: true,
      });
    });

    it('has currentMaskUrl as null', () => {
      const store = useLabel3dMaskStore();
      expect(store.currentMaskUrl).toBeNull();
    });
  });

  describe('setCurrentMaskUrl', () => {
    it('sets currentMaskUrl', () => {
      const store = useLabel3dMaskStore();
      store.setCurrentMaskUrl('data:image/png;base64,abc');
      expect(store.currentMaskUrl).toBe('data:image/png;base64,abc');
    });

    it('clears currentMaskUrl when set to null', () => {
      const store = useLabel3dMaskStore();
      store.setCurrentMaskUrl('data:image/png;base64,abc');
      store.setCurrentMaskUrl(null);
      expect(store.currentMaskUrl).toBeNull();
    });
  });

  describe('maskSettings mutation', () => {
    it('can update individual settings', () => {
      const store = useLabel3dMaskStore();
      store.maskSettings.color = '#ff0000';
      store.maskSettings.threshold = 200;
      store.maskSettings.opacity = 0.8;
      expect(store.maskSettings.color).toBe('#ff0000');
      expect(store.maskSettings.threshold).toBe(200);
      expect(store.maskSettings.opacity).toBe(0.8);
      expect(store.maskSettings.prevMaskAssist).toBe(true);
    });
  });

  describe('multi-instance independence', () => {
    it('two stores with different pinia have independent state', () => {
      setActivePinia(createPinia());
      const store1 = useLabel3dMaskStore();

      setActivePinia(createPinia());
      const store2 = useLabel3dMaskStore();

      store1.setCurrentMaskUrl('url-a');
      store1.maskSettings.color = '#ff0000';

      expect(store1.currentMaskUrl).toBe('url-a');
      expect(store2.currentMaskUrl).toBeNull();
      expect(store1.maskSettings.color).toBe('#ff0000');
      expect(store2.maskSettings.color).toBe('#0096ff');
    });
  });

  describe('renderCurrentMask', () => {
    it('does nothing when volumeId is null', async () => {
      label3dState.volumeId = null;
      label3dState.currentIndex = 5;
      const store = useLabel3dMaskStore();

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBeNull();
      expect(getKeyframe).not.toHaveBeenCalled();
    });

    it('renders mask when keyframe has rawMaskHash', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 10;
      vi.mocked(getKeyframe).mockResolvedValueOnce(makeKf('hash-abc'));
      const store = useLabel3dMaskStore();

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBe('data:image/png;base64,mock');
      const renderer = vi.mocked(useMaskRenderer);
      expect(renderer).toHaveBeenCalled();
      const { renderMask } = renderer.mock.results[0].value;
      expect(renderMask).toHaveBeenCalledWith('hash-abc', 128, '#0096ff');
    });

    it('sets null when keyframe exists without rawMaskHash and prevMaskAssist disabled', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 10;
      vi.mocked(getKeyframe).mockResolvedValueOnce(makeKf(null));
      const store = useLabel3dMaskStore();
      store.maskSettings.prevMaskAssist = false;

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBeNull();
      expect(getKeyframe).toHaveBeenCalledTimes(1);
    });

    it('searches backwards when keyframe lacks rawMaskHash and prevMaskAssist enabled', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 5;
      vi.mocked(getKeyframe)
        .mockResolvedValueOnce(makeKf(null))
        .mockResolvedValueOnce(makeKf(null))
        .mockResolvedValueOnce(makeKf('prev-hash'));
      const store = useLabel3dMaskStore();
      store.maskSettings.prevMaskAssist = true;

      await store.renderCurrentMask();

      expect(getKeyframe).toHaveBeenCalledWith('vol-1', 5);
      expect(getKeyframe).toHaveBeenCalledWith('vol-1', 4);
      expect(getKeyframe).toHaveBeenCalledWith('vol-1', 3);
      expect(store.currentMaskUrl).toBe('data:image/png;base64,mock');
    });

    it('searches backwards when no keyframe exists and prevMaskAssist enabled', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 2;
      vi.mocked(getKeyframe)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(makeKf('found-hash'));
      const store = useLabel3dMaskStore();
      store.maskSettings.prevMaskAssist = true;

      await store.renderCurrentMask();

      expect(getKeyframe).toHaveBeenCalledWith('vol-1', 2);
      expect(getKeyframe).toHaveBeenCalledWith('vol-1', 1);
      expect(store.currentMaskUrl).toBe('data:image/png;base64,mock');
    });

    it('sets null when no keyframe and prevMaskAssist disabled', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 0;
      vi.mocked(getKeyframe).mockResolvedValueOnce(undefined);
      const store = useLabel3dMaskStore();
      store.maskSettings.prevMaskAssist = false;

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBeNull();
      expect(getKeyframe).toHaveBeenCalledTimes(1);
    });

    it('sets null when prev mask search is exhausted', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 2;
      vi.mocked(getKeyframe).mockResolvedValue(makeKf(null));
      const store = useLabel3dMaskStore();
      store.maskSettings.prevMaskAssist = true;

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBeNull();
      expect(getKeyframe).toHaveBeenCalledTimes(3);
    });

    it('logs error and keeps previous state on render failure', async () => {
      label3dState.volumeId = 'vol-1';
      label3dState.currentIndex = 7;
      vi.mocked(getKeyframe).mockResolvedValueOnce(makeKf('hash-fail'));
      vi.mocked(logMessage).mockClear();
      vi.mocked(useMaskRenderer).mockReturnValueOnce({
        renderedMaskUrl: ref(null),
        isRendering: ref(false),
        renderMask: vi.fn().mockRejectedValueOnce(new Error('boom')),
        clearMask: vi.fn(),
      });

      const store = useLabel3dMaskStore();
      store.setCurrentMaskUrl('data:image/png;base64,previous');

      await store.renderCurrentMask();

      expect(store.currentMaskUrl).toBe('data:image/png;base64,previous');
      expect(logMessage).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('[mask-render] renderCurrentMask failed')
      );
    });
  });
});
