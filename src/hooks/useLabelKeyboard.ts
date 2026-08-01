import { useEffect } from 'react';
import { useLatest } from 'ahooks';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import type { AnnotationType } from '@/schemas/annotation';

export interface UseLabelKeyboardOpts {
  onSave?: () => void;
  onSpaceDown?: () => void;
  onSpaceUp?: () => void;
  enabled?: boolean;
}

/**
 * 快捷键：1/2/3 模式切换、P/N/B 工具、Esc、Delete/Backspace 删除、
 * 0 重置画布、Space 平移、Ctrl+S 保存。
 */
export function useLabelKeyboard({
  onSave,
  onSpaceDown,
  onSpaceUp,
  enabled = true,
}: UseLabelKeyboardOpts) {
  const latest = useLatest({ onSave, onSpaceDown, onSpaceUp });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        latest.current.onSpaceDown?.();
        return;
      }

      const s = useLabel3DCanvasStore.getState();
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        latest.current.onSave?.();
        return;
      }

      switch (e.key) {
        case '1':
          e.preventDefault();
          s.setMode('select');
          break;
        case '2':
          e.preventDefault();
          s.setMode('create');
          break;
        case '3':
          e.preventDefault();
          s.setMode('delete');
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          s.setTool('p_point' as AnnotationType);
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          s.setTool('n_point' as AnnotationType);
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          s.setTool('box' as AnnotationType);
          break;
        case 'Escape':
          if (s.pendingAnnotation || s.showObjectSelectPopup) {
            s.setShowObjectSelectPopup(false);
          }
          s.clearSelection();
          break;
        case 'Delete':
        case 'Backspace':
          if (s.selectedAnnotationId) {
            e.preventDefault();
            s.removeAnnotationFromObject(s.selectedAnnotationId);
          }
          break;
        case '0':
          s.resetCanvas();
          break;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        latest.current.onSpaceUp?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, latest]);
}
