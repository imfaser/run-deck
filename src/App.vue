<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    greet,
    mcpListTools,
    mcpCallTool,
    type ToolInfo,
    type CallToolResult,
  } from '@/services/cmd';

  const lastPing = ref<string>('');
  let unlisten: UnlistenFn | undefined;

  // MCP state
  const tools = ref<ToolInfo[]>([]);
  const callResult = ref<CallToolResult | null>(null);
  const error = ref<string>('');
  const loading = ref(false);

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

  async function handleListTools() {
    loading.value = true;
    error.value = '';
    tools.value = [];
    try {
      tools.value = await mcpListTools();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  async function handleCallEchoTool() {
    loading.value = true;
    error.value = '';
    callResult.value = null;
    try {
      callResult.value = await mcpCallTool('echo', 'echo_tool', { message: 'Hello, world!' });
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }
</script>

<template>
  <div class="container">
    <h1>Run Deck</h1>

    <section class="section">
      <h2>Ping Test</h2>
      <button @click="handlePing">Send Ping</button>
      <p v-if="lastPing">Last ping: {{ lastPing }}</p>
    </section>

    <section class="section">
      <h2>MCP Test</h2>
      <div class="button-group">
        <button :disabled="loading" @click="handleListTools">List Tools</button>
        <button :disabled="loading" @click="handleCallEchoTool">Call echo_tool</button>
      </div>

      <p v-if="loading">Loading...</p>
      <p v-if="error" class="error">Error: {{ error }}</p>

      <div v-if="tools.length > 0" class="result">
        <h3>Available Tools ({{ tools.length }})</h3>
        <ul>
          <li v-for="t in tools" :key="t.tool.name">
            <strong>{{ t.tool.name }}</strong>
            <span v-if="t.tool.description">— {{ t.tool.description }}</span>
            <span class="server">({{ t.server_name }})</span>
          </li>
        </ul>
      </div>

      <div v-if="callResult" class="result">
        <h3>Call Result</h3>
        <pre>{{ JSON.stringify(callResult, null, 2) }}</pre>
      </div>
    </section>
  </div>
</template>

<style scoped>
  .container {
    max-width: 600px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: sans-serif;
  }

  .section {
    margin-bottom: 2rem;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    color: red;
  }

  .result {
    margin-top: 1rem;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .server {
    color: #666;
    font-size: 0.9em;
  }

  pre {
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
