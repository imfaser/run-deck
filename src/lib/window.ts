import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const LABEL_SETTINGS_WINDOW_LABEL = 'label-settings';

/**
 * 打开标签定义窗口（防重复：已存在则聚焦）。
 * 相对主窗口居中（DPI 缩放用 scaleFactor 换算物理坐标）。
 */
export async function openLabelSettings(): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel(LABEL_SETTINGS_WINDOW_LABEL);
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

    const width = 800;
    const height = 600;
    const x = Math.round(pos.x + (size.width - width * factor) / 2);
    const y = Math.round(pos.y + (size.height - height * factor) / 2);

    const win = new WebviewWindow(LABEL_SETTINGS_WINDOW_LABEL, {
      url: '/#/label-settings',
      title: '标签定义',
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
      console.error('failed to open label settings window', e);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('failed to open label settings window', e);
  }
}
