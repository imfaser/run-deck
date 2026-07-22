import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

vi.mock('@/services/raw3d', () => ({
  rawOpen: vi.fn(),
  rawSlice: vi.fn(),
  rawExportMasks: vi.fn(),
}));

vi.mock('@/services/cmd', () => ({
  logMessage: vi.fn(),
  mcpStoreImageBytes: vi.fn(),
}));

vi.mock('@/composables/useRawRecognize', () => ({
  useRawRecognize: () => ({
    isRecognizing: ref(false),
    progress: ref({ current: 0, total: 0 }),
    stopRecognition: vi.fn(),
    recognizeCurrentSlice: vi.fn(),
    batchProcessKeyframes: vi.fn(),
    recognizeAllSlices: vi.fn(),
  }),
}));

describe('label-raw store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initial state', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();

    expect(store.filePath).toBeNull();
    expect(store.volumeId).toBeNull();
    expect(store.volumeInfo.totalSlices).toBe(0);
    expect(store.currentIndex).toBe(0);
    expect(store.keyframes.size).toBe(0);
    expect(store.annotations).toHaveLength(0);
    expect(store.mode).toBe('create');
    expect(store.tool).toBe('p_point');
    expect(store.hasVolume).toBe(false);
  });

  it('addAnnotation adds to annotations', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({
      id: 'ann-1',
      type: 'p_point',
      x: 10,
      y: 20,
    });

    expect(store.annotations).toHaveLength(1);
    expect(store.annotations[0].id).toBe('ann-1');
    expect(store.positivePoints).toHaveLength(1);
    expect(store.negativePoints).toHaveLength(0);
    expect(store.boxes).toHaveLength(0);
  });

  it('addAnnotation ignores when no volume', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();

    store.addAnnotation({ id: 'ann-1', type: 'p_point', x: 10, y: 20 });

    expect(store.annotations).toHaveLength(0);
  });

  it('removeAnnotation removes by id', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 1, y: 2 });
    store.addAnnotation({ id: 'a2', type: 'box', x1: 0, y1: 0, x2: 10, y2: 10 });

    expect(store.annotations).toHaveLength(2);

    store.removeAnnotation('a1');

    expect(store.annotations).toHaveLength(1);
    expect(store.annotations[0].id).toBe('a2');
  });

  it('removeAnnotation clears selectedId if removing selected', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 1, y: 2 });
    store.selectAnnotation('a1');
    expect(store.selectedId).toBe('a1');

    store.removeAnnotation('a1');
    expect(store.selectedId).toBeNull();
  });

  it('updateAnnotation updates fields', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 10, y: 20 });

    store.updateAnnotation('a1', { x: 100, y: 200 });

    const ann = store.annotations[0];
    if (ann.type === 'p_point') {
      expect(ann.x).toBe(100);
      expect(ann.y).toBe(200);
    } else {
      throw new Error('Expected p_point annotation');
    }
  });

  it('setMode clears selection', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 1, y: 2 });
    store.selectAnnotation('a1');
    expect(store.selectedId).toBe('a1');

    store.setMode('delete');
    expect(store.mode).toBe('delete');
    expect(store.selectedId).toBeNull();
  });

  it('setTool sets mode to create', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();

    store.setMode('delete');
    store.setTool('box');

    expect(store.tool).toBe('box');
    expect(store.mode).toBe('create');
  });

  it('clearAnnotations clears all', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 1, y: 2 });
    store.addAnnotation({ id: 'a2', type: 'box', x1: 0, y1: 0, x2: 10, y2: 10 });
    store.selectAnnotation('a1');

    store.clearAnnotations();

    expect(store.annotations).toHaveLength(0);
    expect(store.selectedId).toBeNull();
  });

  it('resetCanvas resets scale and position', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();

    store.stageScale = 5;
    store.stagePos = { x: 100, y: 200 };

    store.resetCanvas();

    expect(store.stageScale).toBe(1);
    expect(store.stagePos).toEqual({ x: 0, y: 0 });
  });

  it('computed positivePoints/negativePoints/boxes filter correctly', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'p1', type: 'p_point', x: 1, y: 2 });
    store.addAnnotation({ id: 'n1', type: 'n_point', x: 3, y: 4 });
    store.addAnnotation({ id: 'b1', type: 'box', x1: 0, y1: 0, x2: 10, y2: 10 });
    store.addAnnotation({ id: 'p2', type: 'p_point', x: 5, y: 6 });

    expect(store.positivePoints).toHaveLength(2);
    expect(store.negativePoints).toHaveLength(1);
    expect(store.boxes).toHaveLength(1);
  });

  it('selectedAnnotation returns correct annotation', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addAnnotation({ id: 'a1', type: 'p_point', x: 1, y: 2 });
    store.addAnnotation({ id: 'a2', type: 'box', x1: 0, y1: 0, x2: 10, y2: 10 });

    expect(store.selectedAnnotation).toBeNull();

    store.selectAnnotation('a2');
    expect(store.selectedAnnotation?.id).toBe('a2');

    store.selectAnnotation(null);
    expect(store.selectedAnnotation).toBeNull();
  });
});
