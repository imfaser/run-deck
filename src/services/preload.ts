import { mutate } from 'swr';
import { getConfig } from './cmds';
import { type Config } from '@/schemas/config';

export interface PreloadedData {
  config: Config;
}

export async function preloadAppData(): Promise<PreloadedData> {
  const config = await getConfig();

  // 预置 SWR config 缓存，供 ThemeProvider 等直接消费，避免首帧空态
  await mutate('config', config, { revalidate: false });

  // Apply theme before first render
  const isDark = config.frontend.mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);

  return { config };
}
