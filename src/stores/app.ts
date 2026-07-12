import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ThemeMode } from '@/composables/useTheme';

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false);
  const themeMode = ref<ThemeMode>('dark');

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode;
  }

  return { sidebarCollapsed, themeMode, toggleSidebar, setThemeMode };
});
