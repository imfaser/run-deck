import path from 'path';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    babel({
      presets: [
        reactCompilerPreset({
          logger: {
            logEvent(filename, event) {
              if (event.kind === 'CompileSuccess') {
                // console.log(`[Compiler] Compiled: ${filename}`);
              } else if (event.kind === 'CompileError') {
                console.error(`[Compiler] Skipped: ${filename}`, event.detail.reason);
              }
            },
          },
        }),
      ],
    }),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  envPrefix: ['VITE_', 'TAURI_'],

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

  build: {
    target: host ? undefined : process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
