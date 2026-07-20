<script setup lang="ts">
  import { useLabelStore } from '@/stores/label';
  import LabelToolPanelShared from '@/components/shared/LabelToolPanel.vue';

  const store = useLabelStore();
</script>

<template>
  <LabelToolPanelShared
    :mode="store.mode"
    :tool="store.tool"
    @set-tool="(tool) => store.setTool(tool)"
  />
</template>
