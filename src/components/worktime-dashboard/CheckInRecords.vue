<script setup lang="ts">
  import { computed } from 'vue';
  import dayjs from 'dayjs';
  import { match, P } from 'ts-pattern';
  import { useWorktimeStore } from '@/stores/worktime';

  const store = useWorktimeStore();

  const recentRecords = computed(() => {
    const now = dayjs();
    const records: Array<{
      date: string;
      dayOfWeek: string;
      clockIn: string;
      clockOut: string;
      workHours: number;
    }> = [];

    for (let i = 0; i <= 7; i++) {
      const date = now.subtract(i, 'day');
      const dateStr = date.format('YYYY-MM-DD');
      const record = store.recordsByDate[dateStr];

      records.push({
        date: dateStr,
        dayOfWeek: date.format('ddd'),
        clockIn: record?.clockIn ?? '-',
        clockOut: record?.clockOut ?? '-',
        workHours: record?.workHours ?? 0,
      });
    }

    return records;
  });

  function formatDay(date: string) {
    const d = dayjs(date);
    const now = dayjs();
    return match(true)
      .with(
        P.when(() => d.isSame(now, 'day')),
        () => '今天'
      )
      .with(
        P.when(() => d.isSame(now.subtract(1, 'day'), 'day')),
        () => '昨天'
      )
      .otherwise(() => d.format('MM-DD'));
  }
</script>

<template>
  <div class="check-in-records">
    <div class="section-header">
      <span class="section-icon">📋</span>
      <span class="section-title">打卡记录</span>
    </div>
    <div class="records-list">
      <div v-for="record in recentRecords" :key="record.date" class="record-item">
        <div class="record-date">
          <span class="day-label">{{ formatDay(record.date) }}</span>
          <span class="day-of-week">{{ record.dayOfWeek }}</span>
        </div>
        <div class="record-time">
          <template v-if="record.clockIn !== '-'">
            {{ record.clockIn }} - {{ record.clockOut }}
          </template>
          <template v-else>
            <span class="no-record">未打卡</span>
          </template>
        </div>
        <div class="record-hours" :class="{ 'has-data': record.workHours > 0 }">
          {{ record.workHours > 0 ? `${record.workHours.toFixed(3)}h` : '-' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .check-in-records {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--spacing-rem-xl);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-sm);
    margin-bottom: var(--spacing-rem-lg);
  }

  .section-icon {
    font-size: var(--text-lg);
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .records-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-sm);
  }

  .record-item {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    padding: var(--spacing-rem-sm) var(--spacing-rem-md);
    border-radius: var(--radius-md);
    transition: background var(--transition-base);

    &:hover {
      background: var(--fill-color-light);
    }
  }

  .record-date {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .day-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .day-of-week {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .record-time {
    font-size: var(--text-sm);
    color: var(--text-regular);
  }

  .no-record {
    color: var(--text-secondary);
    font-style: italic;
  }

  .record-hours {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    min-width: 50px;
    text-align: right;

    &.has-data {
      color: var(--accent);
    }
  }
</style>
