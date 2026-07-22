import { randomFillSync, randomUUID } from 'crypto';
import { afterEach } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';

// jsdom 没有 WebCrypto，Tauri mock 依赖它
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (buffer: Buffer) => randomFillSync(buffer),
    randomUUID: () => randomUUID(),
  },
});

// 每个测试结束后清理 Tauri mock 状态
afterEach(() => {
  clearMocks();
});
