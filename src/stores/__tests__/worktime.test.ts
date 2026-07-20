import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useWorktimeStore } from '@/stores/worktime';

describe('worktime store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('calculateWorkHours', () => {
    it('normal workday with break', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        workPeriod1Start: '09:00',
        workPeriod1End: '17:30',
        breakPeriod1Start: '12:00',
        breakPeriod1End: '13:30',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      const record = store.addRecord('2025-01-01', '09:00', '17:30');
      expect(record.workHours).toBe(7);
    });

    it('no break', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      const record = store.addRecord('2025-01-01', '09:00', '17:00');
      expect(record.workHours).toBe(8);
    });

    it('zero hours', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      const record = store.addRecord('2025-01-01', '09:00', '09:00');
      expect(record.workHours).toBe(0);
    });

    it('non-integer hours', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      const record = store.addRecord('2025-01-01', '09:00', '17:30');
      expect(record.workHours).toBeCloseTo(8.5, 3);
    });

    it('precision: 8.15 hours should not have floating point drift', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      const record = store.addRecord('2025-01-01', '08:00', '16:09');
      expect(record.workHours).toBe(8.15);
    });
  });

  describe('getMonthlyOvertime', () => {
    it('no overtime', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 8,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '17:00');
      store.addRecord('2025-01-02', '09:00', '17:00');
      expect(store.getMonthlyOvertime('2025-01')).toBe(0);
    });

    it('with overtime', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 8,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '18:00');
      store.addRecord('2025-01-02', '09:00', '17:00');
      expect(store.getMonthlyOvertime('2025-01')).toBeCloseTo(1, 3);
    });

    it('custom dailyTarget', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 7.5,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '17:00');
      expect(store.getMonthlyOvertime('2025-01')).toBeCloseTo(0.5, 3);
    });

    it('precision: no drift with multiple records', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 8,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '18:09');
      store.addRecord('2025-01-02', '09:00', '18:09');
      const overtime = store.getMonthlyOvertime('2025-01');
      expect(overtime).toBeCloseTo(2.3, 8);
    });
  });

  describe('getMonthlyAverage', () => {
    it('returns null for empty month', () => {
      const store = useWorktimeStore();
      expect(store.getMonthlyAverage('2025-01')).toBeNull();
    });

    it('calculates average correctly', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '17:00');
      store.addRecord('2025-01-02', '09:00', '18:00');
      expect(store.getMonthlyAverage('2025-01')).toBe(8.5);
    });
  });

  describe('getTargetDeficit', () => {
    it('returns deficit when below target', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 8,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '16:00');
      expect(store.getTargetDeficit('2025-01')).toBeCloseTo(1, 3);
    });

    it('returns 0 when at or above target', () => {
      const store = useWorktimeStore();
      store.updateSettings({
        dailyTarget: 8,
        breakPeriod1Start: '',
        breakPeriod1End: '',
        breakPeriod2Start: '',
        breakPeriod2End: '',
      });
      store.addRecord('2025-01-01', '09:00', '17:00');
      expect(store.getTargetDeficit('2025-01')).toBe(0);
    });
  });
});
