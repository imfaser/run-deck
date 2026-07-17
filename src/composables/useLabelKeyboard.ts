import { onMounted, onUnmounted } from 'vue';
import { useLabelStore } from '@/stores/label';
import type { LabelMode, AnnotationType } from '@/stores/label';

export function useLabelKeyboard() {
  const store = useLabelStore();

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case '1':
        store.setMode('select' as LabelMode);
        break;
      case '2':
        store.setMode('create' as LabelMode);
        break;
      case '3':
        store.setMode('delete' as LabelMode);
        break;
      case 'p':
      case 'P':
        store.setTool('p_point' as AnnotationType);
        break;
      case 'n':
      case 'N':
        store.setTool('n_point' as AnnotationType);
        break;
      case 'b':
      case 'B':
        store.setTool('box' as AnnotationType);
        break;
      case 'Escape':
        if (store.selectedId) {
          store.clearSelection();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (store.selectedId) {
          store.removeAnnotation(store.selectedId);
        }
        break;
      case '0':
        store.resetCanvas();
        break;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
