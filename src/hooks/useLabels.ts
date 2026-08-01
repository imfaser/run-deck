import useSWR from 'swr';
import { dbListLabels } from '@/services/cmds';
import type { Label } from '@/schemas/label';

export const LABELS_KEY = 'labels';

export function useLabels() {
  return useSWR<Label[]>(LABELS_KEY, dbListLabels, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });
}
