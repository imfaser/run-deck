import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLabel2dStore } from '@/stores/label-2d';

describe('label-2d store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useLabel2dStore('test');
      expect(store.imagePath).toBeNull();
      expect(store.imageUrl).toBeNull();
      expect(store.maskUrl).toBeNull();
      expect(store.maskVisible).toBe(true);
      expect(store.rawMaskPath).toBeNull();
    });

    it('has correct maskSettings defaults', () => {
      const store = useLabel2dStore('test');
      expect(store.maskSettings).toEqual({
        color: '#0096ff',
        prevMaskColor: '#ef4444',
        opacity: 0.6,
        threshold: 128,
        prevMaskAssist: true,
      });
    });
  });

  describe('image state', () => {
    it('can set imagePath', () => {
      const store = useLabel2dStore('test');
      store.imagePath = '/path/to/image.png';
      expect(store.imagePath).toBe('/path/to/image.png');
    });

    it('can set imageUrl', () => {
      const store = useLabel2dStore('test');
      store.imageUrl = 'blob:http://localhost/abc';
      expect(store.imageUrl).toBe('blob:http://localhost/abc');
    });
  });

  describe('maskSettings', () => {
    it('can update individual fields', () => {
      const store = useLabel2dStore('test');
      store.maskSettings = { ...store.maskSettings, color: '#ff0000', threshold: 200 };
      expect(store.maskSettings.color).toBe('#ff0000');
      expect(store.maskSettings.threshold).toBe(200);
      expect(store.maskSettings.opacity).toBe(0.6);
    });
  });

  describe('multi-instance independence', () => {
    it('instances with different ids have independent state', () => {
      const storeA = useLabel2dStore('a');
      const storeB = useLabel2dStore('b');

      storeA.imagePath = '/a.png';
      storeA.maskVisible = false;

      expect(storeB.imagePath).toBeNull();
      expect(storeB.maskVisible).toBe(true);
    });
  });
});
