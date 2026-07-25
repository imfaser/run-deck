import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

describe('label store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initial state', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    expect(store.imagePath).toBeNull();
    expect(store.imageUrl).toBeNull();
    expect(store.mode).toBe('create');
    expect(store.tool).toBe('p_point');
    expect(store.objects).toHaveLength(0);
    expect(store.selectedObjectId).toBeNull();
    expect(store.selectedAnnotationId).toBeNull();
    expect(store.currentObjectId).toBeNull();
    expect(store.stageScale).toBe(1);
    expect(store.stagePos).toEqual({ x: 0, y: 0 });
    expect(store.maskVisible).toBe(true);
    expect(store.maskSettings.opacity).toBe(0.6);
  });

  it('addObject creates object and sets currentObjectId', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');

    expect(store.objects).toHaveLength(1);
    expect(obj.labelId).toBe('test-label-id');
    expect(obj.points).toHaveLength(0);
    expect(obj.boxes).toHaveLength(0);
    expect(store.currentObjectId).toBe(obj.id);
  });

  it('addPointToObject adds point to correct object', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });

    expect(store.objects[0].points).toHaveLength(1);
    expect(store.objects[0].points[0].label).toBe(1);
    expect(store.allPoints).toHaveLength(1);
  });

  it('addBoxToObject adds box to correct object', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.addBoxToObject(obj.id, { id: 'b1', x1: 0, y1: 0, x2: 100, y2: 100 });

    expect(store.objects[0].boxes).toHaveLength(1);
    expect(store.allBoxes).toHaveLength(1);
  });

  it('removeObject removes object and clears currentObjectId', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.removeObject(obj.id);

    expect(store.objects).toHaveLength(0);
    expect(store.currentObjectId).toBeNull();
  });

  it('removeAnnotationFromObject removes point', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
    store.addPointToObject(obj.id, { id: 'p2', x: 30, y: 40, label: 0 });

    store.removeAnnotationFromObject('p1');

    expect(store.objects[0].points).toHaveLength(1);
    expect(store.objects[0].points[0].id).toBe('p2');
  });

  it('selectAnnotation selects and sets selectedObjectId', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });

    store.selectAnnotation('p1');

    expect(store.selectedAnnotationId).toBe('p1');
    expect(store.selectedObjectId).toBe(obj.id);
  });

  it('setMode clears selection', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('test-label-id');
    store.addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
    store.selectAnnotation('p1');

    store.setMode('delete');
    expect(store.mode).toBe('delete');
    expect(store.selectedAnnotationId).toBeNull();
  });

  it('setTool sets mode to create', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    store.setMode('delete');
    store.setTool('box');

    expect(store.tool).toBe('box');
    expect(store.mode).toBe('create');
  });

  it('clearObjects clears all', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    store.addObject('car');
    store.clearObjects();

    expect(store.objects).toHaveLength(0);
    expect(store.currentObjectId).toBeNull();
    expect(store.selectedObjectId).toBeNull();
  });

  it('resetCanvas resets scale and position', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    store.stageScale = 5;
    store.stagePos = { x: 100, y: 200 };

    store.resetCanvas();

    expect(store.stageScale).toBe(1);
    expect(store.stagePos).toEqual({ x: 0, y: 0 });
  });

  it('computed allAnnotations aggregates across objects', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const car = store.addObject('car');
    const book = store.addObject('book');
    store.addPointToObject(car.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.addPointToObject(car.id, { id: 'p2', x: 3, y: 4, label: 0 });
    store.addBoxToObject(car.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });
    store.addPointToObject(book.id, { id: 'p3', x: 5, y: 6, label: 1 });

    expect(store.allPoints).toHaveLength(3);
    expect(store.allBoxes).toHaveLength(1);
    expect(store.allAnnotations).toHaveLength(4);
  });

  it('selectedAnnotation returns correct annotation', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    const obj = store.addObject('car');
    store.addPointToObject(obj.id, { id: 'p1', x: 1, y: 2, label: 1 });
    store.addBoxToObject(obj.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });

    // Adding an annotation auto-selects it
    expect(store.selectedAnnotation?.id).toBe('b1');

    store.selectAnnotation('p1');
    expect(store.selectedAnnotation?.id).toBe('p1');

    store.selectAnnotation(null);
    expect(store.selectedAnnotation).toBeNull();
  });

  it('mask state defaults', async () => {
    const { useLabelStore } = await import('../label');
    const store = useLabelStore();

    expect(store.maskUrl).toBeNull();
    expect(store.maskVisible).toBe(true);
    expect(store.maskSettings.opacity).toBe(0.6);
    expect(store.maskSettings.color).toBe('#0096ff');
    expect(store.maskSettings.threshold).toBe(128);
    expect(store.rawMaskPath).toBeNull();
  });
});
