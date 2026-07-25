import type { useCanvasStore } from '@/stores/canvas';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelKeyboard(store: ReturnType<typeof useCanvasStore>) {
  useLabelKeyboardShared(store);
}
