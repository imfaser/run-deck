<script setup lang="ts">
  defineProps<{
    title: string;
    value: string | number;
    unit?: string;
    color?: string;
    icon?: string;
    tooltip?: string;
  }>();
</script>

<template>
  <el-tooltip :content="tooltip" :disabled="!tooltip" placement="top">
    <div class="stat-card">
      <div class="stat-icon" :style="{ backgroundColor: `${color}15`, color }">
        {{ icon }}
      </div>
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">
          {{ value }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
        </div>
      </div>
    </div>
  </el-tooltip>
</template>

<style scoped lang="scss">
  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--spacing-rem-lg) var(--spacing-rem-xl);
    min-width: 200px;
    transition: box-shadow var(--transition-base);

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-title {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
  }

  .stat-unit {
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    color: var(--text-secondary);
    margin-left: 2px;
  }
</style>
