import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import { routes } from 'vue-router/auto-routes';
import App from './App.vue';
import 'element-plus/theme-chalk/src/message-box.scss';
import 'element-plus/theme-chalk/src/button.scss';
import './styles/main.scss';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(VueKonva);
app.mount('#app');
