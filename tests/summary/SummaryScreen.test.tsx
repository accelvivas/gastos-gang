import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { SummaryScreen } from '@/features/summary/components/SummaryScreen';
import * as summaryData from '@/features/summary/summaryData';
import { notifyExpenseChange } from '@/lib/expenseChanges';
import { listActive } from '@/repositories/categoriesRepo';
import { create, remove, restore, update } from '@/repositories/expensesRepo';

import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]),
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

beforeEach(async () => {
  mockDb = await createTestDb();
  mockNavigate.mockClear();
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 10, 18, 12).getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
  mockDb.close();
});

test('shows empty, coherent error, and retry states', async () => {
  jest.spyOn(mockDb, 'getAllAsync').mockRejectedValueOnce(new Error('read failed'));
  await render(<SummaryScreen />);
  await screen.findByText('Hindi ma-load ang summary, boss. Try ulit.');
  expect(screen.queryByText('TOTAL DAMAGE')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('WALA PANG DAMAGE, BOSS!');
  expect(screen.getByText('No spending in either period')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log Gastos' }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('toggles periods, explores values, and refreshes after create, edit, delete and restore', async () => {
  const [food] = await listActive(mockDb);
  const older = new Date(2026, 10, 2, 12).getTime();
  const current = new Date(2026, 10, 16, 12).getTime();
  await create(mockDb, { amountCentavos: 500, categoryId: food!.id, createdAt: older });
  const { unmount } = await render(<SummaryScreen />);
  expect(screen.getByRole('radio', { name: 'This Week', checked: true })).toBeTruthy();
  await screen.findByText('WALA PANG DAMAGE, BOSS!');
  let expense = await create(mockDb, { amountCentavos: 750, categoryId: food!.id, createdAt: current });
  await act(() => notifyExpenseChange());
  const category = await screen.findByRole('button', { name: 'Food, ₱7.50, 100.0 percent of spending' });
  const layoutEvent = { nativeEvent: { layout: { width: 264, height: 200, x: 0, y: 0 } } };
  await fireEvent(screen.getByTestId('summary-category-chart', { includeHiddenElements: true }), 'layout', layoutEvent);
  await fireEvent(screen.getByTestId('summary-daily-chart', { includeHiddenElements: true }), 'layout', layoutEvent);
  expect(screen.getAllByText('TOTAL', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  expect(screen.getByText('Mon', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(category);
  expect(screen.getByText('Food · ₱7.50 · 100.0% of spending')).toBeTruthy();
  expect(screen.getByText('1 expense')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next spending day' }));
  expect(screen.getByText('0 expenses')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'This Month' }));
  await screen.findByRole('button', { name: 'Food, ₱12.50, 100.0 percent of spending' });
  await fireEvent(screen.getByTestId('summary-daily-chart', { includeHiddenElements: true }), 'layout', layoutEvent);
  expect(screen.getByText('15', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'This Month', checked: true })).toBeTruthy();
  expense = await update(mockDb, expense.id, { amountCentavos: 1000 });
  await act(() => notifyExpenseChange());
  await screen.findByRole('button', { name: 'Food, ₱15.00, 100.0 percent of spending' });
  const deleted = await remove(mockDb, expense.id);
  await act(() => notifyExpenseChange());
  await screen.findByRole('button', { name: 'Food, ₱5.00, 100.0 percent of spending' });
  await restore(mockDb, deleted);
  await act(() => notifyExpenseChange());
  await screen.findByRole('button', { name: 'Food, ₱15.00, 100.0 percent of spending' });
  await update(mockDb, expense.id, { createdAt: new Date(2026, 10, 10, 12).getTime() });
  await fireEvent.press(screen.getByRole('radio', { name: 'This Week' }));
  await screen.findByText('₱10.00 less (100.0%) vs last week');
  await unmount();
});

test('ignores an older query when switching rapidly back to Week', async () => {
  const load = summaryData.loadSpendingSummary;
  const month = await load(mockDb, 'month', '2026-11-18');
  let resolveMonth: (value: typeof month) => void = () => undefined;
  const pendingMonth = new Promise<typeof month>((resolve) => { resolveMonth = resolve; });
  const loader = jest.spyOn(summaryData, 'loadSpendingSummary').mockImplementation(
    (db, period, day) => period === 'month' ? pendingMonth : load(db, period, day)
  );
  await render(<SummaryScreen />);
  await screen.findByText('Nov 16 – Nov 18');
  await fireEvent.press(screen.getByRole('radio', { name: 'This Month' }));
  await waitFor(() => expect(loader).toHaveBeenCalledWith(
    mockDb, 'month', '2026-11-18', expect.any(Number)
  ));
  expect(screen.queryByText('Nov 16 – Nov 18')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'This Week' }));
  await screen.findByText('Nov 16 – Nov 18');
  await act(() => resolveMonth(month));
  expect(screen.getByText('Nov 16 – Nov 18')).toBeTruthy();
  expect(screen.queryByText('Nov 1 – Nov 18')).toBeNull();
});

test('recomputes local dates when the app resumes on the next day', async () => {
  const now = jest.spyOn(Date, 'now');
  let appListener: (state: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appListener = listener;
    return { remove: jest.fn() };
  });
  await render(<SummaryScreen />);
  await screen.findByText('Nov 16 – Nov 18');
  now.mockReturnValue(new Date(2026, 10, 19, 0, 1).getTime());
  await act(() => appListener('active'));
  await screen.findByText('Nov 16 – Nov 19');
  expect(screen.queryByText('Nov 16 – Nov 18')).toBeNull();
});

test('refreshes automatically when a future-dated expense becomes eligible', async () => {
  jest.useFakeTimers();
  const noon = new Date(2026, 10, 18, 12).getTime();
  const evening = new Date(2026, 10, 18, 21).getTime();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(noon);
  const [food] = await listActive(mockDb);
  await create(mockDb, { amountCentavos: 500, categoryId: food!.id, createdAt: evening });

  await render(<SummaryScreen />);
  await screen.findByText('WALA PANG DAMAGE, BOSS!');

  await act(async () => {
    now.mockReturnValue(evening);
    jest.advanceTimersByTime(evening - noon);
  });

  expect((await screen.findAllByText('₱5.00')).length).toBeGreaterThan(0);
  jest.useRealTimers();
});
