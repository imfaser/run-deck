import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import { createPlugin } from '@tauri-store/pinia';
import VueKonva from 'vue-konva';
import { routes } from 'vue-router/auto-routes';
import { ElMessage } from 'element-plus';
import { logMessage } from '@/services/cmd';
import { installQuery } from './plugins/query';
import App from './App.vue';
import 'element-plus/theme-chalk/src/message.scss';
import 'element-plus/theme-chalk/src/message-box.scss';
import 'element-plus/theme-chalk/src/button.scss';
import './styles/main.scss';

if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('[PINIA_R1006]') && msg.includes('$tauri')) return;
    originalWarn.apply(console, args);
  };
}

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);
const pinia = createPinia();
pinia.use(createPlugin());
app.use(pinia);
app.use(router);
app.use(VueKonva);
installQuery(app);

// Global error handler — catches sync errors in renders, event handlers, lifecycle hooks, etc.
app.config.errorHandler = (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  ElMessage.error(msg);
  console.error('[Vue error]', err);
  logMessage('error', `[Vue error] ${msg}`);
};

// Catch async errors (unhandled promise rejections) — app.config.errorHandler does NOT cover these
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  if (reason) {
    const msg = reason instanceof Error ? reason.message : String(reason);
    ElMessage.error(msg);
    console.error('[unhandledrejection]', reason);
    logMessage('error', `[unhandledrejection] ${msg}`);
  }
  e.preventDefault();
});

app.mount('#app');
