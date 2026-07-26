import type { useLabel2dCanvasStore } from '@/stores/canvas-2d';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelKeyboard(store: ReturnType<typeof useLabel2dCanvasStore>) {
  useLabelKeyboardShared(store);
}
