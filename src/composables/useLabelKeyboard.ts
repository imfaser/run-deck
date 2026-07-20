import { useLabelStore } from '@/stores/label';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelKeyboard() {
  const store = useLabelStore();
  useLabelKeyboardShared(store);
}
