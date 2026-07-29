import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface Tab {
  id: string;
  title: string;
  closable: boolean;
  route: string;
}

interface AppState {
  tabs: Tab[];
  activeTab: string;
  addTab: (tab: Omit<Tab, 'id'>) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    tabs: [],
    activeTab: 'overview',

    addTab: (tab) => {
      const id = tab.route;
      set((state) => {
        if (state.tabs.some((t) => t.id === id)) {
          state.activeTab = id;
          return;
        }
        state.tabs.push({ ...tab, id });
        state.activeTab = id;
      });
    },

    removeTab: (id) => {
      set((state) => {
        const index = state.tabs.findIndex((t) => t.id === id);
        if (index === -1) {
          return;
        }

        state.tabs.splice(index, 1);

        if (state.activeTab === id) {
          state.activeTab =
            state.tabs.length === 0
              ? 'overview'
              : state.tabs[Math.min(index, state.tabs.length - 1)].id;
        }
      });
    },

    setActiveTab: (id) =>
      set((state) => {
        state.activeTab = id;
      }),
  }))
);

export type { Tab, AppState };
