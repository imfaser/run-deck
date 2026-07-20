import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  AnnotationType,
  LabelMode,
  PointAnnotation,
  BoxAnnotation,
  Annotation,
} from '@/schemas/annotation';
import { createAnnotationActions } from '@/stores/shared/annotation-actions';

export const useLabelStore = defineStore('label', () => {
  // Image
  const imagePath = ref<string | null>(null);
  const imageUrl = ref<string | null>(null);

  // Mode
  const mode = ref<LabelMode>('create');
  const tool = ref<AnnotationType>('p_point');

  // Annotations
  const annotations = ref<Annotation[]>([]);
  const selectedId = ref<string | null>(null);

  // Canvas state
  const stageScale = ref(1);
  const stagePos = ref({ x: 0, y: 0 });

  // Mask
  const maskUrl = ref<string | null>(null);
  const maskVisible = ref(true);
  const confidenceThreshold = ref(128);
  const maskColor = ref('#0096ff');
  const maskOpacity = ref(0.6);
  const rawMaskPath = ref<string | null>(null);

  // Cursor
  const cursorImagePos = ref<{ x: number; y: number } | null>(null);

  // Computed
  const positivePoints = computed(() =>
    annotations.value.filter((a): a is PointAnnotation => a.type === 'p_point')
  );

  const negativePoints = computed(() =>
    annotations.value.filter((a): a is PointAnnotation => a.type === 'n_point')
  );

  const boxes = computed(() =>
    annotations.value.filter((a): a is BoxAnnotation => a.type === 'box')
  );

  const selectedAnnotation = computed(
    () => annotations.value.find((a) => a.id === selectedId.value) ?? null
  );

  // Shared actions
  const sharedActions = createAnnotationActions({
    mode,
    tool,
    annotations,
    selectedId,
    stageScale,
    stagePos,
  });

  return {
    // State
    imagePath,
    imageUrl,
    mode,
    tool,
    annotations,
    selectedId,
    stageScale,
    stagePos,
    maskUrl,
    maskVisible,
    confidenceThreshold,
    maskColor,
    maskOpacity,
    rawMaskPath,
    cursorImagePos,

    // Computed
    positivePoints,
    negativePoints,
    boxes,
    selectedAnnotation,

    // Actions
    ...sharedActions,
  };
});
