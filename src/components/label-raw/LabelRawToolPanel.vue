<script setup lang="ts">
  import { useLabelRawStore } from '@/stores/label-raw';
  import LabelToolPanelShared from '@/components/shared/LabelToolPanel.vue';

  const store = useLabelRawStore();
</script>

<template>
  <LabelToolPanelShared
    :mode="store.mode"
    :tool="store.tool"
    @set-tool="(tool) => store.setTool(tool)"
  />
</template>
