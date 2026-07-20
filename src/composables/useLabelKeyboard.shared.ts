import { useEventListener } from '@vueuse/core';
import { match } from 'ts-pattern';
import type { LabelMode, AnnotationType } from '@/types/annotation';

interface LabelKeyboardStore {
  selectedId: string | null;
  setMode: (mode: LabelMode) => void;
  setTool: (tool: AnnotationType) => void;
  clearSelection: () => void;
  removeAnnotation: (id: string) => void;
  resetCanvas: () => void;
}

export function useLabelKeyboardShared(store: LabelKeyboardStore) {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    match(e.code)
      .with('Digit1', () => store.setMode('select' as LabelMode))
      .with('Digit2', () => store.setMode('create' as LabelMode))
      .with('Digit3', () => store.setMode('delete' as LabelMode))
      .with('KeyP', () => store.setTool('p_point' as AnnotationType))
      .with('KeyN', () => store.setTool('n_point' as AnnotationType))
      .with('KeyB', () => store.setTool('box' as AnnotationType))
      .with('Escape', () => {
        if (store.selectedId) {
          store.clearSelection();
        }
      })
      .with('Delete', 'Backspace', () => {
        if (store.selectedId) {
          store.removeAnnotation(store.selectedId);
        }
      })
      .with('Digit0', () => store.resetCanvas())
      .otherwise(() => {});
  }

  useEventListener(window, 'keydown', handleKeyDown);
}
