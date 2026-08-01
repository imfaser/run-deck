import useSWR from 'swr';
import { dbListAnnotationCounts } from '@/services/cmds';
import type { AnnotationCount } from '@/schemas/annotation';

export const sliceSummariesKey = (volumeId: string) => ['slice-summaries', volumeId] as const;

export function useSliceSummaries(volumeId: string | null) {
  const fetcher = () => dbListAnnotationCounts(volumeId ?? '');
  return useSWR<AnnotationCount[]>(volumeId ? sliceSummariesKey(volumeId) : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_000,
  });
}
