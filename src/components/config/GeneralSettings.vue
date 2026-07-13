<script setup lang="ts">
  import type { Config, ShellType } from '@/services/cmd';

  defineProps<{
    config: Config;
  }>();

  const emit = defineEmits<{
    update: [key: string, value: unknown];
  }>();

  const logLevelOptions = ['error', 'warn', 'info', 'debug', 'trace'];

  const shellOptions: { label: string; value: ShellType }[] = [
    { label: '自动检测', value: 'auto' },
    { label: 'Cmd', value: 'cmd' },
    { label: 'PowerShell', value: 'powershell' },
    { label: 'Bash', value: 'bash' },
  ];

  const themeOptions = [
    { label: '深色', value: 'dark' },
    { label: '浅色', value: 'light' },
  ];

  const homeRouteOptions = [
    { label: '导航', value: 'overview' },
    { label: '配置', value: 'config' },
  ];

  function updateLogLevel(value: string) {
    emit('update', 'log_level', value);
  }

  function updateHome(value: string) {
    emit('update', 'frontend.home', value);
  }

  function updateShell(value: string) {
    emit('update', 'shell', value);
  }

  function updateMode(value: string) {
    emit('update', 'frontend.mode', value);
  }
</script>

<template>
  <div class="general-settings">
    <h2 class="section-title">通用</h2>

    <div class="setting-group">
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">日志级别</div>
          <div class="setting-desc">控制应用日志输出级别</div>
        </div>
        <el-select
          :model-value="config.log_level"
          placeholder="选择日志级别"
          style="width: 160px"
          @update:model-value="updateLogLevel"
        >
          <el-option v-for="level in logLevelOptions" :key="level" :label="level" :value="level" />
        </el-select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">首页路由</div>
          <div class="setting-desc">应用启动时跳转的页面</div>
        </div>
        <el-select
          :model-value="config.frontend.home"
          placeholder="选择首页"
          style="width: 160px"
          @update:model-value="updateHome"
        >
          <el-option
            v-for="option in homeRouteOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">主题模式</div>
          <div class="setting-desc">切换深色或浅色主题</div>
        </div>
        <el-select
          :model-value="config.frontend.mode"
          style="width: 160px"
          @update:model-value="updateMode"
        >
          <el-option
            v-for="option in themeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Shell 类型</div>
          <div class="setting-desc">MCP 服务器使用的 Shell 环境</div>
        </div>
        <el-select
          :model-value="config.shell"
          style="width: 160px"
          @update:model-value="updateShell"
        >
          <el-option
            v-for="option in shellOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  @use '../../styles/abstracts/mixins' as *;

  .section-title {
    @include section-title;
    margin-bottom: var(--spacing-rem-lg);
  }

  .setting-group {
    @include card;
    overflow: hidden;
  }

  .setting-item {
    @include flex-between;
    padding: var(--spacing-rem-base) var(--spacing-rem-lg);

    & + .setting-item {
      border-top: 1px solid var(--border-default);
    }
  }

  .setting-info {
    flex: 1;
    margin-right: var(--spacing-rem-base);
  }

  .setting-label {
    font-size: var(--text-md);
    color: var(--text-primary);
  }

  .setting-desc {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    margin-top: var(--spacing-rem-xs);
  }
</style>
