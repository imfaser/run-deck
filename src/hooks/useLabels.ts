import useSWR from 'swr';
import { dbListLabels, logMessage } from '@/services/cmds';
import type { Label } from '@/schemas/label';

export const LABELS_KEY = 'labels';

export function useLabels() {
  return useSWR<Label[]>(
    LABELS_KEY,
    async () => {
      logMessage('debug', `[labels] fetch labels in ${window.location.hash}`).catch(() => {});
      const data = await dbListLabels();
      return data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    }
  );
}
