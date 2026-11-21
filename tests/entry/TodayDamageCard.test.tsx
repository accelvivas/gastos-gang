import { render, screen } from '@testing-library/react-native';

import { TodayDamageCard } from '@/features/entry/components/TodayDamageCard';
import { getDailyBudgetProgress } from '@/features/entry/utils/dailyBudget';

test('shows budget, percentage, and remaining amount using integer centavos', async () => {
  await render(
    <TodayDamageCard
      dayKey="2026-11-21"
      totalCentavos={35_000}
      budgetLimitCentavos={50_000}
      budgetProgress={getDailyBudgetProgress(35_000, 50_000)}
    />
  );

  expect(screen.getByText("TODAY'S DAMAGE")).toBeTruthy();
  expect(screen.getByText('DAILY BUDGET: ₱500.00')).toBeTruthy();
  expect(screen.getByText('70% USED')).toBeTruthy();
  expect(screen.getByText('₱150.00 remaining, bossing.')).toBeTruthy();
});

test('keeps over-budget percentage visible while capping the progress bar', async () => {
  await render(
    <TodayDamageCard
      dayKey="2026-11-21"
      totalCentavos={75_000}
      budgetLimitCentavos={50_000}
      budgetProgress={getDailyBudgetProgress(75_000, 50_000)}
    />
  );

  expect(screen.getByText('150% USED')).toBeTruthy();
  expect(screen.getByText('₱250.00 over budget, bossing.')).toBeTruthy();
});
