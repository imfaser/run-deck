<script setup lang="ts">
  import { computed } from 'vue';
  import dayjs from 'dayjs';
  import { match } from 'ts-pattern';
  import { useWorktimeStore } from '@/stores/worktime';

  const store = useWorktimeStore();

  const pastDaysWithRecords = computed(() => {
    const now = dayjs();
    const currentMonth = now.format('YYYY-MM');
    return store.records.filter(
      (r) =>
        r.date.startsWith(currentMonth) &&
        (dayjs(r.date).isBefore(now, 'day') || dayjs(r.date).isSame(now, 'day'))
    );
  });

  const currentAverage = computed(() =>
    match(pastDaysWithRecords.value.length)
      .with(0, () => store.settings.dailyTarget)
      .otherwise(() => {
        const total = pastDaysWithRecords.value.reduce((sum, r) => sum + r.workHours, 0);
        return total / pastDaysWithRecords.value.length;
      })
  );

  const futureRecords = computed(() => {
    const now = dayjs();
    const currentMonth = now.format('YYYY-MM');
    return store.records.filter(
      (r) => r.date.startsWith(currentMonth) && dayjs(r.date).isAfter(now, 'day')
    );
  });

  const futureHoursSum = computed(() => {
    return futureRecords.value.reduce((sum, r) => sum + r.workHours, 0);
  });

  const totalDaysWithRecords = computed(() => {
    return pastDaysWithRecords.value.length + futureRecords.value.length;
  });

  const predictedAverage = computed(() =>
    match(totalDaysWithRecords.value)
      .with(0, () => currentAverage.value)
      .otherwise(() => {
        const totalHours =
          currentAverage.value * pastDaysWithRecords.value.length + futureHoursSum.value;
        return totalHours / totalDaysWithRecords.value;
      })
  );

  const monthDaysLeft = computed(() => {
    const now = dayjs();
    return now.daysInMonth() - now.date();
  });

  const recordedFutureDates = computed(() => {
    const now = dayjs();
    const currentMonth = now.format('YYYY-MM');
    return store.records
      .filter((r) => r.date.startsWith(currentMonth) && dayjs(r.date).isAfter(now, 'day'))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        dateFormatted: dayjs(r.date).format('MM-DD'),
        dayOfWeek: dayjs(r.date).format('ddd'),
        workHours: r.workHours,
      }));
  });
</script>

<template>
  <div class="predicted-worktime">
    <div class="section-header">
      <span class="section-icon">🔮</span>
      <span class="section-title">预测工时</span>
    </div>

    <div class="prediction-summary">
      <div class="summary-item">
        <span class="summary-label">本月剩余</span>
        <span class="summary-value">{{ monthDaysLeft }} 天</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">预测平均</span>
        <span class="summary-value accent">{{ predictedAverage.toFixed(3) }}h/天</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">已记录</span>
        <span class="summary-value">{{ totalDaysWithRecords }} 天</span>
      </div>
    </div>

    <div v-if="recordedFutureDates.length > 0" class="predicted-list">
      <div v-for="item in recordedFutureDates" :key="item.date" class="predicted-item">
        <div class="predicted-date">
          <span class="date-num">{{ item.dateFormatted }}</span>
          <span class="day-of-week">{{ item.dayOfWeek }}</span>
        </div>
        <div class="predicted-hours recorded">{{ item.workHours.toFixed(3) }}h</div>
      </div>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">📝</span>
      <span class="empty-text">暂无未来工时安排</span>
      <span class="empty-hint">在日历中点击未来日期录入工时</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .predicted-worktime {
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

  .prediction-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-rem-md);
    margin-bottom: var(--spacing-rem-lg);
    padding: var(--spacing-rem-md);
    background: var(--fill-color-blank);
    border-radius: var(--radius-md);
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .summary-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .summary-value {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);

    &.accent {
      color: var(--accent);
    }
  }

  .predicted-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-xs);
  }

  .predicted-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-rem-sm) var(--spacing-rem-md);
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-default);

    &:hover {
      background: var(--fill-color-light);
    }
  }

  .predicted-date {
    display: flex;
    align-items: center;
    gap: var(--spacing-rem-sm);
  }

  .date-num {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .day-of-week {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .predicted-hours {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--accent);

    &.recorded {
      color: var(--status-success);
      border: 1px solid var(--status-success);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-rem-sm);
    padding: var(--spacing-rem-xl);
    text-align: center;
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .empty-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    opacity: 0.7;
  }
</style>
