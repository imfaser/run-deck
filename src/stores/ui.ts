import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const showLabelDrawer = ref(false);
  const showLabelRawDrawer = ref(false);

  return {
    showLabelDrawer,
    showLabelRawDrawer,
  };
});
