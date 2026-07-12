<script setup lang="ts">
  import { ref, watch } from 'vue';
  import type { McpServerConfig } from '@/services/cmd';

  const props = defineProps<{
    name: string;
    config: McpServerConfig;
  }>();

  const emit = defineEmits<{
    back: [];
    'update:name': [value: string];
    'update:config': [value: McpServerConfig];
  }>();

  const localName = ref(props.name);

  watch(
    () => props.name,
    (v) => (localName.value = v)
  );

  function updateName(value: string) {
    localName.value = value;
    emit('update:name', value);
  }

  function updateField(key: string, value: unknown) {
    const newConfig = { ...props.config, [key]: value } as McpServerConfig;
    emit('update:config', newConfig);
  }

  function updateCommand(text: string) {
    if (props.config.type !== 'local') return;
    const command = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    updateField('command', command);
  }

  function updateEnv(text: string) {
    const obj: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        obj[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
      }
    }
    const key = props.config.type === 'local' ? 'environment' : 'headers';
    updateField(key, Object.keys(obj).length > 0 ? obj : undefined);
  }

  function getCommandText(): string {
    if (props.config.type === 'local') return props.config.command.join('\n');
    return '';
  }

  function getEnvText(): string {
    const obj = props.config.type === 'local' ? props.config.environment : props.config.headers;
    if (!obj) return '';
    return Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  }
</script>

<template>
  <div class="mcp-server-form">
    <div class="section-header">
      <button class="back-btn" @click="emit('back')">← 返回</button>
      <h2 class="section-title">编辑服务器</h2>
    </div>

    <div class="form-card">
      <div class="form-item">
        <label class="form-label required">名称</label>
        <el-input
          :model-value="localName"
          placeholder="MCP 服务器"
          @update:model-value="updateName"
        />
      </div>

      <div class="form-item">
        <label class="form-label">类型</label>
        <el-select :model-value="config.type" style="width: 100%" disabled>
          <el-option label="标准输入 / 输出 (stdio)" value="local" />
          <el-option label="远程 HTTP 服务器 (http)" value="remote" />
        </el-select>
      </div>

      <template v-if="config.type === 'local'">
        <div class="form-item">
          <label class="form-label">启动命令</label>
          <el-input
            :model-value="getCommandText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个参数，例如：&#10;uvx&#10;echo-mcp-server"
            @update:model-value="updateCommand"
          />
        </div>

        <div class="form-item">
          <label class="form-label">环境变量</label>
          <el-input
            :model-value="getEnvText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个，格式：KEY=value"
            @update:model-value="updateEnv"
          />
        </div>
      </template>

      <template v-else>
        <div class="form-item">
          <label class="form-label required">URL</label>
          <el-input
            :model-value="config.url"
            placeholder="https://example.com/mcp"
            @update:model-value="(v: string) => updateField('url', v)"
          />
        </div>

        <div class="form-item">
          <label class="form-label">请求头</label>
          <el-input
            :model-value="getEnvText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个，格式：KEY=value"
            @update:model-value="updateEnv"
          />
        </div>
      </template>

      <div class="form-item">
        <label class="form-label">超时（毫秒）</label>
        <el-input-number
          :model-value="config.timeout"
          :min="0"
          :step="1000"
          controls-position="right"
          @update:model-value="(v: number | undefined) => updateField('timeout', v)"
        />
      </div>

      <div class="form-item row">
        <label class="form-label">启用</label>
        <el-switch
          :model-value="config.enabled"
          @update:model-value="(v: boolean) => updateField('enabled', v)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--accent-hover);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;

    &:hover {
      color: var(--accent-primary);
    }
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .form-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .form-item {
    margin-bottom: 1.25rem;

    &:last-child {
      margin-bottom: 0;
    }

    &.row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;

    &.required::before {
      content: '*';
      color: var(--status-error);
      margin-right: 0.25rem;
    }

    .row & {
      margin-bottom: 0;
    }
  }
</style>
