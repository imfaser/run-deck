import { createContext, useContext, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import { useConfig } from '@/hooks/useConfig';
import { useConfigChanged } from '@/hooks/useConfigChanged';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function resolveSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 主题以 SWR config 为唯一 truth（Rust 端广播 config-changed 后各窗口同步刷新）。
 * setTheme 持久化到 Rust config，由 useConfigChanged 广播到所有窗口，本窗口经 SWR 乐观更新即时生效。
 */
export function ThemeProvider({ children, defaultTheme = 'dark', ...props }: ThemeProviderProps) {
  const { config, updateMode } = useConfig();
  useConfigChanged();
  const theme: Theme = config?.frontend.mode ?? defaultTheme;

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      root.classList.add(resolveSystemTheme());
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const setTheme = useMemoizedFn((next: Theme) => {
    const resolved = next === 'system' ? resolveSystemTheme() : next;
    updateMode(resolved);
  });

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
