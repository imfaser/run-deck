import type { Ref } from 'vue';
import type {
  AnnotationType,
  LabelMode,
  AnnotationObject,
  PointAnnotation,
  BoxAnnotation,
} from '@/schemas/annotation';
import { objectColor } from '@/utils/objectColor';

export interface AnnotationState {
  mode: Ref<LabelMode>;
  tool: Ref<AnnotationType>;
  objects: Ref<AnnotationObject[]>;
  selectedObjectId: Ref<string | null>;
  selectedAnnotationId: Ref<string | null>;
  currentObjectId: Ref<string | null>;
  stageScale: Ref<number>;
  stagePos: Ref<{ x: number; y: number }>;
}

export function createAnnotationActions(state: AnnotationState) {
  // ─── Object CRUD ─────────────────────────────────
  function addObject(name: string): AnnotationObject {
    const obj: AnnotationObject = {
      id: crypto.randomUUID(),
      name,
      color: objectColor(name),
      points: [],
      boxes: [],
    };
    state.objects.value.push(obj);
    state.currentObjectId.value = obj.id;
    return obj;
  }

  function removeObject(id: string) {
    state.objects.value = state.objects.value.filter((o) => o.id !== id);
    if (state.selectedObjectId.value === id) state.selectedObjectId.value = null;
    if (state.currentObjectId.value === id) state.currentObjectId.value = null;
    if (state.selectedAnnotationId.value) {
      const stillExists = state.objects.value.some(
        (o) =>
          o.points.some((p) => p.id === state.selectedAnnotationId.value) ||
          o.boxes.some((b) => b.id === state.selectedAnnotationId.value)
      );
      if (!stillExists) state.selectedAnnotationId.value = null;
    }
  }

  function renameObject(id: string, newName: string) {
    const obj = state.objects.value.find((o) => o.id === id);
    if (obj) {
      obj.name = newName;
      obj.color = objectColor(newName);
    }
  }

  function recolorObject(id: string, color: string) {
    const obj = state.objects.value.find((o) => o.id === id);
    if (obj) obj.color = color;
  }

  function setCurrentObject(id: string | null) {
    state.currentObjectId.value = id;
  }

  // ─── Annotation CRUD (within objects) ────────────
  function addPointToObject(objectId: string, point: PointAnnotation) {
    const obj = state.objects.value.find((o) => o.id === objectId);
    if (obj) {
      obj.points.push(point);
      state.currentObjectId.value = null;
      state.selectedAnnotationId.value = point.id;
    }
  }

  function addBoxToObject(objectId: string, box: BoxAnnotation) {
    const obj = state.objects.value.find((o) => o.id === objectId);
    if (obj) {
      obj.boxes.push(box);
      state.currentObjectId.value = null;
      state.selectedAnnotationId.value = box.id;
    }
  }

  function removeAnnotationFromObject(annotationId: string) {
    for (const obj of state.objects.value) {
      const pointIdx = obj.points.findIndex((p) => p.id === annotationId);
      if (pointIdx !== -1) {
        obj.points.splice(pointIdx, 1);
        if (state.selectedAnnotationId.value === annotationId)
          state.selectedAnnotationId.value = null;
        return;
      }
      const boxIdx = obj.boxes.findIndex((b) => b.id === annotationId);
      if (boxIdx !== -1) {
        obj.boxes.splice(boxIdx, 1);
        if (state.selectedAnnotationId.value === annotationId)
          state.selectedAnnotationId.value = null;
        return;
      }
    }
  }

  function updateAnnotationInObject(
    annotationId: string,
    updates: Partial<PointAnnotation> | Partial<BoxAnnotation>
  ) {
    for (const obj of state.objects.value) {
      const point = obj.points.find((p) => p.id === annotationId);
      if (point) {
        Object.assign(point, updates);
        return;
      }
      const box = obj.boxes.find((b) => b.id === annotationId);
      if (box) {
        Object.assign(box, updates);
        return;
      }
    }
  }

  function reassignAnnotation(annotationId: string, targetObjectId: string) {
    let annotation: PointAnnotation | BoxAnnotation | null = null;
    let sourceType: 'point' | 'box' | null = null;

    // Find and remove from source
    for (const obj of state.objects.value) {
      const pointIdx = obj.points.findIndex((p) => p.id === annotationId);
      if (pointIdx !== -1) {
        annotation = obj.points.splice(pointIdx, 1)[0];
        sourceType = 'point';
        break;
      }
      const boxIdx = obj.boxes.findIndex((b) => b.id === annotationId);
      if (boxIdx !== -1) {
        annotation = obj.boxes.splice(boxIdx, 1)[0];
        sourceType = 'box';
        break;
      }
    }

    // Add to target
    if (annotation && sourceType) {
      const targetObj = state.objects.value.find((o) => o.id === targetObjectId);
      if (targetObj) {
        if (sourceType === 'point') {
          targetObj.points.push(annotation as PointAnnotation);
        } else {
          targetObj.boxes.push(annotation as BoxAnnotation);
        }
      }
    }
  }

  // ─── Selection ───────────────────────────────────
  function selectAnnotation(id: string | null) {
    state.selectedAnnotationId.value = id;
    if (id) {
      const obj = state.objects.value.find(
        (o) => o.points.some((p) => p.id === id) || o.boxes.some((b) => b.id === id)
      );
      if (obj) state.selectedObjectId.value = obj.id;
    }
  }

  function selectObject(id: string | null) {
    state.selectedObjectId.value = id;
    state.selectedAnnotationId.value = null;
  }

  function clearSelection() {
    state.selectedObjectId.value = null;
    state.selectedAnnotationId.value = null;
  }

  // ─── Mode / Tool ─────────────────────────────────
  function setMode(newMode: LabelMode) {
    state.mode.value = newMode;
    clearSelection();
  }

  function setTool(newTool: AnnotationType) {
    state.tool.value = newTool;
    state.mode.value = 'create';
  }

  // ─── Bulk ────────────────────────────────────────
  function clearObjects() {
    state.objects.value = [];
    state.selectedObjectId.value = null;
    state.selectedAnnotationId.value = null;
    state.currentObjectId.value = null;
  }

  function resetCanvas() {
    state.stageScale.value = 1;
    state.stagePos.value = { x: 0, y: 0 };
  }

  return {
    addObject,
    removeObject,
    renameObject,
    recolorObject,
    setCurrentObject,
    addPointToObject,
    addBoxToObject,
    removeAnnotationFromObject,
    updateAnnotationInObject,
    reassignAnnotation,
    selectAnnotation,
    selectObject,
    clearSelection,
    setMode,
    setTool,
    clearObjects,
    resetCanvas,
  };
}
