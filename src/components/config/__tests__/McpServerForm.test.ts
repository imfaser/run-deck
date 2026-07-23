import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

vi.mock('@/services/cmd', () => ({
  logMessage: vi.fn(),
  setLogLevel: vi.fn(),
  setLogLevelFilter: vi.fn(),
  mcpServerStatus: vi.fn(),
}));

vi.mock('@/composables/useConfigQuery', () => ({
  useConfigQuery: () => ({
    data: ref({
      log_level: 'info',
      shell: 'auto',
      frontend: { home: 'overview', mode: 'dark' },
      mcp: {},
    }),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  }),
}));

vi.mock('@/composables/useMcpMutation', () => ({
  useMcpMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    setTheme: vi.fn(),
  }),
}));

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      getQueryData: vi.fn().mockReturnValue(null),
      setQueryData: vi.fn(),
    }),
  };
});

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue(undefined) },
}));

describe('McpServerForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updateServerName updates name', async () => {
    const { useConfigStore } = await import('@/stores/config');
    const store = useConfigStore();

    store.addServer('local');
    expect(store.editingServer?.name).toBe('MCP 服务器');

    store.updateServerName('My Server');
    expect(store.editingServer?.name).toBe('My Server');
  });

  it('updateServerConfig updates config', async () => {
    const { useConfigStore } = await import('@/stores/config');
    const store = useConfigStore();

    store.addServer('local');

    store.updateServerConfig({ type: 'local', command: ['node'], enabled: true });
    expect(store.editingServer?.config.type).toBe('local');
  });

  it('addServer creates local server', async () => {
    const { useConfigStore } = await import('@/stores/config');
    const store = useConfigStore();

    store.addServer('local');
    expect(store.editingServer?.config.type).toBe('local');
    expect(store.editingServer?.isNew).toBe(true);
  });

  it('addServer creates remote server', async () => {
    const { useConfigStore } = await import('@/stores/config');
    const store = useConfigStore();

    store.addServer('remote');
    expect(store.editingServer?.config.type).toBe('remote');
    expect(store.editingServer?.isNew).toBe(true);
  });

  it('backToList clears editing state', async () => {
    const { useConfigStore } = await import('@/stores/config');
    const store = useConfigStore();

    store.addServer('local');
    store.updateServerName('Test');
    expect(store.editingServer).not.toBeNull();

    store.backToList();
    expect(store.editingServer).toBeNull();
  });
});
