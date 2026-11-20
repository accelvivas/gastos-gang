import {
  addDaysToKey,
  endOfMonthKey,
  endOfWeekKey,
  fillMissingDays,
  formatDayHeader,
  startOfMonthKey,
  startOfWeekKey,
  toLocalDayKey,
} from '@/lib/dates';

describe('local day helpers', () => {
  test('uses local calendar fields around midnight', () => {
    const beforeMidnight = new Date(2026, 10, 20, 23, 59).getTime();
    const afterMidnight = new Date(2026, 10, 21, 0, 1).getTime();
    expect(toLocalDayKey(beforeMidnight)).toBe('2026-11-20');
    expect(toLocalDayKey(afterMidnight)).toBe('2026-11-21');
  });

  test('handles month, year, and leap-day boundaries', () => {
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToKey('2024-02-29', 1)).toBe('2024-03-01');
    expect(startOfMonthKey('2024-02-29')).toBe('2024-02-01');
    expect(endOfMonthKey('2024-02-10')).toBe('2024-02-29');
  });

  test('supports Monday and Sunday week starts', () => {
    expect(startOfWeekKey('2026-11-20')).toBe('2026-11-16');
    expect(endOfWeekKey('2026-11-20')).toBe('2026-11-22');
    expect(startOfWeekKey('2026-11-20', 0)).toBe('2026-11-15');
    expect(endOfWeekKey('2026-11-20', 0)).toBe('2026-11-21');
  });

  test('formats today, yesterday, and older headers', () => {
    const now = new Date(2026, 10, 20, 15, 30).getTime();
    expect(formatDayHeader('2026-11-20', now)).toBe('Today');
    expect(formatDayHeader('2026-11-19', now)).toBe('Yesterday');
    expect(formatDayHeader('2026-11-17', now)).toBe('Tue, Nov 17');
  });

  test('zero-fills missing chart days', () => {
    expect(
      fillMissingDays(
        [
          { day: '2026-11-20', totalCentavos: 7_000, count: 1 },
          { day: '2026-11-22', totalCentavos: 1_300, count: 2 },
        ],
        '2026-11-20',
        '2026-11-22'
      )
    ).toEqual([
      { day: '2026-11-20', totalCentavos: 7_000, count: 1 },
      { day: '2026-11-21', totalCentavos: 0, count: 0 },
      { day: '2026-11-22', totalCentavos: 1_300, count: 2 },
    ]);
  });
});
