<script setup lang="ts">
  import { ref, computed } from 'vue';
  import dayjs from 'dayjs';
  import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
  import { useWorktimeStore } from '@/stores/worktime';
  import WorktimeEntryDialog from './WorktimeEntryDialog.vue';

  const store = useWorktimeStore();
  const selectedDate = ref(new Date());
  const showDialog = ref(false);
  const editingDate = ref('');

  const calendarTitle = computed(() => dayjs(selectedDate.value).format('YYYY年M月'));

  function handleDateClick(dateStr: string) {
    editingDate.value = dateStr;
    showDialog.value = true;
  }

  function handleSave() {
    showDialog.value = false;
  }

  function getRecordForDate(date: string) {
    return store.recordsByDate[date];
  }

  function isTargetMetForDate(date: string): boolean {
    const record = getRecordForDate(date);
    if (!record) return false;
    return record.workHours >= store.settings.dailyTarget;
  }

  function prevMonth() {
    const d = dayjs(selectedDate.value).subtract(1, 'month');
    selectedDate.value = d.toDate();
  }

  function nextMonth() {
    const d = dayjs(selectedDate.value).add(1, 'month');
    selectedDate.value = d.toDate();
  }
</script>

<template>
  <div class="worktime-calendar">
    <div class="calendar-header">
      <el-button text @click="prevMonth">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="calendar-title">{{ calendarTitle }}</span>
      <el-button text @click="nextMonth">
        <el-icon><ArrowRight /></el-icon>
      </el-button>
    </div>

    <el-calendar v-model="selectedDate">
      <template #date-cell="{ data }">
        <div
          class="date-cell"
          :class="{
            'has-record': getRecordForDate(data.day),
            'target-met': isTargetMetForDate(data.day),
            'target-missed': getRecordForDate(data.day) && !isTargetMetForDate(data.day),
            'predicted': getRecordForDate(data.day)?.isPredicted,
          }"
          @click.stop="handleDateClick(data.day)"
        >
          <span class="date-number">{{ data.day.split('-')[2] }}</span>
          <span v-if="getRecordForDate(data.day)" class="work-hours">
            {{ getRecordForDate(data.day)!.workHours.toFixed(1) }}h
          </span>
        </div>
      </template>
    </el-calendar>

    <WorktimeEntryDialog
      v-model:visible="showDialog"
      :date="editingDate"
      @save="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
  .worktime-calendar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-lg);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-rem-lg);
  }

  .calendar-title {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    min-width: 120px;
    text-align: center;
  }

  .date-cell {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: background var(--transition-base);

    &:hover {
      background: var(--fill-color-light);
    }

    &.has-record {
      .work-hours {
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
      }
    }

    &.target-met .work-hours {
      color: #22c55e;
    }

    &.target-missed .work-hours {
      color: #ef4444;
    }

    &.predicted .work-hours {
      border: 1px dashed var(--text-secondary);
      padding: 0 4px;
      border-radius: var(--radius-sm);
    }
  }

  .date-number {
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .work-hours {
    color: var(--text-secondary);
  }

  :deep(.el-calendar-table td) {
    border: 1px solid var(--border-default);
  }
</style>
