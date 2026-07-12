import { ref, watchEffect } from 'vue';
import { useAppStore } from '@/stores/app';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'theme-mode';

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'dark';
}

const theme = ref<ThemeMode>(getInitialTheme());

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(THEME_KEY, mode);
}

export function useTheme() {
  const store = useAppStore();

  // Apply theme on first use
  applyTheme(theme.value);

  // Watch for changes
  watchEffect(() => {
    applyTheme(theme.value);
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
