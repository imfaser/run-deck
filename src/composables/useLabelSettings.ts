import { ref } from 'vue';

const showDrawer = ref(false);

export function useLabelSettings() {
  function openSettings() {
    showDrawer.value = true;
  }
  function closeSettings() {
    showDrawer.value = false;
  }
  return { showDrawer, openSettings, closeSettings };
}
