import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLabel2dCanvasStore } from '@/stores/canvas-2d';
import { useLabel3dCanvasStore } from '@/stores/canvas-3d';
import type { PointAnnotation, BoxAnnotation } from '@/schemas/annotation';

vi.mock('@/services/cmd', () => ({ logMessage: vi.fn() }));

describe('canvas store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useLabel2dCanvasStore();
      expect(store.mode).toBe('create');
      expect(store.tool).toBe('p_point');
      expect(store.objects).toEqual([]);
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
      expect(store.currentObjectId).toBeNull();
      expect(store.stageScale).toBe(1);
      expect(store.stagePos).toEqual({ x: 0, y: 0 });
      expect(store.imageWidth).toBe(0);
      expect(store.imageHeight).toBe(0);
      expect(store.showNameDialog).toBe(false);
      expect(store.showSelectDialog).toBe(false);
      expect(store.pendingAnnotation).toBeNull();
    });
  });

  describe('setMode', () => {
    it('changes mode', async () => {
      const store = useLabel2dCanvasStore();
      await store.setMode('select');
      expect(store.mode).toBe('select');
    });

    it('clears selection', async () => {
      const store = useLabel2dCanvasStore();
      store.selectedObjectId = 'some-id';
      store.selectedAnnotationId = 'some-ann-id';
      await store.setMode('delete');
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('setTool', () => {
    it('changes tool', async () => {
      const store = useLabel2dCanvasStore();
      await store.setTool('box');
      expect(store.tool).toBe('box');
    });

    it('sets mode to create', async () => {
      const store = useLabel2dCanvasStore();
      store.mode = 'select';
      await store.setTool('n_point');
      expect(store.mode).toBe('create');
    });
  });

  describe('addObject', () => {
    it('creates object with correct labelId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('label-1');
      expect(obj.labelId).toBe('label-1');
      expect(obj.id).toBeDefined();
      expect(obj.points).toEqual([]);
      expect(obj.boxes).toEqual([]);
    });

    it('appends to objects array', async () => {
      const store = useLabel2dCanvasStore();
      await store.addObject('l1');
      await store.addObject('l2');
      expect(store.objects).toHaveLength(2);
      expect(store.objects[0].labelId).toBe('l1');
      expect(store.objects[1].labelId).toBe('l2');
    });

    it('sets currentObjectId to new object', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('label-1');
      expect(store.currentObjectId).toBe(obj.id);
    });
  });

  describe('removeObject', () => {
    it('removes object by id', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      await store.removeObject(obj1.id);
      expect(store.objects).toHaveLength(1);
      expect(store.objects[0].id).toBe(obj2.id);
    });

    it('clears selectedObjectId if it matches', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      store.selectObject(obj.id);
      await store.removeObject(obj.id);
      expect(store.selectedObjectId).toBeNull();
    });

    it('clears currentObjectId if it matches', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      expect(store.currentObjectId).toBe(obj.id);
      await store.removeObject(obj.id);
      expect(store.currentObjectId).toBeNull();
    });

    it('clears selectedAnnotationId if annotation is in removed object', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 10, y: 20, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotationId).toBe(point.id);
      await store.removeObject(obj.id);
      expect(store.selectedAnnotationId).toBeNull();
    });

    it('preserves selectedAnnotationId if annotation exists in another object', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 10, y: 20, label: 0 };
      store.addPointToObject(obj2.id, point);
      await store.removeObject(obj1.id);
      expect(store.selectedAnnotationId).toBe(point.id);
    });
  });

  describe('setCurrentObject', () => {
    it('sets currentObjectId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      store.setCurrentObject(null);
      expect(store.currentObjectId).toBeNull();
      store.setCurrentObject(obj.id);
      expect(store.currentObjectId).toBe(obj.id);
    });
  });

  describe('addPointToObject', () => {
    it('adds point to correct object', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      await store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 1 };
      store.addPointToObject(obj1.id, point);
      expect(store.objects[0].points).toHaveLength(1);
      expect(store.objects[0].points[0]).toEqual(point);
      expect(store.objects[1].points).toHaveLength(0);
    });

    it('clears currentObjectId and sets selectedAnnotationId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.currentObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBe(point.id);
    });
  });

  describe('addBoxToObject', () => {
    it('adds box to correct object', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 100, y2: 100 };
      store.addBoxToObject(obj.id, box);
      expect(store.objects[0].boxes).toHaveLength(1);
      expect(store.objects[0].boxes[0]).toEqual(box);
    });

    it('clears currentObjectId and sets selectedAnnotationId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 50, y2: 50 };
      store.addBoxToObject(obj.id, box);
      expect(store.currentObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBe(box.id);
    });
  });

  describe('removeAnnotationFromObject', () => {
    it('removes a point', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.removeAnnotationFromObject(point.id);
      expect(store.objects[0].points).toHaveLength(0);
    });

    it('removes a box', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      store.removeAnnotationFromObject(box.id);
      expect(store.objects[0].boxes).toHaveLength(0);
    });

    it('clears selectedAnnotationId if it matches', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.removeAnnotationFromObject(point.id);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('updateAnnotationInObject', () => {
    it('updates a point', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.updateAnnotationInObject(point.id, { x: 99, y: 88 });
      expect(store.objects[0].points[0].x).toBe(99);
      expect(store.objects[0].points[0].y).toBe(88);
    });

    it('updates a box', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      store.updateAnnotationInObject(box.id, { x2: 200, y2: 300 });
      expect(store.objects[0].boxes[0].x2).toBe(200);
      expect(store.objects[0].boxes[0].y2).toBe(300);
    });
  });

  describe('reassignAnnotation', () => {
    it('moves a point between objects', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 0 };
      store.addPointToObject(obj1.id, point);
      store.reassignAnnotation(point.id, obj2.id);
      expect(store.objects[0].points).toHaveLength(0);
      expect(store.objects[1].points).toHaveLength(1);
      expect(store.objects[1].points[0].id).toBe(point.id);
    });

    it('moves a box between objects', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 50, y2: 50 };
      store.addBoxToObject(obj1.id, box);
      store.reassignAnnotation(box.id, obj2.id);
      expect(store.objects[0].boxes).toHaveLength(0);
      expect(store.objects[1].boxes).toHaveLength(1);
      expect(store.objects[1].boxes[0].id).toBe(box.id);
    });
  });

  describe('selectAnnotation', () => {
    it('sets selectedAnnotationId and selectedObjectId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.clearSelection();
      store.selectAnnotation(point.id);
      expect(store.selectedAnnotationId).toBe(point.id);
      expect(store.selectedObjectId).toBe(obj.id);
    });

    it('clears with null', () => {
      const store = useLabel2dCanvasStore();
      store.selectAnnotation(null);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('selectObject', () => {
    it('sets selectedObjectId and clears selectedAnnotationId', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotationId).toBe(point.id);
      store.selectObject(obj.id);
      expect(store.selectedObjectId).toBe(obj.id);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('clears both selection refs', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      store.selectObject(obj.id);
      store.clearSelection();
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('clearObjects', () => {
    it('resets objects and all selection refs', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      await store.clearObjects();
      expect(store.objects).toEqual([]);
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
      expect(store.currentObjectId).toBeNull();
    });
  });

  describe('resetCanvas', () => {
    it('resets stageScale and stagePos', () => {
      const store = useLabel2dCanvasStore();
      store.stageScale = 2.5;
      store.stagePos = { x: 100, y: 200 };
      store.resetCanvas();
      expect(store.stageScale).toBe(1);
      expect(store.stagePos).toEqual({ x: 0, y: 0 });
    });
  });

  describe('computed', () => {
    it('currentObject returns matching object or null', async () => {
      const store = useLabel2dCanvasStore();
      expect(store.currentObject).toBeNull();
      const obj = await store.addObject('l1');
      expect(store.currentObject?.id).toBe(obj.id);
      store.setCurrentObject(null);
      expect(store.currentObject).toBeNull();
    });

    it('allPoints aggregates points from all objects', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      const p1: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      const p2: PointAnnotation = { id: crypto.randomUUID(), x: 3, y: 4, label: 1 };
      store.addPointToObject(obj1.id, p1);
      store.addPointToObject(obj2.id, p2);
      expect(store.allPoints).toHaveLength(2);
      expect(store.allPoints.map((p) => p.id)).toContain(p1.id);
      expect(store.allPoints.map((p) => p.id)).toContain(p2.id);
    });

    it('allBoxes aggregates boxes from all objects', async () => {
      const store = useLabel2dCanvasStore();
      const obj1 = await store.addObject('l1');
      const obj2 = await store.addObject('l2');
      const b1: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      const b2: BoxAnnotation = { id: crypto.randomUUID(), x1: 5, y1: 5, x2: 15, y2: 15 };
      store.addBoxToObject(obj1.id, b1);
      store.addBoxToObject(obj2.id, b2);
      expect(store.allBoxes).toHaveLength(2);
    });

    it('allAnnotations combines points and boxes', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const p: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      const b: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addPointToObject(obj.id, p);
      store.addBoxToObject(obj.id, b);
      expect(store.allAnnotations).toHaveLength(2);
    });

    it('selectedAnnotation returns matching annotation or null', async () => {
      const store = useLabel2dCanvasStore();
      expect(store.selectedAnnotation).toBeNull();
      const obj = await store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotation?.id).toBe(point.id);
      store.clearSelection();
      expect(store.selectedAnnotation).toBeNull();
    });

    it('selectedAnnotation finds box annotations', async () => {
      const store = useLabel2dCanvasStore();
      const obj = await store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      expect(store.selectedAnnotation?.id).toBe(box.id);
    });
  });

  describe('multi-instance independence', () => {
    it('2d and 3d stores have independent state', async () => {
      setActivePinia(createPinia());
      const storeA = useLabel2dCanvasStore();

      setActivePinia(createPinia());
      const storeB = useLabel3dCanvasStore();

      await storeA.addObject('label-a');
      await storeB.addObject('label-b');
      await storeB.addObject('label-b2');

      expect(storeA.objects).toHaveLength(1);
      expect(storeB.objects).toHaveLength(2);
      expect(storeA.objects[0].labelId).toBe('label-a');
      expect(storeB.objects[0].labelId).toBe('label-b');

      await storeA.setMode('select');
      await storeB.setTool('box');

      expect(storeA.mode).toBe('select');
      expect(storeA.tool).toBe('p_point');
      expect(storeB.mode).toBe('create');
      expect(storeB.tool).toBe('box');
    });
  });

  describe('useLabel3dCanvasStore', () => {
    it('has correct initial state', () => {
      const store = useLabel3dCanvasStore();
      expect(store.mode).toBe('create');
      expect(store.tool).toBe('p_point');
      expect(store.objects).toEqual([]);
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
      expect(store.currentObjectId).toBeNull();
      expect(store.stageScale).toBe(1);
      expect(store.stagePos).toEqual({ x: 0, y: 0 });
      expect(store.imageWidth).toBe(0);
      expect(store.imageHeight).toBe(0);
      expect(store.showNameDialog).toBe(false);
      expect(store.showSelectDialog).toBe(false);
      expect(store.pendingAnnotation).toBeNull();
    });

    it('setMode changes mode', async () => {
      const store = useLabel3dCanvasStore();
      await store.setMode('select');
      expect(store.mode).toBe('select');
    });

    it('setTool changes tool and resets mode to create', async () => {
      const store = useLabel3dCanvasStore();
      store.mode = 'select';
      await store.setTool('box');
      expect(store.tool).toBe('box');
      expect(store.mode).toBe('create');
    });

    it('addObject creates object with correct labelId', async () => {
      const store = useLabel3dCanvasStore();
      const obj = await store.addObject('label-3d');
      expect(obj.labelId).toBe('label-3d');
      expect(obj.id).toBeDefined();
      expect(store.objects).toHaveLength(1);
      expect(store.currentObjectId).toBe(obj.id);
    });

    it('3d store is independent of 2d store', async () => {
      setActivePinia(createPinia());
      const store3d = useLabel3dCanvasStore();
      const store2d = useLabel2dCanvasStore();

      await store3d.addObject('3d-label');
      await store2d.addObject('2d-label');

      expect(store3d.objects).toHaveLength(1);
      expect(store2d.objects).toHaveLength(1);
      expect(store3d.objects[0].labelId).toBe('3d-label');
      expect(store2d.objects[0].labelId).toBe('2d-label');

      await store3d.setTool('box');
      expect(store3d.tool).toBe('box');
      expect(store2d.tool).toBe('p_point');
    });
  });
});
