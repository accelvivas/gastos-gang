import { crossedBudgetThreshold, getBudgetWarningMessage, getDailyBudgetProgress } from '@/features/entry/utils/dailyBudget';

describe('daily budget progress', () => {
  test.each([
    [79, 'normal'],
    [80, 'warning'],
    [99, 'warning'],
    [100, 'over'],
    [140, 'over'],
  ] as const)('classifies %i percent as %s', (percent, stage) => {
    const progress = getDailyBudgetProgress(percent, 100);
    expect(progress.stage).toBe(stage);
    expect(progress.percentageUsed).toBe(percent);
  });

  test('caps visual progress but preserves actual over-budget amount and percentage', () => {
    expect(getDailyBudgetProgress(150, 100)).toEqual({
      stage: 'over',
      percentageUsed: 150,
      progress: 1,
      remainingCentavos: 0,
      overCentavos: 50,
    });

  });

  test('preserves displayed percentage precision below the warning boundary', () => {
    const progress = getDailyBudgetProgress(7_999, 10_000);
    expect(progress.stage).toBe('normal');
    expect(progress.percentageUsed).toBe(79.99);
  });

  test('emits warning messages only on upward crossings within the same enabled day', () => {
    expect(crossedBudgetThreshold('normal', 'warning')).toBe(true);
    expect(getBudgetWarningMessage(
      { dayKey: '2026-11-21', enabled: true, stage: 'normal' },
      { dayKey: '2026-11-21', enabled: true, stage: 'warning' }
    )).toBe('Bossing, malapit na sa budget limit!');
    expect(getBudgetWarningMessage(
      { dayKey: '2026-11-21', enabled: true, stage: 'warning' },
      { dayKey: '2026-11-21', enabled: true, stage: 'over' }
    )).toBe('Aray! Lagpas budget na tayo, bossing!');
    expect(getBudgetWarningMessage(
      { dayKey: '2026-11-21', enabled: true, stage: 'warning' },
      { dayKey: '2026-11-21', enabled: true, stage: 'warning' }
    )).toBeNull();
    expect(getBudgetWarningMessage(
      { dayKey: '2026-11-20', enabled: true, stage: 'warning' },
      { dayKey: '2026-11-21', enabled: true, stage: 'over' }
    )).toBeNull();
    expect(getBudgetWarningMessage(
      { dayKey: '2026-11-21', enabled: false, stage: null },
      { dayKey: '2026-11-21', enabled: true, stage: 'over' }
    )).toBeNull();
  });
});
