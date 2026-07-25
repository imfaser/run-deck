import dayjs from 'dayjs';
import type { WorktimeSettings } from '@/schemas/worktime';

const PRECISION = 1e8;

export function roundHours(hours: number): number {
  return Math.round(hours * PRECISION) / PRECISION;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function calculateWorkHours(
  clockIn: string,
  clockOut: string,
  settings: WorktimeSettings
): number {
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

export function isPredictedWorkTime(date: string, _clockOut: string): boolean {
  const now = dayjs();
  const recordDate = dayjs(date);
  return recordDate.isAfter(now, 'day');
}
