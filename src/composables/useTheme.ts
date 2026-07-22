import { computed, watch } from 'vue';
import { useDark } from '@vueuse/core';
import { useAppStore } from '@/stores/app';

export type ThemeMode = 'dark' | 'light';

export function useTheme() {
  const store = useAppStore();

  const isDark = useDark({
    attribute: 'data-theme',
    valueDark: 'dark',
    valueLight: 'light',
    storageKey: 'theme-mode',
    initialValue: 'dark',
  });

  const theme = computed<ThemeMode>(() => (isDark.value ? 'dark' : 'light'));

  // Sync to Pinia store
  watch(
    theme,
    (mode) => {
      store.setThemeMode(mode);
    },
    { immediate: true }
  );

  function setTheme(mode: ThemeMode) {
    isDark.value = mode === 'dark';
  }

  function toggleTheme() {
    isDark.value = !isDark.value;
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
