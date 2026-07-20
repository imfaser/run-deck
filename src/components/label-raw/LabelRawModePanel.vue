<script setup lang="ts">
  import { useLabelRawStore } from '@/stores/label-raw';
  import LabelModePanelShared from '@/components/shared/LabelModePanel.vue';

  const store = useLabelRawStore();
</script>

<template>
  <LabelModePanelShared :mode="store.mode" @set-mode="(mode) => store.setMode(mode)" />
</template>
