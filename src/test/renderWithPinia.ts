import { createPinia, setActivePinia } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { Component } from 'vue';

export function setupTestPinia() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

export function renderWithPinia(
  component: Component,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Record<string, any>
): VueWrapper {
  const pinia = createTestingPinia({ stubActions: false });
  setActivePinia(pinia);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mount(component as any, {
    global: {
      plugins: [pinia],
      ...options?.global,
    },
    ...options,
  });
}
