import type { useCanvasStore } from '@/stores/canvas';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelRawKeyboard(store: ReturnType<typeof useCanvasStore>) {
  useLabelKeyboardShared(store);
}
