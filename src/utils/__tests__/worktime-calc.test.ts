import { describe, it, expect } from 'vitest';
import {
  roundHours,
  generateId,
  calculateWorkHours,
  isPredictedWorkTime,
} from '@/utils/worktime-calc';
import type { WorktimeSettings } from '@/schemas/worktime';

const baseSettings: WorktimeSettings = {
  workPeriod1Start: '09:00',
  workPeriod1End: '17:00',
  breakPeriod1Start: '',
  breakPeriod1End: '',
  workPeriod2Start: '',
  workPeriod2End: '',
  breakPeriod2Start: '',
  breakPeriod2End: '',
  dailyTarget: 8,
  autoSync: false,
  lastSyncTime: '',
};

describe('roundHours', () => {
  it('rounds to 8 decimal places', () => {
    expect(roundHours(1.123456789)).toBe(1.12345679);
    expect(roundHours(1.000000001)).toBe(1);
    expect(roundHours(1.999999999)).toBe(2);
  });

  it('returns integer unchanged', () => {
    expect(roundHours(5)).toBe(5);
    expect(roundHours(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(roundHours(-1.123456789)).toBe(-1.12345679);
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values on successive calls', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe('calculateWorkHours', () => {
  it('normal 8h workday with 1.5h break = 6.5h', () => {
    const settings: WorktimeSettings = {
      ...baseSettings,
      breakPeriod1Start: '12:00',
      breakPeriod1End: '13:30',
    };
    expect(calculateWorkHours('09:00', '17:00', settings)).toBe(6.5);
  });

  it('no break: 9:00-17:00 = 8h', () => {
    expect(calculateWorkHours('09:00', '17:00', baseSettings)).toBe(8);
  });

  it('zero hours: 9:00-9:00 = 0', () => {
    expect(calculateWorkHours('09:00', '09:00', baseSettings)).toBe(0);
  });

  it('overnight not supported (negative = negative)', () => {
    expect(calculateWorkHours('17:00', '09:00', baseSettings)).toBe(-8);
  });

  it('partial break overlap', () => {
    const settings: WorktimeSettings = {
      ...baseSettings,
      breakPeriod1Start: '08:00',
      breakPeriod1End: '10:00',
    };
    expect(calculateWorkHours('09:00', '17:00', settings)).toBe(7);
  });

  it('two breaks', () => {
    const settings: WorktimeSettings = {
      ...baseSettings,
      breakPeriod1Start: '10:00',
      breakPeriod1End: '10:30',
      breakPeriod2Start: '12:00',
      breakPeriod2End: '13:00',
    };
    expect(calculateWorkHours('09:00', '17:00', settings)).toBe(6.5);
  });
});

describe('isPredictedWorkTime', () => {
  it('future date returns true', () => {
    expect(isPredictedWorkTime('2099-12-31', '17:00')).toBe(true);
  });

  it('past date returns false', () => {
    expect(isPredictedWorkTime('2000-01-01', '17:00')).toBe(false);
  });
});
