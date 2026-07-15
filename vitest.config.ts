/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue({
      // Tauri 项目里 template 里可能出现 rust 注入的奇怪属性，放宽一点
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('tauri-'),
        },
      },
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  test: {
    // 浏览器环境模拟
    environment: 'jsdom',

    // 全局 API（可选：开启后测试文件里不用手写 import { describe, it, expect }）
    globals: true,

    // 测试文件去哪里找
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}', 'src/**/__tests__/**/*.{ts,tsx,js,jsx}'],

    // 没有测试文件时也正常退出（基础设施搭建阶段）
    passWithNoTests: true,

    // 排除 Rust / 构建产物 / node_modules
    exclude: ['node_modules', 'dist', 'out', 'src-tauri', '.idea', '.vscode'],

    // 测试前的全局初始化（WebCrypto polyfill、Tauri mock 清理）
    setupFiles: ['./src/test/setup.ts'],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
    },
  },
});
