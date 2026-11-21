import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useEffect as mockUseEffect } from 'react';

import { DailyBudgetScreen } from '@/features/settings/components/DailyBudgetScreen';
import * as settingsRepo from '@/repositories/settingsRepo';
import { createTestDb, type TestDb } from '../helpers/testDb';

let mockDb: TestDb;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, [effect]),
}));

beforeEach(async () => {
  mockDb = await createTestDb();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});

afterEach(() => {
  jest.restoreAllMocks();
  mockDb.close();
});

test('saves a positive peso limit, enables budget tracking, and displays SQLite spending', async () => {
  await render(<DailyBudgetScreen onBack={jest.fn()} />);
  const amount = await screen.findByLabelText('Daily budget amount in pesos');
  await fireEvent.changeText(amount, '500');
  await fireEvent.press(screen.getByRole('button', { name: 'SAVE DAILY LIMIT' }));

  await waitFor(async () => {
    await expect(settingsRepo.getDailyBudget(mockDb)).resolves.toEqual({
      enabled: false,
      limitCentavos: 50_000,
    });
  });

  await fireEvent(screen.getByRole('switch', { name: 'Enable daily budget' }), 'valueChange', true);
  await waitFor(async () => {
    await expect(settingsRepo.getDailyBudget(mockDb)).resolves.toEqual({
      enabled: true,
      limitCentavos: 50_000,
    });
  });
  expect(await screen.findByText('TODAY\'S BUDGET STATUS')).toBeTruthy();
  expect(screen.getByText('₱500.00')).toBeTruthy();
});

test('rejects invalid budget text without persisting it', async () => {
  await render(<DailyBudgetScreen onBack={jest.fn()} />);
  await fireEvent.changeText(await screen.findByLabelText('Daily budget amount in pesos'), 'NaN');
  await fireEvent.press(screen.getByRole('button', { name: 'SAVE DAILY LIMIT' }));

  expect(await screen.findByText('Maglagay ng valid na budget na higit sa ₱0.00.')).toBeTruthy();
  await expect(settingsRepo.getDailyBudget(mockDb)).resolves.toEqual({
    enabled: false,
    limitCentavos: null,
  });
});
