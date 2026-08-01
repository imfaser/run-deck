import { useConfig } from './useConfig';

export function useTheme() {
  const { config, updateMode } = useConfig();
  const mode = config?.frontend?.mode ?? 'dark';

  function setTheme(m: 'dark' | 'light') {
    updateMode(m);
  }

  function toggleTheme() {
    updateMode(mode === 'dark' ? 'light' : 'dark');
  }

  return { theme: mode, setTheme, toggleTheme };
}
