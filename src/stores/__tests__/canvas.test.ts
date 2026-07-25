/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import type { PointAnnotation, BoxAnnotation } from '@/schemas/annotation';

describe('canvas store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useCanvasStore('test');
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
    it('changes mode', () => {
      const store = useCanvasStore('test');
      store.setMode('select');
      expect(store.mode).toBe('select');
    });

    it('clears selection', () => {
      const store = useCanvasStore('test');
      store.selectedObjectId = 'some-id';
      store.selectedAnnotationId = 'some-ann-id';
      store.setMode('delete');
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('setTool', () => {
    it('changes tool', () => {
      const store = useCanvasStore('test');
      store.setTool('box');
      expect(store.tool).toBe('box');
    });

    it('sets mode to create', () => {
      const store = useCanvasStore('test');
      store.mode = 'select';
      store.setTool('n_point');
      expect(store.mode).toBe('create');
    });
  });

  describe('addObject', () => {
    it('creates object with correct labelId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('label-1');
      expect(obj.labelId).toBe('label-1');
      expect(obj.id).toBeDefined();
      expect(obj.points).toEqual([]);
      expect(obj.boxes).toEqual([]);
    });

    it('appends to objects array', () => {
      const store = useCanvasStore('test');
      store.addObject('l1');
      store.addObject('l2');
      expect(store.objects).toHaveLength(2);
      expect(store.objects[0].labelId).toBe('l1');
      expect(store.objects[1].labelId).toBe('l2');
    });

    it('sets currentObjectId to new object', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('label-1');
      expect(store.currentObjectId).toBe(obj.id);
    });
  });

  describe('removeObject', () => {
    it('removes object by id', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      store.removeObject(obj1.id);
      expect(store.objects).toHaveLength(1);
      expect(store.objects[0].id).toBe(obj2.id);
    });

    it('clears selectedObjectId if it matches', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      store.selectObject(obj.id);
      store.removeObject(obj.id);
      expect(store.selectedObjectId).toBeNull();
    });

    it('clears currentObjectId if it matches', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      expect(store.currentObjectId).toBe(obj.id);
      store.removeObject(obj.id);
      expect(store.currentObjectId).toBeNull();
    });

    it('clears selectedAnnotationId if annotation is in removed object', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 10, y: 20, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotationId).toBe(point.id);
      store.removeObject(obj.id);
      expect(store.selectedAnnotationId).toBeNull();
    });

    it('preserves selectedAnnotationId if annotation exists in another object', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 10, y: 20, label: 0 };
      store.addPointToObject(obj2.id, point);
      store.removeObject(obj1.id);
      expect(store.selectedAnnotationId).toBe(point.id);
    });
  });

  describe('setCurrentObject', () => {
    it('sets currentObjectId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      store.setCurrentObject(null);
      expect(store.currentObjectId).toBeNull();
      store.setCurrentObject(obj.id);
      expect(store.currentObjectId).toBe(obj.id);
    });
  });

  describe('addPointToObject', () => {
    it('adds point to correct object', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 1 };
      store.addPointToObject(obj1.id, point);
      expect(store.objects[0].points).toHaveLength(1);
      expect(store.objects[0].points[0]).toEqual(point);
      expect(store.objects[1].points).toHaveLength(0);
    });

    it('clears currentObjectId and sets selectedAnnotationId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.currentObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBe(point.id);
    });
  });

  describe('addBoxToObject', () => {
    it('adds box to correct object', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 100, y2: 100 };
      store.addBoxToObject(obj.id, box);
      expect(store.objects[0].boxes).toHaveLength(1);
      expect(store.objects[0].boxes[0]).toEqual(box);
    });

    it('clears currentObjectId and sets selectedAnnotationId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 50, y2: 50 };
      store.addBoxToObject(obj.id, box);
      expect(store.currentObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBe(box.id);
    });
  });

  describe('removeAnnotationFromObject', () => {
    it('removes a point', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.removeAnnotationFromObject(point.id);
      expect(store.objects[0].points).toHaveLength(0);
    });

    it('removes a box', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      store.removeAnnotationFromObject(box.id);
      expect(store.objects[0].boxes).toHaveLength(0);
    });

    it('clears selectedAnnotationId if it matches', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.removeAnnotationFromObject(point.id);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('updateAnnotationInObject', () => {
    it('updates a point', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.updateAnnotationInObject(point.id, { x: 99, y: 88 });
      expect(store.objects[0].points[0].x).toBe(99);
      expect(store.objects[0].points[0].y).toBe(88);
    });

    it('updates a box', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      store.updateAnnotationInObject(box.id, { x2: 200, y2: 300 });
      expect(store.objects[0].boxes[0].x2).toBe(200);
      expect(store.objects[0].boxes[0].y2).toBe(300);
    });
  });

  describe('reassignAnnotation', () => {
    it('moves a point between objects', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 5, y: 10, label: 0 };
      store.addPointToObject(obj1.id, point);
      store.reassignAnnotation(point.id, obj2.id);
      expect(store.objects[0].points).toHaveLength(0);
      expect(store.objects[1].points).toHaveLength(1);
      expect(store.objects[1].points[0].id).toBe(point.id);
    });

    it('moves a box between objects', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 50, y2: 50 };
      store.addBoxToObject(obj1.id, box);
      store.reassignAnnotation(box.id, obj2.id);
      expect(store.objects[0].boxes).toHaveLength(0);
      expect(store.objects[1].boxes).toHaveLength(1);
      expect(store.objects[1].boxes[0].id).toBe(box.id);
    });
  });

  describe('selectAnnotation', () => {
    it('sets selectedAnnotationId and selectedObjectId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.clearSelection();
      store.selectAnnotation(point.id);
      expect(store.selectedAnnotationId).toBe(point.id);
      expect(store.selectedObjectId).toBe(obj.id);
    });

    it('clears with null', () => {
      const store = useCanvasStore('test');
      store.selectAnnotation(null);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('selectObject', () => {
    it('sets selectedObjectId and clears selectedAnnotationId', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotationId).toBe(point.id);
      store.selectObject(obj.id);
      expect(store.selectedObjectId).toBe(obj.id);
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('clears both selection refs', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      store.selectObject(obj.id);
      store.clearSelection();
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
    });
  });

  describe('clearObjects', () => {
    it('resets objects and all selection refs', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      store.clearObjects();
      expect(store.objects).toEqual([]);
      expect(store.selectedObjectId).toBeNull();
      expect(store.selectedAnnotationId).toBeNull();
      expect(store.currentObjectId).toBeNull();
    });
  });

  describe('resetCanvas', () => {
    it('resets stageScale and stagePos', () => {
      const store = useCanvasStore('test');
      store.stageScale = 2.5;
      store.stagePos = { x: 100, y: 200 };
      store.resetCanvas();
      expect(store.stageScale).toBe(1);
      expect(store.stagePos).toEqual({ x: 0, y: 0 });
    });
  });

  describe('computed', () => {
    it('currentObject returns matching object or null', () => {
      const store = useCanvasStore('test');
      expect(store.currentObject).toBeNull();
      const obj = store.addObject('l1');
      expect(store.currentObject?.id).toBe(obj.id);
      store.setCurrentObject(null);
      expect(store.currentObject).toBeNull();
    });

    it('allPoints aggregates points from all objects', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      const p1: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      const p2: PointAnnotation = { id: crypto.randomUUID(), x: 3, y: 4, label: 1 };
      store.addPointToObject(obj1.id, p1);
      store.addPointToObject(obj2.id, p2);
      expect(store.allPoints).toHaveLength(2);
      expect(store.allPoints.map((p) => p.id)).toContain(p1.id);
      expect(store.allPoints.map((p) => p.id)).toContain(p2.id);
    });

    it('allBoxes aggregates boxes from all objects', () => {
      const store = useCanvasStore('test');
      const obj1 = store.addObject('l1');
      const obj2 = store.addObject('l2');
      const b1: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      const b2: BoxAnnotation = { id: crypto.randomUUID(), x1: 5, y1: 5, x2: 15, y2: 15 };
      store.addBoxToObject(obj1.id, b1);
      store.addBoxToObject(obj2.id, b2);
      expect(store.allBoxes).toHaveLength(2);
    });

    it('allAnnotations combines points and boxes', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const p: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      const b: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addPointToObject(obj.id, p);
      store.addBoxToObject(obj.id, b);
      expect(store.allAnnotations).toHaveLength(2);
    });

    it('selectedAnnotation returns matching annotation or null', () => {
      const store = useCanvasStore('test');
      expect(store.selectedAnnotation).toBeNull();
      const obj = store.addObject('l1');
      const point: PointAnnotation = { id: crypto.randomUUID(), x: 1, y: 2, label: 0 };
      store.addPointToObject(obj.id, point);
      expect(store.selectedAnnotation?.id).toBe(point.id);
      store.clearSelection();
      expect(store.selectedAnnotation).toBeNull();
    });

    it('selectedAnnotation finds box annotations', () => {
      const store = useCanvasStore('test');
      const obj = store.addObject('l1');
      const box: BoxAnnotation = { id: crypto.randomUUID(), x1: 0, y1: 0, x2: 10, y2: 10 };
      store.addBoxToObject(obj.id, box);
      expect(store.selectedAnnotation?.id).toBe(box.id);
    });
  });

  describe('multi-instance independence', () => {
    it('stores with different ids have independent state', () => {
      const storeA = useCanvasStore('a');
      const storeB = useCanvasStore('b');

      storeA.addObject('label-a');
      storeB.addObject('label-b');
      storeB.addObject('label-b2');

      expect(storeA.objects).toHaveLength(1);
      expect(storeB.objects).toHaveLength(2);
      expect(storeA.objects[0].labelId).toBe('label-a');
      expect(storeB.objects[0].labelId).toBe('label-b');

      storeA.setMode('select');
      storeB.setTool('box');

      expect(storeA.mode).toBe('select');
      expect(storeA.tool).toBe('p_point');
      expect(storeB.mode).toBe('create');
      expect(storeB.tool).toBe('box');
    });
  });
});
