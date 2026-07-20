import { useLabelRawStore } from '@/stores/label-raw';
import { useLabelKeyboardShared } from './useLabelKeyboard.shared';

export function useLabelRawKeyboard() {
  const store = useLabelRawStore();
  useLabelKeyboardShared(store);
}
