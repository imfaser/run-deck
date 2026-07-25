import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMaskStore } from '@/stores/mask';

vi.mock('@/services/cmd', () => ({ logMessage: vi.fn() }));
vi.mock('@/composables/useMaskRenderer', () => ({
  useMaskRenderer: () => ({ renderMask: vi.fn().mockResolvedValue('data:image/png;base64,mock') }),
}));
vi.mock('@/db/keyframe-repo', () => ({
  getKeyframe: vi.fn().mockResolvedValue(undefined),
}));

function createMockLabel3d() {
  return {
    volumeId: 'vol-1',
    currentIndex: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('mask store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('has default maskSettings', () => {
      const store = useMaskStore('test', createMockLabel3d());
      expect(store.maskSettings).toEqual({
        color: '#0096ff',
        prevMaskColor: '#ef4444',
        opacity: 0.6,
        threshold: 128,
        prevMaskAssist: true,
      });
    });

    it('has currentMaskUrl as null', () => {
      const store = useMaskStore('test', createMockLabel3d());
      expect(store.currentMaskUrl).toBeNull();
    });
  });

  describe('setCurrentMaskUrl', () => {
    it('sets currentMaskUrl', () => {
      const store = useMaskStore('test', createMockLabel3d());
      store.setCurrentMaskUrl('data:image/png;base64,abc');
      expect(store.currentMaskUrl).toBe('data:image/png;base64,abc');
    });

    it('clears currentMaskUrl when set to null', () => {
      const store = useMaskStore('test', createMockLabel3d());
      store.setCurrentMaskUrl('data:image/png;base64,abc');
      store.setCurrentMaskUrl(null);
      expect(store.currentMaskUrl).toBeNull();
    });
  });

  describe('maskSettings mutation', () => {
    it('can update individual settings', () => {
      const store = useMaskStore('test', createMockLabel3d());
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
    it('two stores with different ids have independent state', () => {
      const store1 = useMaskStore('a', createMockLabel3d());
      const store2 = useMaskStore('b', createMockLabel3d());

      store1.setCurrentMaskUrl('url-a');
      store1.maskSettings.color = '#ff0000';

      expect(store1.currentMaskUrl).toBe('url-a');
      expect(store2.currentMaskUrl).toBeNull();
      expect(store1.maskSettings.color).toBe('#ff0000');
      expect(store2.maskSettings.color).toBe('#0096ff');
    });
  });
});
