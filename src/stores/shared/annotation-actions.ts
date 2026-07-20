import type { Ref } from 'vue';
import type { AnnotationType, LabelMode, Annotation } from '@/schemas/annotation';

export interface AnnotationState {
  mode: Ref<LabelMode>;
  tool: Ref<AnnotationType>;
  annotations: Ref<Annotation[]>;
  selectedId: Ref<string | null>;
  stageScale: Ref<number>;
  stagePos: Ref<{ x: number; y: number }>;
}

export function createAnnotationActions(state: AnnotationState) {
  function addAnnotation(ann: Annotation) {
    state.annotations.value.push(ann);
  }

  function removeAnnotation(id: string) {
    state.annotations.value = state.annotations.value.filter((a) => a.id !== id);
    if (state.selectedId.value === id) state.selectedId.value = null;
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const ann = state.annotations.value.find((a) => a.id === id);
    if (ann) Object.assign(ann, updates);
  }

  function selectAnnotation(id: string | null) {
    state.selectedId.value = id;
  }

  function clearSelection() {
    state.selectedId.value = null;
  }

  function setMode(newMode: LabelMode) {
    state.mode.value = newMode;
    clearSelection();
  }

  function setTool(newTool: AnnotationType) {
    state.tool.value = newTool;
    state.mode.value = 'create';
  }

  function clearAnnotations() {
    state.annotations.value = [];
    state.selectedId.value = null;
  }

  function resetCanvas() {
    state.stageScale.value = 1;
    state.stagePos.value = { x: 0, y: 0 };
  }

  return {
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
}
