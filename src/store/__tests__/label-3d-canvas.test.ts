import { describe, it, expect, beforeEach } from 'vitest';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import type { AnnotationObject, FrontendBox, FrontendPoint } from '@/lib/annotationMapping';

function findObjectWithBoxId(objects: AnnotationObject[], boxId: string): AnnotationObject {
  return objects.find((o) => o.boxes.some((b) => b.id === boxId))!;
}

function findBox(objects: AnnotationObject[], boxId: string): FrontendBox {
  return findObjectWithBoxId(objects, boxId).boxes.find((b) => b.id === boxId)!;
}

function findObjectById(objects: AnnotationObject[], id: string): AnnotationObject {
  return objects.find((o) => o.id === id)!;
}

// Reset store between tests
beforeEach(() => {
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

describe('label-3d-canvas store', () => {
  // ─── basic setters ───────────────────────────────────────────────

  describe('setMode', () => {
    it('sets mode and clears selection', () => {
      useLabel3DCanvasStore.setState({
        selectedObjectId: 'obj-1',
        selectedAnnotationId: 'ann-1',
      });
      useLabel3DCanvasStore.getState().setMode('select');
      const s = useLabel3DCanvasStore.getState();
      expect(s.mode).toBe('select');
      expect(s.selectedObjectId).toBeNull();
      expect(s.selectedAnnotationId).toBeNull();
    });
  });

  describe('setTool', () => {
    it('sets tool and switches mode to create', () => {
      useLabel3DCanvasStore.getState().setMode('select');
      useLabel3DCanvasStore.getState().setTool('box');
      const s = useLabel3DCanvasStore.getState();
      expect(s.tool).toBe('box');
      expect(s.mode).toBe('create');
    });
  });

  describe('setPendingAnnotation', () => {
    it('sets pending and shows popup when non-null', () => {
      useLabel3DCanvasStore.getState().setPendingAnnotation({
        type: 'point',
        point: { id: 'p1', x: 10, y: 20, label: 1 },
      });
      const s = useLabel3DCanvasStore.getState();
      expect(s.pendingAnnotation).not.toBeNull();
      expect(s.showObjectSelectPopup).toBe(true);
    });

    it('hides popup when set to null', () => {
      useLabel3DCanvasStore.setState({ showObjectSelectPopup: true });
      useLabel3DCanvasStore.getState().setPendingAnnotation(null);
      expect(useLabel3DCanvasStore.getState().showObjectSelectPopup).toBe(false);
    });
  });

  describe('setShowObjectSelectPopup', () => {
    it('clears pendingAnnotation when closing', () => {
      useLabel3DCanvasStore.setState({
        pendingAnnotation: { type: 'point', point: { id: 'p1', x: 10, y: 20, label: 1 } },
      });
      useLabel3DCanvasStore.getState().setShowObjectSelectPopup(false);
      const s = useLabel3DCanvasStore.getState();
      expect(s.showObjectSelectPopup).toBe(false);
      expect(s.pendingAnnotation).toBeNull();
    });
  });

  // ─── object CRUD ─────────────────────────────────────────────────

  describe('addObject', () => {
    it('creates object and sets currentObjectId', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1');
      expect(obj).not.toBeNull();
      expect(obj!.labelId).toBe('label-1');
      expect(obj!.points).toEqual([]);
      expect(obj!.boxes).toEqual([]);
      expect(useLabel3DCanvasStore.getState().currentObjectId).toBe(obj!.id);
    });

    it('returns the created object', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1');
      const s = useLabel3DCanvasStore.getState();
      expect(s.objects).toHaveLength(1);
      expect(s.objects[0].id).toBe(obj!.id);
    });
  });

  describe('removeObject', () => {
    it('removes object and cleans up references', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore.getState().selectObject(obj.id);
      useLabel3DCanvasStore.getState().removeObject(obj.id);
      const s = useLabel3DCanvasStore.getState();
      expect(s.objects).toHaveLength(0);
      expect(s.selectedObjectId).toBeNull();
      expect(s.currentObjectId).toBeNull();
      expect(s.dirty).toBe(true);
    });

    it('clears selectedAnnotation if annotation no longer exists', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      const point: FrontendPoint = { id: 'p1', x: 10, y: 20, label: 1 };
      useLabel3DCanvasStore.getState().addPointToObject(obj.id, point);
      useLabel3DCanvasStore.getState().selectAnnotation('p1');
      useLabel3DCanvasStore.getState().removeObject(obj.id);
      expect(useLabel3DCanvasStore.getState().selectedAnnotationId).toBeNull();
    });
  });

  describe('addPointToObject', () => {
    it('adds point and marks dirty', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      const point: FrontendPoint = { id: 'p1', x: 10, y: 20, label: 1 };
      useLabel3DCanvasStore.getState().addPointToObject(obj.id, point);
      const s = useLabel3DCanvasStore.getState();
      expect(s.objects[0].points).toHaveLength(1);
      expect(s.objects[0].points[0].id).toBe('p1');
      expect(s.dirty).toBe(true);
      expect(s.currentObjectId).toBeNull();
      expect(s.selectedAnnotationId).toBe('p1');
    });
  });

  describe('addBoxToObject', () => {
    it('adds box and marks dirty', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      const box: FrontendBox = { id: 'b1', x1: 10, y1: 10, x2: 50, y2: 50 };
      useLabel3DCanvasStore.getState().addBoxToObject(obj.id, box);
      const s = useLabel3DCanvasStore.getState();
      expect(s.objects[0].boxes).toHaveLength(1);
      expect(s.objects[0].boxes[0].id).toBe('b1');
      expect(s.dirty).toBe(true);
      expect(s.currentObjectId).toBeNull();
      expect(s.selectedAnnotationId).toBe('b1');
    });
  });

  describe('removeAnnotationFromObject', () => {
    it('removes point by id', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
      useLabel3DCanvasStore.getState().removeAnnotationFromObject('p1');
      expect(useLabel3DCanvasStore.getState().objects[0].points).toHaveLength(0);
    });

    it('removes box by id', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj.id, { id: 'b1', x1: 10, y1: 10, x2: 50, y2: 50 });
      useLabel3DCanvasStore.getState().removeAnnotationFromObject('b1');
      expect(useLabel3DCanvasStore.getState().objects[0].boxes).toHaveLength(0);
    });

    it('clears selectedAnnotationId if removing selected annotation', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
      useLabel3DCanvasStore.getState().selectAnnotation('p1');
      useLabel3DCanvasStore.getState().removeAnnotationFromObject('p1');
      expect(useLabel3DCanvasStore.getState().selectedAnnotationId).toBeNull();
    });

    it('does nothing for non-existent id', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
      useLabel3DCanvasStore.getState().removeAnnotationFromObject('nonexistent');
      expect(useLabel3DCanvasStore.getState().objects[0].points).toHaveLength(1);
    });
  });

  describe('updateAnnotationInObject', () => {
    it('updates point properties', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
      useLabel3DCanvasStore.getState().updateAnnotationInObject('p1', { x: 100, y: 200 });
      const point = useLabel3DCanvasStore.getState().objects[0].points[0];
      expect(point.x).toBe(100);
      expect(point.y).toBe(200);
    });

    it('updates box properties', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj.id, { id: 'b1', x1: 10, y1: 10, x2: 50, y2: 50 });
      useLabel3DCanvasStore.getState().updateAnnotationInObject('b1', { x1: 20, y1: 20 });
      const box = useLabel3DCanvasStore.getState().objects[0].boxes[0];
      expect(box.x1).toBe(20);
      expect(box.y1).toBe(20);
    });
  });

  describe('setAsVisualBox', () => {
    it('sets selected box as visual and clears others of same label', () => {
      const obj1 = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj1.id, { id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });
      const obj2 = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj2.id, { id: 'b2', x1: 5, y1: 5, x2: 15, y2: 15 });
      const obj3 = useLabel3DCanvasStore.getState().addObject('label-2')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj3.id, { id: 'b3', x1: 20, y1: 20, x2: 30, y2: 30 });

      useLabel3DCanvasStore.getState().setAsVisualBox('b1');

      const s = useLabel3DCanvasStore.getState();
      // b1 should be visual
      const b1 = findBox(s.objects, 'b1');
      expect(b1.boxType).toBe('visual_ref');
      // b2 (same label) should be cleared
      const b2 = findBox(s.objects, 'b2');
      expect(b2.boxType).toBeUndefined();
      // b3 (different label) should not be affected
      const b3 = findBox(s.objects, 'b3');
      expect(b3.boxType).toBeUndefined();
    });
  });

  describe('reassignAnnotation', () => {
    it('moves point from one object to another', () => {
      const obj1 = useLabel3DCanvasStore.getState().addObject('label-1')!;
      const obj2 = useLabel3DCanvasStore.getState().addObject('label-2')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj1.id, { id: 'p1', x: 10, y: 20, label: 1 });

      useLabel3DCanvasStore.getState().reassignAnnotation('p1', obj2.id);

      const s = useLabel3DCanvasStore.getState();
      expect(findObjectById(s.objects, obj1.id).points).toHaveLength(0);
      expect(findObjectById(s.objects, obj2.id).points).toHaveLength(1);
      expect(s.dirty).toBe(true);
    });

    it('moves box from one object to another', () => {
      const obj1 = useLabel3DCanvasStore.getState().addObject('label-1')!;
      const obj2 = useLabel3DCanvasStore.getState().addObject('label-2')!;
      useLabel3DCanvasStore
        .getState()
        .addBoxToObject(obj1.id, { id: 'b1', x1: 10, y1: 10, x2: 50, y2: 50 });

      useLabel3DCanvasStore.getState().reassignAnnotation('b1', obj2.id);

      const s = useLabel3DCanvasStore.getState();
      expect(findObjectById(s.objects, obj1.id).boxes).toHaveLength(0);
      expect(findObjectById(s.objects, obj2.id).boxes).toHaveLength(1);
    });
  });

  // ─── selection ───────────────────────────────────────────────────

  describe('selectAnnotation', () => {
    it('selects annotation and its parent object', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore
        .getState()
        .addPointToObject(obj.id, { id: 'p1', x: 10, y: 20, label: 1 });
      useLabel3DCanvasStore.getState().selectAnnotation('p1');
      const s = useLabel3DCanvasStore.getState();
      expect(s.selectedAnnotationId).toBe('p1');
      expect(s.selectedObjectId).toBe(obj.id);
    });

    it('clears selection when null', () => {
      useLabel3DCanvasStore.getState().selectAnnotation(null);
      expect(useLabel3DCanvasStore.getState().selectedAnnotationId).toBeNull();
    });
  });

  describe('selectObject', () => {
    it('selects object and clears annotation selection', () => {
      const obj = useLabel3DCanvasStore.getState().addObject('label-1')!;
      useLabel3DCanvasStore.getState().selectAnnotation('p1');
      useLabel3DCanvasStore.getState().selectObject(obj.id);
      const s = useLabel3DCanvasStore.getState();
      expect(s.selectedObjectId).toBe(obj.id);
      expect(s.selectedAnnotationId).toBeNull();
    });
  });

  describe('clearSelection', () => {
    it('clears both selections', () => {
      useLabel3DCanvasStore.setState({
        selectedObjectId: 'obj-1',
        selectedAnnotationId: 'ann-1',
      });
      useLabel3DCanvasStore.getState().clearSelection();
      const s = useLabel3DCanvasStore.getState();
      expect(s.selectedObjectId).toBeNull();
      expect(s.selectedAnnotationId).toBeNull();
    });
  });

  // ─── loadObjects / resetCanvas ───────────────────────────────────

  describe('loadObjects', () => {
    it('replaces objects and clears selection + dirty', () => {
      useLabel3DCanvasStore.setState({
        dirty: true,
        selectedObjectId: 'x',
        selectedAnnotationId: 'y',
      });
      const objects: AnnotationObject[] = [{ id: 'o1', labelId: 'l1', points: [], boxes: [] }];
      useLabel3DCanvasStore.getState().loadObjects(objects);
      const s = useLabel3DCanvasStore.getState();
      expect(s.objects).toHaveLength(1);
      expect(s.objects[0].id).toBe('o1');
      expect(s.selectedObjectId).toBeNull();
      expect(s.selectedAnnotationId).toBeNull();
      expect(s.currentObjectId).toBeNull();
      expect(s.dirty).toBe(false);
    });
  });

  describe('resetCanvas', () => {
    it('resets scale and position', () => {
      useLabel3DCanvasStore.setState({
        stageScale: 3,
        stagePos: { x: 100, y: 200 },
      });
      useLabel3DCanvasStore.getState().resetCanvas();
      const s = useLabel3DCanvasStore.getState();
      expect(s.stageScale).toBe(1);
      expect(s.stagePos).toEqual({ x: 0, y: 0 });
    });
  });

  // ─── image dimensions ────────────────────────────────────────────

  describe('setImageDimensions', () => {
    it('sets width and height', () => {
      useLabel3DCanvasStore.getState().setImageDimensions(1024, 768);
      const s = useLabel3DCanvasStore.getState();
      expect(s.imageWidth).toBe(1024);
      expect(s.imageHeight).toBe(768);
    });
  });

  describe('setFitImageTrigger', () => {
    it('increments trigger counter', () => {
      useLabel3DCanvasStore.getState().setFitImageTrigger();
      useLabel3DCanvasStore.getState().setFitImageTrigger();
      expect(useLabel3DCanvasStore.getState().fitImageTrigger).toBe(2);
    });
  });
});
