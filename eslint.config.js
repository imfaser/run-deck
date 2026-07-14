import eslintPluginVue from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import vitestPlugin from '@vitest/eslint-plugin';

export default [
  /* ========= 1️⃣ 忽略文件（替代 .eslintignore） ========= */
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'out/**',
      'src-tauri/**',
      '*.min.js',
      '*.min.css',
      '.eslintcache',
      'tsconfig.node.json', // ✅ 新增：避免 ESLint 扫描 Node 配置
    ],
  },

  /* ========= 2️⃣ 语言选项（核心修复点） ========= */
  {
    files: ['**/*.ts', '**/*.tsx', 'vite.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
      },
      globals: {
        __TAURI__: 'readonly',
        __TAURI_INVOKE__: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },

  /* ========= 2️⃣ .vue 文件专用解析器 ========= */
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        projectService: true,
      },
      globals: {
        __TAURI__: 'readonly',
        __TAURI_INVOKE__: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },

  /* ========= 3️⃣ Vue 3 官方推荐（Flat 配置） ========= */
  ...eslintPluginVue.configs['flat/recommended'],

  /* ========= 4️⃣ TypeScript ========= */
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  /* ========= 5️⃣ Vue 专项规则（已修复） ========= */
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'error',
      'vue/require-default-prop': 'off',
      'vue/no-v-model-argument': 'off',
      // 已删除不存在的 vue/component-tags-order 规则
    },
  },

  /* ========= 6️⃣ 测试文件规则 ========= */
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    plugins: { vitest: vitestPlugin },
    rules: {
      'vitest/expect-expect': 'warn',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
    },
  },

  /* ========= 7️⃣ Prettier 必须在最后 ========= */
  prettierConfig,
];
