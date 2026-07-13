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
      <el-button text @click="emit('back')">← 返回</el-button>
      <h2 class="section-title">编辑服务器</h2>
    </div>

    <el-form label-width="auto" class="form-card">
      <el-form-item label="名称" required>
        <el-input
          :model-value="localName"
          placeholder="MCP 服务器"
          @update:model-value="updateName"
        />
      </el-form-item>

      <el-form-item label="类型">
        <el-select :model-value="config.type" style="width: 100%" disabled>
          <el-option label="标准输入 / 输出 (stdio)" value="local" />
          <el-option label="远程 HTTP 服务器 (http)" value="remote" />
        </el-select>
      </el-form-item>

      <template v-if="config.type === 'local'">
        <el-form-item label="启动命令">
          <el-input
            :model-value="getCommandText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个参数，例如：&#10;uvx&#10;echo-mcp-server"
            @update:model-value="updateCommand"
          />
        </el-form-item>

        <el-form-item label="环境变量">
          <el-input
            :model-value="getEnvText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个，格式：KEY=value"
            @update:model-value="updateEnv"
          />
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="URL" required>
          <el-input
            :model-value="config.url"
            placeholder="https://example.com/mcp"
            @update:model-value="(v: string) => updateField('url', v)"
          />
        </el-form-item>

        <el-form-item label="请求头">
          <el-input
            :model-value="getEnvText()"
            type="textarea"
            :rows="3"
            placeholder="每行一个，格式：KEY=value"
            @update:model-value="updateEnv"
          />
        </el-form-item>
      </template>

      <el-form-item label="超时（毫秒）">
        <el-input-number
          :model-value="config.timeout"
          :min="0"
          :step="1000"
          controls-position="right"
          @update:model-value="(v: number | undefined) => updateField('timeout', v)"
        />
      </el-form-item>

      <el-form-item label="启用">
        <el-switch
          :model-value="config.enabled"
          @update:model-value="(v: boolean | string | number) => updateField('enabled', Boolean(v))"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
  @use '../../styles/abstracts/mixins' as *;

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-base);
    margin-bottom: var(--spacing-rem-lg);
  }

  .section-title {
    @include section-title;
  }

  .form-card {
    @include card;
    padding: var(--spacing-rem-lg);
  }
</style>
