export type BudgetStage = 'normal' | 'warning' | 'over';

export type DailyBudgetProgress = {
  stage: BudgetStage;
  percentageUsed: number;
  progress: number;
  remainingCentavos: number;
  overCentavos: number;
};

export function getDailyBudgetProgress(
  spentCentavos: number,
  budgetCentavos: number
): DailyBudgetProgress {
  if (
    !Number.isSafeInteger(spentCentavos) ||
    spentCentavos < 0 ||
    !Number.isSafeInteger(budgetCentavos) ||
    budgetCentavos <= 0
  ) {
    throw new RangeError('Spending and budget must be valid integer centavos.');
  }

  const stage: BudgetStage = BigInt(spentCentavos) >= BigInt(budgetCentavos)
    ? 'over'
    : BigInt(spentCentavos) * 5n >= BigInt(budgetCentavos) * 4n
      ? 'warning'
      : 'normal';
  return {
    stage,
    percentageUsed: Math.floor((spentCentavos / budgetCentavos) * 10_000) / 100,
    progress: Math.min(spentCentavos / budgetCentavos, 1),
    remainingCentavos: Math.max(budgetCentavos - spentCentavos, 0),
    overCentavos: Math.max(spentCentavos - budgetCentavos, 0),
  };
}

export function formatBudgetPercentage(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function crossedBudgetThreshold(
  previous: BudgetStage | null,
  next: BudgetStage
): boolean {
  if (previous === null) return false;
  const rank: Record<BudgetStage, number> = { normal: 0, warning: 1, over: 2 };
  return rank[next] > rank[previous];
}

export function getBudgetWarningMessage(
  previous: { dayKey: string; enabled: boolean; stage: BudgetStage | null } | null,
  next: { dayKey: string; enabled: boolean; stage: BudgetStage | null }
): string | null {
  if (
    !previous ||
    previous.dayKey !== next.dayKey ||
    !previous.enabled ||
    !next.enabled ||
    next.stage === null ||
    !crossedBudgetThreshold(previous.stage, next.stage)
  ) return null;

  return next.stage === 'over'
    ? 'Aray! Lagpas budget na tayo, bossing!'
    : 'Bossing, malapit na sa budget limit!';
}
