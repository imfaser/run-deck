import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Element Plus 按需自动导入
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';


const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    vue(),

    // ✅ Element Plus 自动导入
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue'],
      dts: true, // 生成类型声明（TS 项目强烈建议）
    }),

    Components({
      resolvers: [ElementPlusResolver()],
      dts: true,
    }),
  ],

  css: {
    preprocessorOptions: {
      scss: {
        // ✅ 防止 Sass 1.80+ 报 Legacy JS API warning
        // api: 'modern-compiler',
        // ✅ 如果你后面要做主题定制，可以在这里统一注入
        // additionalData: `@use "@/styles/element/index.scss" as *;`,
      },
    },
  },

  // ✅ Tauri 原有配置（完全不动）
  clearScreen: false,
  server: {
    port: 14200,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 14210,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
