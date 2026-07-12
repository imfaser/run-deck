<script setup lang="ts">
  import AppLayout from './components/layout/AppLayout.vue';
  import { useTheme } from '@/composables/useTheme';

  useTheme();
</script>

<template>
  <AppLayout />
</template>
