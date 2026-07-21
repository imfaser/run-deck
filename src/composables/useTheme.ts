import { watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useAppStore } from '@/stores/app';

export type ThemeMode = 'dark' | 'light';

export function useTheme() {
  const store = useAppStore();
  const theme = useLocalStorage<ThemeMode>('theme-mode', 'dark');

  // Apply theme on first use
  document.documentElement.dataset.theme = theme.value;
  store.setThemeMode(theme.value);

  // Single source of truth: theme ref changes → sync DOM + store
  watch(theme, (mode) => {
    document.documentElement.dataset.theme = mode;
    store.setThemeMode(mode);
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
