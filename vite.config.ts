import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import VueRouter from 'vue-router/vite';
import { VueRouterAutoImports } from 'vue-router/unplugin';

// Element Plus 按需自动导入
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// Tauri 官方模板写法：读取 CLI 注入的环境变量
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    VueRouter({
      dts: 'src/route-map.d.ts',
    }),
    vue(),

    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      imports: ['vue', VueRouterAutoImports],
      dts: true,
    }),

    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
      dts: true,
    }),
  ],

  /* ========= 1️⃣ 路径别名（必须补，否则 @/ 在构建期可能解析异常） ========= */
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  /* ========= 2️⃣ 让 TAURI_DEBUG / TAURI_PLATFORM 等变量能传到前端代码 ========= */
  envPrefix: ['VITE_', 'TAURI_'],

  /* ========= 3️⃣ Sass + Element Plus 主题定制 ========= */
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/element/index.scss" as *;`,
      },
    },
  },

  /* ========= 4️⃣ Tauri 原有配置 ========= */
  clearScreen: false,
  server: {
    port: 6917,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 6918,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  /* ========= 5️⃣ build（Tauri 官方模板建议补齐，避免 debug 构建被 minify/丢 sourcemap） ========= */
  build: {
    target: host
      ? undefined // dev 时让 Vite 自己决定就行
      : process.env.TAURI_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/echarts')) return 'vendor-echarts';
          if (id.includes('node_modules/element-plus')) return 'vendor-element-plus';
          if (id.includes('node_modules/konva') || id.includes('node_modules/vue-konva'))
            return 'vendor-konva';
          if (id.includes('node_modules/xstate')) return 'vendor-xstate';
        },
      },
    },
  },
});
