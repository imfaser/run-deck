import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { LabelMode, AnnotationType } from '@/schemas/annotation';
import type { AnnotationObject, FrontendBox, FrontendPoint } from '@/lib/annotationMapping';

export type PendingAnnotation =
  | { type: 'point'; point: FrontendPoint }
  | { type: 'box'; box: FrontendBox }
  | null;

function hasAnnotation(obj: AnnotationObject, id: string): boolean {
  return obj.points.some((p) => p.id === id) || obj.boxes.some((b) => b.id === id);
}

interface Label3DCanvasState {
  mode: LabelMode;
  tool: AnnotationType;
  objects: AnnotationObject[];
  selectedObjectId: string | null;
  selectedAnnotationId: string | null;
  currentObjectId: string | null;
  stageScale: number;
  stagePos: { x: number; y: number };
  cursorImagePos: { x: number; y: number } | null;
  fitImageTrigger: number;
  pendingAnnotation: PendingAnnotation;
  showObjectSelectPopup: boolean;
  dirty: boolean;
  imageWidth: number;
  imageHeight: number;

  setMode: (mode: LabelMode) => void;
  setTool: (tool: AnnotationType) => void;
  setStageScale: (scale: number) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  setCursorImagePos: (pos: { x: number; y: number } | null) => void;
  setFitImageTrigger: () => void;
  setPendingAnnotation: (pending: PendingAnnotation) => void;
  setShowObjectSelectPopup: (show: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setImageDimensions: (width: number, height: number) => void;

  addObject: (labelId: string) => AnnotationObject | null;
  removeObject: (id: string) => void;
  setCurrentObject: (id: string | null) => void;
  addPointToObject: (objectId: string, point: FrontendPoint) => void;
  addBoxToObject: (objectId: string, box: FrontendBox) => void;
  removeAnnotationFromObject: (annotationId: string) => void;
  updateAnnotationInObject: (annotationId: string, updates: Record<string, unknown>) => void;
  setAsVisualBox: (annotationId: string) => void;
  reassignAnnotation: (annotationId: string, targetObjectId: string) => void;
  selectAnnotation: (id: string | null) => void;
  selectObject: (id: string | null) => void;
  clearSelection: () => void;
  loadObjects: (objects: AnnotationObject[]) => void;
  resetCanvas: () => void;
}

const genId = () => crypto.randomUUID();

function markDirty(
  updater: (state: Label3DCanvasState) => void
): (state: Label3DCanvasState) => void {
  return (state) => {
    updater(state);
    state.dirty = true;
  };
}

export const useLabel3DCanvasStore = create<Label3DCanvasState>()(
  immer((set) => ({
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

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
        state.selectedObjectId = null;
        state.selectedAnnotationId = null;
      }),
    setTool: (tool) =>
      set((state) => {
        state.tool = tool;
        state.mode = 'create';
      }),
    setStageScale: (scale) =>
      set((state) => {
        state.stageScale = scale;
      }),
    setStagePos: (pos) =>
      set((state) => {
        state.stagePos = pos;
      }),
    setCursorImagePos: (pos) =>
      set((state) => {
        state.cursorImagePos = pos;
      }),
    setFitImageTrigger: () =>
      set((state) => {
        state.fitImageTrigger += 1;
      }),
    setPendingAnnotation: (pending) =>
      set((state) => {
        state.pendingAnnotation = pending;
        state.showObjectSelectPopup = pending !== null;
      }),
    setShowObjectSelectPopup: (show) =>
      set((state) => {
        state.showObjectSelectPopup = show;
        if (!show) {
          state.pendingAnnotation = null;
        }
      }),
    setDirty: (dirty) =>
      set((state) => {
        state.dirty = dirty;
      }),
    setImageDimensions: (width, height) =>
      set((state) => {
        state.imageWidth = width;
        state.imageHeight = height;
      }),

    addObject: (labelId) => {
      let created: AnnotationObject | null = null;
      set((state) => {
        const obj: AnnotationObject = {
          id: genId(),
          labelId,
          points: [],
          boxes: [],
        };
        state.objects.push(obj);
        state.currentObjectId = obj.id;
        created = obj;
      });
      return created;
    },

    removeObject: (id) =>
      set((state) => {
        state.objects = state.objects.filter((o) => o.id !== id);
        if (state.selectedObjectId === id) {
          state.selectedObjectId = null;
        }
        if (state.currentObjectId === id) {
          state.currentObjectId = null;
        }
        if (state.selectedAnnotationId) {
          const stillExists = state.objects.some((o) =>
            hasAnnotation(o, state.selectedAnnotationId as string)
          );
          if (!stillExists) {
            state.selectedAnnotationId = null;
          }
        }
        state.dirty = true;
      }),

    setCurrentObject: (id) =>
      set((state) => {
        state.currentObjectId = id;
      }),

    addPointToObject: (objectId, point) =>
      set(
        markDirty((state) => {
          const obj = state.objects.find((o) => o.id === objectId);
          if (obj) {
            obj.points.push(point);
            state.currentObjectId = null;
            state.selectedAnnotationId = point.id;
          }
        })
      ),

    addBoxToObject: (objectId, box) =>
      set(
        markDirty((state) => {
          const obj = state.objects.find((o) => o.id === objectId);
          if (obj) {
            obj.boxes.push(box);
            state.currentObjectId = null;
            state.selectedAnnotationId = box.id;
          }
        })
      ),

    removeAnnotationFromObject: (annotationId) =>
      set(
        markDirty((state) => {
          for (const obj of state.objects) {
            const pointIdx = obj.points.findIndex((p) => p.id === annotationId);
            if (pointIdx !== -1) {
              obj.points.splice(pointIdx, 1);
              if (state.selectedAnnotationId === annotationId) {
                state.selectedAnnotationId = null;
              }
              return;
            }
            const boxIdx = obj.boxes.findIndex((b) => b.id === annotationId);
            if (boxIdx !== -1) {
              obj.boxes.splice(boxIdx, 1);
              if (state.selectedAnnotationId === annotationId) {
                state.selectedAnnotationId = null;
              }
              return;
            }
          }
        })
      ),

    updateAnnotationInObject: (annotationId, updates) =>
      set(
        markDirty((state) => {
          for (const obj of state.objects) {
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
        })
      ),

    setAsVisualBox: (annotationId) =>
      set(
        markDirty((state) => {
          for (const obj of state.objects) {
            const box = obj.boxes.find((b) => b.id === annotationId);
            if (box) {
              const labelId = obj.labelId;
              for (const other of state.objects) {
                if (other.labelId !== labelId) {
                  continue;
                }
                for (const b of other.boxes) {
                  if (b.id === annotationId) {
                    b.boxType = 'visual_ref';
                  } else {
                    b.boxType = undefined;
                  }
                }
              }
              return;
            }
          }
        })
      ),

    reassignAnnotation: (annotationId, targetObjectId) =>
      set(
        markDirty((state) => {
          let annotation: FrontendPoint | FrontendBox | null = null;
          let sourceType: 'point' | 'box' | null = null;

          for (const obj of state.objects) {
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

          if (annotation && sourceType) {
            const targetObj = state.objects.find((o) => o.id === targetObjectId);
            if (targetObj) {
              if (sourceType === 'point') {
                targetObj.points.push(annotation as FrontendPoint);
              } else {
                targetObj.boxes.push(annotation as FrontendBox);
              }
            }
          }
        })
      ),

    selectAnnotation: (id) =>
      set((state) => {
        state.selectedAnnotationId = id;
        if (id) {
          const obj = state.objects.find((o) => hasAnnotation(o, id));
          if (obj) {
            state.selectedObjectId = obj.id;
          }
        }
      }),

    selectObject: (id) =>
      set((state) => {
        state.selectedObjectId = id;
        state.selectedAnnotationId = null;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedObjectId = null;
        state.selectedAnnotationId = null;
      }),

    loadObjects: (objects) =>
      set((state) => {
        state.objects = objects;
        state.selectedObjectId = null;
        state.selectedAnnotationId = null;
        state.currentObjectId = null;
        state.dirty = false;
      }),

    resetCanvas: () =>
      set((state) => {
        state.stageScale = 1;
        state.stagePos = { x: 0, y: 0 };
      }),
  }))
);
