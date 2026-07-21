<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { match } from 'ts-pattern';
  import { McpServerConfigSchema } from '@/schemas/config';
  import type { McpServerConfig } from '@/services/cmd';
  import type { FormInstance, FormRules } from 'element-plus';
  import { useConfigStore } from '@/stores/config';

  const store = useConfigStore();
  const formRef = ref<FormInstance>();

  const isLocal = computed(() => store.editingServer?.config.type === 'local');
  const isNew = computed(() => store.editingServer?.isNew ?? false);

  const existingNames = computed(() => {
    if (!store.config) return [];
    return Object.keys(store.config.mcp);
  });

  const originalName = ref('');

  watch(
    () => store.editingServer,
    (srv) => {
      if (srv) originalName.value = srv.name;
    },
    { immediate: true }
  );

  const rules = computed<FormRules>(() => ({
    name: [
      { required: true, message: '名称不能为空', trigger: 'blur' },
      {
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          if (value !== originalName.value && existingNames.value.includes(value)) {
            callback(new Error('名称已存在'));
          } else {
            callback();
          }
        },
        trigger: 'blur',
      },
    ],
    url: [
      { required: true, message: 'URL 不能为空', trigger: 'blur' },
      {
        pattern: /^https?:\/\/.+/,
        message: 'URL 格式不正确',
        trigger: 'blur',
      },
    ],
    command: [
      {
        validator: (_rule: unknown, _value: unknown, callback: (error?: Error) => void) => {
          if (isLocal.value && store.editingServer?.config.type === 'local') {
            if (store.editingServer.config.command.length === 0) {
              callback(new Error('启动命令不能为空'));
              return;
            }
          }
          callback();
        },
        trigger: 'blur',
      },
    ],
  }));

  function getCommandText(): string {
    if (store.editingServer?.config.type === 'local') {
      return store.editingServer.config.command.join('\n');
    }
    return '';
  }

  function getEnvText(): string {
    const cfg = store.editingServer?.config;
    if (!cfg) return '';
    const obj = cfg.type === 'local' ? cfg.environment : cfg.headers;
    if (!obj) return '';
    return Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  }

  function updateCommand(text: string) {
    if (store.editingServer?.config.type !== 'local') return;
    const command = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    store.updateServerConfig({ ...store.editingServer.config, command });
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
    const newObj = Object.keys(obj).length > 0 ? obj : undefined;
    if (store.editingServer?.config.type === 'local') {
      store.updateServerConfig({ ...store.editingServer.config, environment: newObj });
    } else if (store.editingServer?.config.type === 'remote') {
      store.updateServerConfig({ ...store.editingServer.config, headers: newObj });
    }
  }

  function updateType(type: 'local' | 'remote') {
    if (!store.editingServer || type === store.editingServer.config.type) return;
    const newConfig = match(type)
      .with(
        'local',
        (): McpServerConfig => ({
          type: 'local',
          command: [],
          enabled: store.editingServer!.config.enabled,
        })
      )
      .with(
        'remote',
        (): McpServerConfig => ({
          type: 'remote',
          url: '',
          enabled: store.editingServer!.config.enabled,
        })
      )
      .exhaustive();
    store.updateServerConfig(newConfig);
  }

  async function validateAndSave() {
    if (!formRef.value) return;
    await formRef.value.validate((valid) => {
      if (!valid) return;
      // Zod 兜底校验
      if (store.editingServer?.config) {
        const result = McpServerConfigSchema.safeParse(store.editingServer.config);
        if (!result.success) return;
      }
      store.saveServer();
    });
  }

  async function handleBack() {
    store.backToList();
  }
</script>

<template>
  <div v-if="store.editingServer" class="mcp-server-form">
    <div class="section-header">
      <el-button text @click="handleBack">← 返回</el-button>
      <h2 class="section-title">编辑服务器</h2>
    </div>

    <el-form
      ref="formRef"
      :model="{
        name: store.editingServer.name,
        url: store.editingServer.config.type === 'remote' ? store.editingServer.config.url : '',
        command: getCommandText(),
      }"
      :rules="rules"
      label-width="auto"
      class="form-card"
    >
      <el-form-item label="名称" prop="name" required>
        <el-input
          :model-value="store.editingServer.name"
          placeholder="MCP 服务器"
          @update:model-value="(v: string) => store.updateServerName(v)"
        />
      </el-form-item>

      <el-form-item label="类型">
        <el-select
          :model-value="store.editingServer.config.type"
          style="width: 100%"
          :disabled="!isNew"
          @update:model-value="(v: 'local' | 'remote') => updateType(v)"
        >
          <el-option label="标准输入 / 输出 (stdio)" value="local" />
          <el-option label="远程 HTTP 服务器 (http)" value="remote" />
        </el-select>
      </el-form-item>

      <template v-if="isLocal">
        <el-form-item label="启动命令" prop="command">
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
        <el-form-item label="URL" prop="url" required>
          <el-input
            :model-value="
              store.editingServer.config.type === 'remote' ? store.editingServer.config.url : ''
            "
            placeholder="https://example.com/mcp"
            @update:model-value="
              (v: string) =>
                store.updateServerConfig({ ...(store.editingServer!.config as any), url: v })
            "
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
          :model-value="store.editingServer.config.timeout"
          :min="0"
          :step="1000"
          controls-position="right"
          @update:model-value="
            (v: number | undefined) =>
              store.updateServerConfig({ ...store.editingServer!.config, timeout: v } as any)
          "
        />
      </el-form-item>

      <el-form-item label="启用">
        <el-switch
          :model-value="store.editingServer.config.enabled"
          @update:model-value="
            (v: boolean | string | number) =>
              store.updateServerConfig({
                ...store.editingServer!.config,
                enabled: Boolean(v),
              } as any)
          "
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
</style>
