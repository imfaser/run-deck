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
    <el-table :data="recentRecords" stripe size="small">
      <el-table-column label="日期" width="100">
        <template #default="{ row }">
          <div class="record-date">
            <span class="day-label">{{ formatDay(row.date) }}</span>
            <span class="day-of-week">{{ row.dayOfWeek }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="时间">
        <template #default="{ row }">
          <template v-if="row.clockIn !== '-'">{{ row.clockIn }} - {{ row.clockOut }}</template>
          <span v-else class="no-record">未打卡</span>
        </template>
      </el-table-column>
      <el-table-column label="工时" width="100" align="right">
        <template #default="{ row }">
          <span :class="{ 'has-data': row.workHours > 0 }">
            {{ row.workHours > 0 ? `${row.workHours.toFixed(3)}h` : '-' }}
          </span>
        </template>
      </el-table-column>
    </el-table>
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

  .no-record {
    color: var(--text-secondary);
    font-style: italic;
  }

  .has-data {
    color: var(--accent);
    font-weight: var(--font-medium);
  }
</style>
