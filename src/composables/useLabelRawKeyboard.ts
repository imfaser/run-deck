import type { useLabel3dCanvasStore } from '@/stores/canvas-3d';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelRawKeyboard(store: ReturnType<typeof useLabel3dCanvasStore>) {
  useLabelKeyboardShared(store);
}
