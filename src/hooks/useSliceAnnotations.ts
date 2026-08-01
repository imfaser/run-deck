import useSWR from 'swr';
import { dbListAnnotationsByImage } from '@/services/cmds';
import type { Annotation } from '@/schemas/annotation';

export const sliceAnnotationsKey = (hash: string) => ['slice-annotations', hash] as const;

export function useSliceAnnotations(hash: string | null) {
  const fetcher = () => dbListAnnotationsByImage(hash ?? '');
  return useSWR<Annotation[]>(hash ? sliceAnnotationsKey(hash) : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_000,
  });
}
