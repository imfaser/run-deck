<script setup lang="ts">
  import { ref, watchEffect } from 'vue';
  import PageLayout from '@/components/layout/PageLayout.vue';
  import McpServerSidebar from '@/components/mcp-panel/McpServerSidebar.vue';
  import McpServerDetail from '@/components/mcp-panel/McpServerDetail.vue';
  import { useConfigQuery } from '@/composables/useConfigQuery';

  const { data: config, isLoading: loading, error } = useConfigQuery();

  const selectedServer = ref('');
  const detailRef = ref<InstanceType<typeof McpServerDetail> | null>(null);

  let initialized = false;
  watchEffect(() => {
    if (initialized) return;
    const cfg = config.value;
    if (!cfg) return;
    initialized = true;
    const names = Object.keys(cfg.mcp);
    if (names.length > 0) {
      selectedServer.value = names[0];
      detailRef.value?.loadDetails();
    }
  });

  function handleSelect(name: string) {
    selectedServer.value = name;
    detailRef.value?.loadDetails();
  }
</script>

<template>
  <PageLayout v-loading="loading" aside-width="240px">
    <template #aside>
      <McpServerSidebar :selected-server="selectedServer" @select="handleSelect" />
    </template>

    <el-alert v-if="error" :title="String(error)" type="error" show-icon class="error-alert" />

    <template v-else>
      <el-empty v-if="!selectedServer" description="请选择一个 MCP 服务器查看详情" />
      <McpServerDetail v-else ref="detailRef" :selected-server="selectedServer" />
    </template>
  </PageLayout>
</template>

<style scoped lang="scss">
  .error-alert {
    margin-bottom: var(--spacing-rem-base);
  }
</style>
