import {
  startOfUTCDay,
  startOfUTCWeek,
  startOfUTCMonth,
  addUTCDays,
  addUTCMonths,
} from './date.util';

describe('Date Utilities', () => {
  describe('startOfUTCDay', () => {
    it('should set all time components to 0 UTC', () => {
      const date = new Date('2026-07-05T19:42:06.123Z');
      const start = startOfUTCDay(date);
      expect(start.toISOString()).toBe('2026-07-05T00:00:00.000Z');
    });
  });

  describe('startOfUTCWeek', () => {
    it('should return Monday of the same week for a Wednesday', () => {
      const date = new Date('2026-10-14T12:00:00.000Z'); // Wednesday
      const start = startOfUTCWeek(date);
      expect(start.toISOString()).toBe('2026-10-12T00:00:00.000Z'); // Monday
    });

    it('should return Monday of the same week for a Sunday', () => {
      const date = new Date('2026-10-18T12:00:00.000Z'); // Sunday
      const start = startOfUTCWeek(date);
      expect(start.toISOString()).toBe('2026-10-12T00:00:00.000Z'); // Monday
    });

    it('should return the same day for a Monday', () => {
      const date = new Date('2026-10-12T12:00:00.000Z'); // Monday
      const start = startOfUTCWeek(date);
      expect(start.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });
  });

  describe('startOfUTCMonth', () => {
    it('should return the 1st of the current month', () => {
      const date = new Date('2026-07-05T19:42:06.123Z');
      const start = startOfUTCMonth(date);
      expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });
  });

  describe('addUTCDays', () => {
    it('should add days correctly', () => {
      const date = new Date('2026-07-05T00:00:00.000Z');
      const updated = addUTCDays(date, 5);
      expect(updated.toISOString()).toBe('2026-07-10T00:00:00.000Z');
    });

    it('should subtract days correctly', () => {
      const date = new Date('2026-07-05T00:00:00.000Z');
      const updated = addUTCDays(date, -5);
      expect(updated.toISOString()).toBe('2026-06-30T00:00:00.000Z');
    });
  });

  describe('addUTCMonths', () => {
    it('should add months correctly', () => {
      const date = new Date('2026-07-01T00:00:00.000Z');
      const updated = addUTCMonths(date, 3);
      expect(updated.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should subtract months correctly', () => {
      const date = new Date('2026-07-01T00:00:00.000Z');
      const updated = addUTCMonths(date, -3);
      expect(updated.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('should prevent month-rollover bug when adding 1 month to May 31st', () => {
      const date = new Date('2026-05-31T00:00:00.000Z');
      const updated = addUTCMonths(date, 1);
      expect(updated.toISOString()).toBe('2026-06-30T00:00:00.000Z'); // June has only 30 days
    });

    it('should prevent month-rollover bug when adding 1 month to January 31st', () => {
      const date = new Date('2026-01-31T00:00:00.000Z');
      const updated = addUTCMonths(date, 1);
      expect(updated.toISOString()).toBe('2026-02-28T00:00:00.000Z'); // Feb has 28 days in 2026
    });

    it('should handle leap year correctly when adding 1 month to January 31st of 2028', () => {
      const date = new Date('2028-01-31T00:00:00.000Z');
      const updated = addUTCMonths(date, 1);
      expect(updated.toISOString()).toBe('2028-02-29T00:00:00.000Z'); // 2028 is a leap year
    });
  });
});
