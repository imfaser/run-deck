import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  AnnotationType,
  LabelMode,
  PointAnnotation,
  BoxAnnotation,
  AnnotationObject,
} from '@/schemas/annotation';
import { createAnnotationActions } from '@/stores/shared/annotation-actions';
import type { MaskSettings } from '@/stores/label-raw';

export const useLabelStore = defineStore('label', () => {
  // Image
  const imagePath = ref<string | null>(null);
  const imageUrl = ref<string | null>(null);

  // Mode
  const mode = ref<LabelMode>('create');
  const tool = ref<AnnotationType>('p_point');

  // Objects
  const objects = ref<AnnotationObject[]>([]);
  const selectedObjectId = ref<string | null>(null);
  const selectedAnnotationId = ref<string | null>(null);
  const currentObjectId = ref<string | null>(null);

  // Canvas state
  const stageScale = ref(1);
  const stagePos = ref({ x: 0, y: 0 });
  const imageWidth = ref(0);
  const imageHeight = ref(0);

  // Mask
  const maskUrl = ref<string | null>(null);
  const maskVisible = ref(true);
  const maskSettings = ref<MaskSettings>({
    color: '#0096ff',
    opacity: 0.6,
    threshold: 128,
    showPrevMask: true,
  });
  const rawMaskPath = ref<string | null>(null);

  // Fit image trigger
  const fitImageTrigger = ref(0);

  // Cursor
  const cursorImagePos = ref<{ x: number; y: number } | null>(null);
  const cursorScreenPos = ref<{ x: number; y: number } | null>(null);

  // Name dialog
  const showNameDialog = ref(false);
  const pendingAnnotation = ref<
    | { type: 'point'; point: PointAnnotation }
    | {
        type: 'box';
        box: BoxAnnotation;
      }
    | null
  >(null);

  // Select dialog
  const showSelectDialog = ref(false);

  // Computed
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

  // Shared actions
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
    // State
    imagePath,
    imageUrl,
    mode,
    tool,
    objects,
    selectedObjectId,
    selectedAnnotationId,
    currentObjectId,
    stageScale,
    stagePos,
    imageWidth,
    imageHeight,
    maskUrl,
    maskVisible,
    maskSettings,
    rawMaskPath,
    fitImageTrigger,
    cursorImagePos,
    cursorScreenPos,
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
