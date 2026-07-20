<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue';
  import dayjs from 'dayjs';
  import * as echarts from 'echarts/core';
  import { LineChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';
  import { useWorktimeStore } from '@/stores/worktime';

  echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

  const store = useWorktimeStore();
  const chartRef = ref<HTMLDivElement>();
  const chart = shallowRef<echarts.ECharts>();
  const activeView = ref<'daily' | 'weekly' | 'monthly'>('daily');

  const viewOptions = [
    { label: '每日的', value: 'daily' as const },
    { label: '每周的', value: 'weekly' as const },
    { label: '每月的', value: 'monthly' as const },
  ];

  const dailyData = computed(() => {
    const now = dayjs();
    const records = store.records.filter((r) => r.date.startsWith(now.format('YYYY-MM')));

    let lastDay = now.date();
    if (records.length > 0) {
      const lastRecordDate = records.reduce((latest, r) => {
        return r.date > latest ? r.date : latest;
      }, records[0].date);
      lastDay = Math.max(lastDay, dayjs(lastRecordDate).date());
    }

    const startDay = Math.max(1, lastDay - 7);
    const labels: string[] = [];
    const values: number[] = [];

    for (let d = startDay; d <= lastDay; d++) {
      const date = now.date(d).format('YYYY-MM-DD');
      labels.push(now.date(d).format('MM-DD'));
      const record = store.recordsByDate[date];
      values.push(record ? record.workHours : 0);
    }

    return { labels, values };
  });

  const weeklyData = computed(() => {
    const now = dayjs();
    const weekStart = now.startOf('week').add(1, 'day');
    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, 'day');
      if (day.month() !== now.month()) continue;
      const date = day.format('YYYY-MM-DD');
      const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      labels.push(dayNames[i]);
      const record = store.recordsByDate[date];
      values.push(record ? record.workHours : 0);
    }

    return { labels, values };
  });

  const monthlyData = computed(() => {
    const now = dayjs();
    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const month = now.subtract(i, 'month');
      const yearMonth = month.format('YYYY-MM');
      labels.push(month.format('M月'));
      const avg = store.getMonthlyAverage(yearMonth);
      values.push(avg ?? 0);
    }

    return { labels, values };
  });

  const currentData = computed(() => {
    switch (activeView.value) {
      case 'daily':
        return dailyData.value;
      case 'weekly':
        return weeklyData.value;
      case 'monthly':
        return monthlyData.value;
    }
  });

  const chartOption = computed(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      textStyle: {
        color: '#374151',
      },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        return `<div style="font-weight:500">${p.name}</div><div>工时: ${p.value.toFixed(3)}h</div>`;
      },
    },
    grid: {
      left: 50,
      right: 20,
      top: 30,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: currentData.value.labels,
      axisLine: {
        lineStyle: { color: '#e5e7eb' },
      },
      axisTick: { show: false },
      axisLabel: {
        color: '#9ca3af',
        fontSize: 12,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}h',
        color: '#9ca3af',
      },
      splitLine: {
        lineStyle: { color: '#f3f4f6' },
      },
    },
    series: [
      {
        name: '工时',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        data: currentData.value.values,
        lineStyle: {
          width: 3,
          color: '#6366f1',
        },
        itemStyle: {
          color: '#6366f1',
          borderWidth: 2,
          borderColor: '#fff',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.2)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.02)' },
            ],
          },
        },
      },
    ],
  }));

  function initChart() {
    if (!chartRef.value) return;
    chart.value = echarts.init(chartRef.value);
    chart.value.setOption(chartOption.value);
  }

  function handleResize() {
    chart.value?.resize();
  }

  watch(chartOption, (opt) => {
    chart.value?.setOption(opt, true);
  });

  onMounted(() => {
    initChart();
    window.addEventListener('resize', handleResize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    chart.value?.dispose();
  });
</script>

<template>
  <div class="worktime-chart">
    <div class="chart-header">
      <span class="chart-title">工时趋势</span>
      <div class="view-tabs">
        <button
          v-for="opt in viewOptions"
          :key="opt.value"
          class="view-tab"
          :class="{ active: activeView === opt.value }"
          @click="activeView = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div ref="chartRef" class="chart-container" />
  </div>
</template>

<style scoped lang="scss">
  .worktime-chart {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--spacing-rem-xl);
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-rem-lg);
  }

  .chart-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .view-tabs {
    display: flex;
    gap: var(--spacing-rem-lg);
  }

  .view-tab {
    background: none;
    border: none;
    padding: var(--spacing-rem-sm) 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all var(--transition-base);

    &:hover {
      color: var(--text-primary);
    }

    &.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      font-weight: var(--font-medium);
    }
  }

  .chart-container {
    width: 100%;
    height: 320px;
  }
</style>
