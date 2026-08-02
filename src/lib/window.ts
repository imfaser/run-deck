import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const LABEL_SETTINGS_WINDOW_LABEL = 'label-settings';
export const TASKS_WINDOW_LABEL = 'tasks';

/**
 * 打开标签定义窗口（防重复：已存在则聚焦）。
 * 相对主窗口居中（DPI 缩放用 scaleFactor 换算物理坐标）。
 */
export async function openLabelSettings(): Promise<void> {
  await openChildWindow({
    label: LABEL_SETTINGS_WINDOW_LABEL,
    url: '/#/label-settings',
    title: '标签定义',
    width: 800,
    height: 600,
  });
}

/**
 * 打开打标任务窗口（防重复：已存在则聚焦）。
 */
export async function openTasks(): Promise<void> {
  await openChildWindow({
    label: TASKS_WINDOW_LABEL,
    url: '/#/tasks',
    title: '打标任务',
    width: 880,
    height: 640,
  });
}

interface ChildWindowOptions {
  label: string;
  url: string;
  title: string;
  width: number;
  height: number;
}

async function openChildWindow(options: ChildWindowOptions): Promise<void> {
  const { label, url, title, width, height } = options;
  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    const appWindow = getCurrentWindow();
    const [pos, size, factor] = await Promise.all([
      appWindow.outerPosition(),
      appWindow.outerSize(),
      appWindow.scaleFactor(),
    ]);

    const x = Math.round(pos.x + (size.width - width * factor) / 2);
    const y = Math.round(pos.y + (size.height - height * factor) / 2);

    const win = new WebviewWindow(label, {
      url,
      title,
      width,
      height,
      x,
      y,
      decorations: false,
      resizable: true,
    });

    win.once('tauri://created', async () => {
      await win.setFocus();
    });
    win.once('tauri://error', (e: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`failed to open ${label} window`, e);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`failed to open ${label} window`, e);
  }
}
