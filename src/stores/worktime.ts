import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import type { WorkRecord, WorktimeSettings } from '@/schemas/worktime';

export type { WorkRecord, WorktimeSettings };

const PRECISION = 1e8;
function roundHours(hours: number): number {
  return Math.round(hours * PRECISION) / PRECISION;
}

const DEFAULT_SETTINGS: WorktimeSettings = {
  workPeriod1Start: '08:00',
  workPeriod1End: '17:30',
  breakPeriod1Start: '12:00',
  breakPeriod1End: '13:30',
  workPeriod2Start: '13:30',
  workPeriod2End: '17:30',
  breakPeriod2Start: '17:30',
  breakPeriod2End: '18:00',
  dailyTarget: 8,
  autoSync: false,
  lastSyncTime: '',
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calculateWorkHours(clockIn: string, clockOut: string, settings: WorktimeSettings): number {
  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;

  let totalMinutes = outMinutes - inMinutes;

  function subtractBreak(bStart: string, bEnd: string) {
    if (!bStart || !bEnd) return;
    const [bsH, bsM] = bStart.split(':').map(Number);
    const [beH, beM] = bEnd.split(':').map(Number);
    const bStartMin = bsH * 60 + bsM;
    const bEndMin = beH * 60 + beM;
    const overlapStart = Math.max(inMinutes, bStartMin);
    const overlapEnd = Math.min(outMinutes, bEndMin);
    const overlap = overlapEnd - overlapStart;
    if (overlap > 0) {
      totalMinutes -= overlap;
    }
  }

  subtractBreak(settings.breakPeriod1Start, settings.breakPeriod1End);
  subtractBreak(settings.breakPeriod2Start, settings.breakPeriod2End);

  return roundHours(totalMinutes / 60);
}

function isPredictedWorkTime(date: string, _clockOut: string): boolean {
  const now = dayjs();
  const recordDate = dayjs(date);
  return recordDate.isAfter(now, 'day');
}

export const useWorktimeStore = defineStore(
  'worktime',
  () => {
    const records = ref<WorkRecord[]>([]);
    const settings = ref<WorktimeSettings>({ ...DEFAULT_SETTINGS });

    const recordsByDate = computed(() => {
      const map: Record<string, WorkRecord> = {};
      for (const r of records.value) {
        map[r.date] = r;
      }
      return map;
    });

    function hasRecord(date: string): boolean {
      return date in recordsByDate.value;
    }

    function getRecord(date: string): WorkRecord | undefined {
      return recordsByDate.value[date];
    }

    function getRecordsByMonth(yearMonth: string): WorkRecord[] {
      const now = dayjs();
      return records.value.filter((r) => {
        if (!r.date.startsWith(yearMonth)) return false;
        return dayjs(r.date).isBefore(now, 'day') || dayjs(r.date).isSame(now, 'day');
      });
    }

    function getMonthlyAverage(yearMonth: string): number | null {
      const monthRecords = getRecordsByMonth(yearMonth);
      if (monthRecords.length === 0) return null;
      const total = monthRecords.reduce((sum, r) => sum + r.workHours, 0);
      return roundHours(total / monthRecords.length);
    }

    function getMonthlyOvertime(yearMonth: string): number {
      const monthRecords = getRecordsByMonth(yearMonth);
      return roundHours(
        monthRecords.reduce((sum, r) => {
          const overtime = r.workHours - settings.value.dailyTarget;
          return sum + (overtime > 0 ? overtime : 0);
        }, 0)
      );
    }

    function isTargetMet(yearMonth: string): boolean {
      const avg = getMonthlyAverage(yearMonth);
      if (avg === null) return false;
      return avg >= settings.value.dailyTarget;
    }

    function getTargetDeficit(yearMonth: string): number {
      const avg = getMonthlyAverage(yearMonth);
      if (avg === null) return settings.value.dailyTarget;
      const deficit = settings.value.dailyTarget - avg;
      return deficit > 0 ? roundHours(deficit) : 0;
    }

    function addRecord(date: string, clockIn: string, clockOut: string): WorkRecord {
      const existing = recordsByDate.value[date];
      if (existing) {
        return updateRecord(existing.id, clockIn, clockOut);
      }

      const workHours = calculateWorkHours(clockIn, clockOut, settings.value);
      const record: WorkRecord = {
        id: generateId(),
        date,
        clockIn,
        clockOut,
        isPredicted: isPredictedWorkTime(date, clockOut),
        workHours,
      };
      records.value.push(record);
      return record;
    }

    function updateRecord(id: string, clockIn: string, clockOut: string): WorkRecord {
      const idx = records.value.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Record ${id} not found`);
      const existing = records.value[idx];
      const workHours = calculateWorkHours(clockIn, clockOut, settings.value);
      const updated: WorkRecord = {
        ...existing,
        clockIn,
        clockOut,
        workHours,
        isPredicted: isPredictedWorkTime(existing.date, clockOut),
      };
      records.value[idx] = updated;
      return updated;
    }

    function removeRecord(id: string) {
      records.value = records.value.filter((r) => r.id !== id);
    }

    function setRecord(date: string, clockIn?: string, clockOut?: string): WorkRecord | null {
      if (clockIn == null || clockOut == null) {
        const existing = recordsByDate.value[date];
        if (existing) {
          removeRecord(existing.id);
        }
        return null;
      }

      const existing = recordsByDate.value[date];
      if (existing) {
        return updateRecord(existing.id, clockIn, clockOut);
      }

      const workHours = calculateWorkHours(clockIn, clockOut, settings.value);
      const record: WorkRecord = {
        id: generateId(),
        date,
        clockIn,
        clockOut,
        isPredicted: isPredictedWorkTime(date, clockOut),
        workHours,
      };
      records.value.push(record);
      return record;
    }

    function updateSettings(updates: Partial<WorktimeSettings>) {
      settings.value = { ...settings.value, ...updates };
    }

    function resetSettings() {
      settings.value = { ...DEFAULT_SETTINGS };
    }

    function triggerSync() {
      settings.value.lastSyncTime = dayjs().toISOString();
    }

    return {
      records,
      settings,
      recordsByDate,
      hasRecord,
      getRecord,
      getRecordsByMonth,
      getMonthlyAverage,
      getMonthlyOvertime,
      isTargetMet,
      getTargetDeficit,
      addRecord,
      updateRecord,
      removeRecord,
      setRecord,
      updateSettings,
      resetSettings,
      triggerSync,
    };
  },
  {
    tauri: {
      autoStart: true,
      saveOnChange: true,
      saveStrategy: 'debounce',
      saveInterval: 500,
    },
  }
);
