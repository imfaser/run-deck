import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { App } from 'vue';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

export function installQuery(app: App) {
  app.use(VueQueryPlugin, { queryClient });
}
