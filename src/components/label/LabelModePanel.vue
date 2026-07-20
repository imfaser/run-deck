<script setup lang="ts">
  import { useLabelStore } from '@/stores/label';
  import LabelModePanelShared from '@/components/shared/LabelModePanel.vue';

  const store = useLabelStore();
</script>

<template>
  <LabelModePanelShared :mode="store.mode" @set-mode="(mode) => store.setMode(mode)" />
</template>
