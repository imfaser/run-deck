import { useQuery } from '@tanstack/vue-query';
import { getConfig } from '@/services/cmd';

export function useConfigQuery() {
  return useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  });
}
