<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { greet } from '@/services/cmd';

  const lastPing = ref<string>('');
  let unlisten: UnlistenFn | undefined;

  onMounted(async () => {
    unlisten = await listen<string>('run-deck://ping', (event) => {
      lastPing.value = event.payload;
    });
  });

  onUnmounted(() => {
    unlisten?.();
  });

  function handlePing() {
    greet();
  }
</script>

<template>
  <div>
    <button @click="handlePing">Send Ping</button>
    <p v-if="lastPing">Last ping: {{ lastPing }}</p>
  </div>
</template>
