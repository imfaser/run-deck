import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateConfig, type Config } from '@/services/cmd';
import { ElMessage } from 'element-plus/es/components/message/index.mjs';

export function useMcpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Config) => updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      ElMessage.error(`配置更新失败: ${msg}`);
    },
  });
}
