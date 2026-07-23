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
  setLogLevel: vi.fn(),
  setLogLevelFilter: vi.fn(),
  mcpStoreImageBytes: vi.fn(),
}));

vi.mock('@/composables/useRawRecognize', () => ({
  useRawRecognize: () => ({
    isRecognizing: ref(false),
    progress: ref({ current: 0, total: 0 }),
    stopRecognition: vi.fn(),
    recognizeCurrentSlice: vi.fn(),
    batchRecognize: vi.fn(),
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
    expect(store.objects).toHaveLength(0);
    expect(store.mode).toBe('create');
    expect(store.tool).toBe('p_point');
    expect(store.hasVolume).toBe(false);
  });

  it('addObject creates object', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });

    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].points).toHaveLength(1);
    expect(store.allPoints).toHaveLength(1);
  });

  it('removeAnnotationFromObject removes point', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.addBoxToObject(obj.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });

    expect(store.allAnnotations).toHaveLength(2);

    store.removeAnnotationFromObject('p1');

    expect(store.objects[0].points).toHaveLength(0);
    expect(store.objects[0].boxes).toHaveLength(1);
  });

  it('selectAnnotation clears selectedAnnotationId if removing selected', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.selectAnnotation('p1');
    expect(store.selectedAnnotationId).toBe('p1');

    store.removeAnnotationFromObject('p1');
    expect(store.selectedAnnotationId).toBeNull();
  });

  it('updateAnnotationInObject updates fields', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });

    store.updateAnnotationInObject('p1', { x: 100, y: 200 });

    expect(store.objects[0].points[0].x).toBe(100);
    expect(store.objects[0].points[0].y).toBe(200);
  });

  it('setMode clears selection', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.selectAnnotation('p1');
    expect(store.selectedAnnotationId).toBe('p1');

    store.setMode('delete');
    expect(store.mode).toBe('delete');
    expect(store.selectedAnnotationId).toBeNull();
  });

  it('setTool sets mode to create', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();

    store.setMode('delete');
    store.setTool('box');

    expect(store.tool).toBe('box');
    expect(store.mode).toBe('create');
  });

  it('clearObjects clears all', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    store.addObject('tumor');
    store.clearObjects();

    expect(store.objects).toHaveLength(0);
    expect(store.currentObjectId).toBeNull();
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

  it('computed allAnnotations aggregates across objects', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj1 = store.addObject('tumor');
    const obj2 = store.addObject('organ');
    store.addPointToObject(obj1.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.addPointToObject(obj1.id, { id: 'p2', x: 3, y: 4, label: 0 });
    store.addBoxToObject(obj1.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });
    store.addPointToObject(obj2.id, { id: 'p3', x: 5, y: 6, label: 1 });

    expect(store.allPoints).toHaveLength(3);
    expect(store.allBoxes).toHaveLength(1);
    expect(store.allAnnotations).toHaveLength(4);
  });

  it('selectedAnnotation returns correct annotation', async () => {
    const { useLabelRawStore } = await import('../label-raw');
    const store = useLabelRawStore();
    store.volumeId = 'vol-1';

    const obj = store.addObject('tumor');
    store.addPointToObject(obj.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.addBoxToObject(obj.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });

    // Adding an annotation auto-selects it
    expect(store.selectedAnnotation?.id).toBe('b1');

    store.selectAnnotation('p1');
    expect(store.selectedAnnotation?.id).toBe('p1');

    store.selectAnnotation(null);
    expect(store.selectedAnnotation).toBeNull();
  });
});
