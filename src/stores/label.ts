import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type AnnotationType = 'p_point' | 'n_point' | 'box';
export type LabelMode = 'select' | 'create' | 'delete';

export interface PointAnnotation {
  id: string;
  type: 'p_point' | 'n_point';
  x: number;
  y: number;
}

export interface BoxAnnotation {
  id: string;
  type: 'box';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Annotation = PointAnnotation | BoxAnnotation;

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

  // Actions
  function addAnnotation(annotation: Annotation) {
    annotations.value.push(annotation);
  }

  function removeAnnotation(id: string) {
    annotations.value = annotations.value.filter((a) => a.id !== id);
    if (selectedId.value === id) {
      selectedId.value = null;
    }
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const idx = annotations.value.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const existing = annotations.value[idx];
    annotations.value[idx] = { ...existing, ...updates } as Annotation;
  }

  function selectAnnotation(id: string | null) {
    selectedId.value = id;
  }

  function clearSelection() {
    selectedId.value = null;
  }

  function setMode(newMode: LabelMode) {
    mode.value = newMode;
    clearSelection();
  }

  function setTool(newTool: AnnotationType) {
    tool.value = newTool;
    mode.value = 'create';
  }

  function clearAnnotations() {
    annotations.value = [];
    selectedId.value = null;
  }

  function resetCanvas() {
    stageScale.value = 1;
    stagePos.value = { x: 0, y: 0 };
  }

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
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    selectAnnotation,
    clearSelection,
    setMode,
    setTool,
    clearAnnotations,
    resetCanvas,
  };
});
