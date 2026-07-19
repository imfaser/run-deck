<script setup lang="ts">
  import { computed } from 'vue';
  import dayjs from 'dayjs';
  import { ElMessage } from 'element-plus';
  import { useWorktimeStore } from '@/stores/worktime';

  const store = useWorktimeStore();
  const s = computed(() => store.settings);

  function update(key: string, value: string | number | boolean) {
    store.updateSettings({ [key]: value });
  }

  function handleSync() {
    store.triggerSync();
    ElMessage.success('同步完成');
  }

  function formatSyncTime(iso: string) {
    if (!iso) return '从未同步';
    return dayjs(iso).format('YYYY-MM-DD HH:mm:ss');
  }
</script>

<template>
  <div class="worktime-settings">
    <h3 class="section-title">工时设置</h3>

    <el-card shadow="never">
      <template #header>
        <span class="card-header">工作时间段</span>
      </template>

      <el-form label-width="120px" label-position="left">
        <div class="time-group">
          <div class="group-label">第一段</div>
          <el-form-item label="工作时间">
            <div class="time-range">
              <el-time-picker
                :model-value="s.workPeriod1Start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始"
                arrow-control
                @update:model-value="(v: string) => update('workPeriod1Start', v)"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                :model-value="s.workPeriod1End"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束"
                arrow-control
                @update:model-value="(v: string) => update('workPeriod1End', v)"
              />
            </div>
          </el-form-item>
          <el-form-item label="休息时间">
            <div class="time-range">
              <el-time-picker
                :model-value="s.breakPeriod1Start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始"
                arrow-control
                @update:model-value="(v: string) => update('breakPeriod1Start', v)"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                :model-value="s.breakPeriod1End"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束"
                arrow-control
                @update:model-value="(v: string) => update('breakPeriod1End', v)"
              />
            </div>
          </el-form-item>
        </div>

        <el-divider />

        <div class="time-group">
          <div class="group-label">第二段（可选）</div>
          <el-form-item label="工作时间">
            <div class="time-range">
              <el-time-picker
                :model-value="s.workPeriod2Start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始"
                arrow-control
                @update:model-value="(v: string) => update('workPeriod2Start', v)"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                :model-value="s.workPeriod2End"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束"
                arrow-control
                @update:model-value="(v: string) => update('workPeriod2End', v)"
              />
            </div>
          </el-form-item>
          <el-form-item label="休息时间">
            <div class="time-range">
              <el-time-picker
                :model-value="s.breakPeriod2Start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始"
                arrow-control
                @update:model-value="(v: string) => update('breakPeriod2Start', v)"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                :model-value="s.breakPeriod2End"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束"
                arrow-control
                @update:model-value="(v: string) => update('breakPeriod2End', v)"
              />
            </div>
          </el-form-item>
        </div>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="card-header">工时目标</span>
      </template>

      <el-form label-width="120px" label-position="left">
        <el-form-item label="每日目标（h）">
          <el-input-number
            :model-value="s.dailyTarget"
            :min="0.5"
            :step="0.5"
            @update:model-value="(v) => v != null && update('dailyTarget', v)"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="card-header">数据同步</span>
      </template>

      <el-form label-width="120px" label-position="left">
        <el-form-item label="自动同步">
          <el-switch
            :model-value="s.autoSync"
            @update:model-value="(v) => update('autoSync', Boolean(v))"
          />
        </el-form-item>
        <el-form-item label="上次同步">
          <span class="sync-time">{{ formatSyncTime(s.lastSyncTime) }}</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSync">立即同步工时</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
  .worktime-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-lg);
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    margin: 0;
  }

  .card-header {
    font-weight: var(--font-medium);
  }

  .time-group {
    .group-label {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin-bottom: var(--spacing-rem-base);
    }
  }

  .time-range {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-sm);
  }

  .time-separator {
    color: var(--text-secondary);
  }

  .sync-time {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
</style>
