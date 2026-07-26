import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui';

export function useLabelSettings() {
  const route = useRoute();
  const uiStore = useUiStore();

  const showDrawer = computed({
    get: () => (route.path === '/label-raw' ? uiStore.showLabelRawDrawer : uiStore.showLabelDrawer),
    set: (value: boolean) => {
      if (route.path === '/label-raw') {
        uiStore.showLabelRawDrawer = value;
      } else {
        uiStore.showLabelDrawer = value;
      }
    },
  });

  function openSettings() {
    showDrawer.value = true;
  }

  function closeSettings() {
    showDrawer.value = false;
  }

  return { showDrawer, openSettings, closeSettings };
}
