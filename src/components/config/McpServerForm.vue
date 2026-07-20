<script setup lang="ts">
  // ========== 1. 第三方 / 内部模块引入 ==========
  import { watch } from 'vue';
  import { ElMessageBox } from 'element-plus';
  import { useForm, useField } from 'vee-validate';
  import { toTypedSchema } from '@vee-validate/zod';
  import { match } from 'ts-pattern';
  import { McpServerFormSchema } from '@/schemas/mcp-server-form';
  import type { McpServerConfig } from '@/services/cmd';

  // ========== 2. Props / Emits 定义 ==========
  const props = defineProps<{
    name: string;
    config: McpServerConfig;
    existingNames: string[];
    isDirty: boolean;
    isNew?: boolean;
  }>();

  const emit = defineEmits<{
    back: [];
    save: [];
    'update:name': [value: string];
    'update:config': [value: McpServerConfig];
    'dirty-change': [value: boolean];
  }>();

  // ========== 3. VeeValidate 表单 ==========
  const formSchema = toTypedSchema(McpServerFormSchema);

  const { meta, validate } = useForm({
    validationSchema: formSchema,
    initialValues: {
      name: props.name,
      config: props.config,
      existingNames: props.existingNames,
      originalName: props.name,
    },
  });

  const { value: nameValue, errorMessage: nameError } = useField<string>('name');

  // ========== 4. 侦听器 ==========
  watch(
    () => props.name,
    (v) => (nameValue.value = v)
  );

  // ========== 5. 普通方法与业务逻辑 ==========
  function updateName(value: string) {
    nameValue.value = value;
    emit('update:name', value);
    emit('dirty-change', true);
  }

  function updateField(key: string, value: unknown) {
    const newConfig = { ...props.config, [key]: value } as McpServerConfig;
    emit('update:config', newConfig);
    emit('dirty-change', true);
  }

  function updateType(type: 'local' | 'remote') {
    if (type === props.config.type) return;
    const newConfig = match(type)
      .with(
        'local',
        (): McpServerConfig => ({ type: 'local', command: [], enabled: props.config.enabled })
      )
      .with(
        'remote',
        (): McpServerConfig => ({ type: 'remote', url: '', enabled: props.config.enabled })
      )
      .exhaustive();
    emit('update:config', newConfig);
    emit('dirty-change', true);
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

  async function validateAndSave() {
    const { valid } = await validate();
    if (!valid) return;
    emit('save');
  }

  async function handleBack() {
    if (!meta.value.dirty) {
      emit('back');
      return;
    }
    try {
      await ElMessageBox.confirm('有未保存的修改，确定离开吗？', '未保存的修改', {
        confirmButtonText: '确定离开',
        cancelButtonText: '取消',
        type: 'warning',
      });
      emit('back');
    } catch {
      // cancelled
    }
  }
</script>

<template>
  <div class="mcp-server-form">
    <div class="section-header">
      <el-button text @click="handleBack">← 返回</el-button>
      <h2 class="section-title">编辑服务器</h2>
    </div>

    <el-form label-width="auto" class="form-card">
      <el-form-item label="名称" required>
        <el-input
          :model-value="nameValue"
          placeholder="MCP 服务器"
          :class="{ 'is-error': nameError }"
          @update:model-value="updateName"
        />
        <div v-if="nameError" class="field-error">{{ nameError }}</div>
      </el-form-item>

      <el-form-item label="类型">
        <el-select
          :model-value="config.type"
          style="width: 100%"
          :disabled="!props.isNew"
          @update:model-value="(v: 'local' | 'remote') => updateType(v)"
        >
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

      <el-form-item>
        <el-button type="primary" @click="validateAndSave">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/abstracts/mixins' as *;

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

  .field-error {
    color: var(--el-color-danger);
    font-size: var(--el-font-size-small);
    margin-top: var(--spacing-rem-xs);
  }

  :deep(.el-input.is-error) {
    --el-input-border-color: var(--el-color-danger);
  }
</style>
