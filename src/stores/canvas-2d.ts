import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createAnnotationActions } from '@/stores/shared/annotation-actions';
import type {
  AnnotationType,
  LabelMode,
  PointAnnotation,
  BoxAnnotation,
  AnnotationObject,
} from '@/schemas/annotation';

export const useLabel2dCanvasStore = defineStore('canvas-2d', () => {
  // ─── Mode / Tool ─────────────────────────────────
  const mode = ref<LabelMode>('create');
  const tool = ref<AnnotationType>('p_point');

  // ─── Objects ─────────────────────────────────────
  const objects = ref<AnnotationObject[]>([]);
  const selectedObjectId = ref<string | null>(null);
  const selectedAnnotationId = ref<string | null>(null);
  const currentObjectId = ref<string | null>(null);

  // ─── Viewport ────────────────────────────────────
  const stageScale = ref(1);
  const stagePos = ref({ x: 0, y: 0 });
  const imageWidth = ref(0);
  const imageHeight = ref(0);

  // ─── Cursor ──────────────────────────────────────
  const cursorImagePos = ref<{ x: number; y: number } | null>(null);
  const cursorScreenPos = ref<{ x: number; y: number } | null>(null);

  // ─── Fit image trigger ───────────────────────────
  const fitImageTrigger = ref(0);

  // ─── Dialog ──────────────────────────────────────
  const showNameDialog = ref(false);
  const pendingAnnotation = ref<
    { type: 'point'; point: PointAnnotation } | { type: 'box'; box: BoxAnnotation } | null
  >(null);
  const showSelectDialog = ref(false);

  // ─── Computed ────────────────────────────────────
  const currentObject = computed(
    () => objects.value.find((o) => o.id === currentObjectId.value) ?? null
  );

  const allPoints = computed(() => objects.value.flatMap((o) => o.points));

  const allBoxes = computed(() => objects.value.flatMap((o) => o.boxes));

  const allAnnotations = computed(() => [...allPoints.value, ...allBoxes.value]);

  const selectedAnnotation = computed(() => {
    const id = selectedAnnotationId.value;
    if (!id) return null;
    for (const obj of objects.value) {
      const point = obj.points.find((p) => p.id === id);
      if (point) return point;
      const box = obj.boxes.find((b) => b.id === id);
      if (box) return box;
    }
    return null;
  });

  // ─── Actions ─────────────────────────────────────
  const sharedActions = createAnnotationActions({
    mode,
    tool,
    objects,
    selectedObjectId,
    selectedAnnotationId,
    currentObjectId,
    stageScale,
    stagePos,
  });

  return {
    // Mode / Tool
    mode,
    tool,
    // Objects
    objects,
    selectedObjectId,
    selectedAnnotationId,
    currentObjectId,
    // Viewport
    stageScale,
    stagePos,
    imageWidth,
    imageHeight,
    // Cursor
    cursorImagePos,
    cursorScreenPos,
    // Fit image trigger
    fitImageTrigger,
    // Dialog
    showNameDialog,
    pendingAnnotation,
    showSelectDialog,
    // Computed
    currentObject,
    allPoints,
    allBoxes,
    allAnnotations,
    selectedAnnotation,
    // Actions
    ...sharedActions,
  };
});
