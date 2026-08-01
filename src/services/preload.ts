import { getConfig } from './cmds';
import { type Config } from '@/schemas/config';

export interface PreloadedData {
  config: Config;
}

export async function preloadAppData(): Promise<PreloadedData> {
  const config = await getConfig();

  // Apply theme before first render
  const isDark = config.frontend.mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);

  return { config };
}
