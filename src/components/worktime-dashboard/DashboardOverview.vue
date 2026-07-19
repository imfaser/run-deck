<script setup lang="ts">
  import { computed } from 'vue';
  import dayjs from 'dayjs';
  import { useWorktimeStore } from '@/stores/worktime';
  import StatCard from './StatCard.vue';
  import WorktimeChart from './WorktimeChart.vue';
  import CheckInRecords from './CheckInRecords.vue';
  import PredictedWorktime from './PredictedWorktime.vue';

  const store = useWorktimeStore();

  const currentMonth = computed(() => dayjs().format('YYYY-MM'));

  const monthlyAverage = computed(() => {
    const avg = store.getMonthlyAverage(currentMonth.value);
    return avg !== null ? avg.toFixed(1) : '-';
  });

  const monthlyOvertime = computed(() => {
    return store.getMonthlyOvertime(currentMonth.value).toFixed(1);
  });

  const isTargetMet = computed(() => store.isTargetMet(currentMonth.value));

  const targetDeficit = computed(() => {
    return store.getTargetDeficit(currentMonth.value).toFixed(1);
  });

  const targetColor = computed(() => (isTargetMet.value ? '#22c55e' : '#ef4444'));

  const targetTooltip = computed(() => {
    if (isTargetMet.value) return '已达标';
    return `距离目标还差 ${targetDeficit.value} 小时`;
  });
</script>

<template>
  <div class="dashboard-overview">
    <div class="stats-row">
      <StatCard title="月平均工时" :value="monthlyAverage" unit="h" color="#6366f1" icon="⏱" />
      <StatCard title="奉献工时" :value="monthlyOvertime" unit="h" color="#f59e0b" icon="🔥" />
      <StatCard
        title="工时目标"
        :value="isTargetMet ? '达标' : '未达标'"
        :color="targetColor"
        :icon="isTargetMet ? '✅' : '⚠️'"
        :tooltip="targetTooltip"
      />
    </div>
    <WorktimeChart />
    <div class="bottom-row">
      <CheckInRecords />
      <PredictedWorktime />
    </div>
  </div>
</template>

<style scoped lang="scss">
  .dashboard-overview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-xl);
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--spacing-rem-lg);
  }

  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-rem-lg);

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  }
</style>
