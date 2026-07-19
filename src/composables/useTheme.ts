import { watchEffect } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useAppStore } from '@/stores/app';

export type ThemeMode = 'dark' | 'light';

export function useTheme() {
  const store = useAppStore();
  const theme = useLocalStorage<ThemeMode>('theme-mode', 'dark');

  // Apply theme on first use
  document.documentElement.dataset.theme = theme.value;

  // Watch for changes
  watchEffect(() => {
    document.documentElement.dataset.theme = theme.value;
    store.setThemeMode(theme.value);
  });

  function setTheme(mode: ThemeMode) {
    theme.value = mode;
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
