import { createContextState } from 'foxact/create-context-state';
import { useLocalStorageState } from 'ahooks';

type ThemeMode = 'dark' | 'light';

const [ThemeProvider, useThemeMode, useSetThemeModeRaw] = createContextState<ThemeMode>('dark');

function useTheme() {
  const [, setStored] = useLocalStorageState<ThemeMode>('theme-mode', { defaultValue: 'dark' });
  const mode = useThemeMode();
  const setRaw = useSetThemeModeRaw();

  function applyTheme(m: ThemeMode) {
    document.documentElement.classList.toggle('dark', m === 'dark');
  }

  function setTheme(m: ThemeMode) {
    setStored(m);
    setRaw(m);
    applyTheme(m);
  }

  function toggleTheme() {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }

  applyTheme(mode);

  return { theme: mode, setTheme, toggleTheme };
}

export { ThemeProvider, useTheme };
