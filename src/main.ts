import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import { createPlugin } from '@tauri-store/pinia';
import VueKonva from 'vue-konva';
import { routes } from 'vue-router/auto-routes';
import { ElMessage } from 'element-plus';
import App from './App.vue';
import 'element-plus/theme-chalk/src/message.scss';
import 'element-plus/theme-chalk/src/message-box.scss';
import 'element-plus/theme-chalk/src/button.scss';
import './styles/main.scss';

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

// Global error handler — catches sync errors in renders, event handlers, lifecycle hooks, etc.
app.config.errorHandler = (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  ElMessage.error(msg);
  console.error('[Vue error]', err);
};

// Catch async errors (unhandled promise rejections) — app.config.errorHandler does NOT cover these
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  if (reason) {
    const msg = reason instanceof Error ? reason.message : String(reason);
    ElMessage.error(msg);
    console.error('[unhandledrejection]', reason);
  }
  e.preventDefault();
});

app.mount('#app');
