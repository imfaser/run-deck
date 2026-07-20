import { defineStore } from 'pinia';
import { ref } from 'vue';
import { match } from 'ts-pattern';
import type { ThemeMode } from '@/composables/useTheme';

export interface Tab {
  id: string;
  title: string;
  closable: boolean;
  route: string;
}

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false);
  const themeMode = ref<ThemeMode>('dark');
  const tabs = ref<Tab[]>([]);
  const activeTab = ref('');

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode;
  }

  function addTab(tab: Omit<Tab, 'id'>) {
    const id = tab.route;
    if (tabs.value.some((t) => t.id === id)) {
      activeTab.value = id;
      return;
    }
    tabs.value.push({ ...tab, id });
    activeTab.value = id;
  }

  function removeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id);
    if (index === -1) return;

    tabs.value.splice(index, 1);

    if (activeTab.value === id) {
      activeTab.value = match(tabs.value.length)
        .with(0, () => 'overview')
        .otherwise(() => tabs.value[Math.min(index, tabs.value.length - 1)].id);
    }
  }

  function setActiveTab(id: string) {
    activeTab.value = id;
  }

  return {
    sidebarCollapsed,
    themeMode,
    tabs,
    activeTab,
    toggleSidebar,
    setThemeMode,
    addTab,
    removeTab,
    setActiveTab,
  };
});
