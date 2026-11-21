import { fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryHeader } from '@/features/history/components/HistoryHeader';
import { HistoryEmptyState } from '@/features/history/components/HistoryEmptyState';
import { HistoryFilterSheet } from '@/features/history/components/HistoryFilterSheet';
import { historyRange } from '@/features/history/utils/historyFilters';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => undefined }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: () => null }));
jest.mock('@/repositories/categoriesRepo', () => ({
  listForHistory: jest.fn().mockResolvedValue([{ id: 4, name: 'Coffee', isArchived: true }]),
}));

test('shows the official logo and wordmark and exposes both History controls', async () => {
  const onSearch = jest.fn();
  const onFilter = jest.fn();
  await render(<HistoryHeader searchOpen={false} filterActive onSearch={onSearch} onFilter={onFilter} />);
  expect(screen.getByLabelText('Gastos Gang').props.source).toBeTruthy();
  expect(screen.getByRole('header', { name: 'GASTOS GANG.' }).props.numberOfLines).toBeUndefined();
  expect(screen.getByRole('header', { name: 'HISTORY' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Search expenses' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Filter expenses, filters active' }));
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onFilter).toHaveBeenCalledTimes(1);
});

test('offers to clear filters when nothing matches', async () => {
  const onClear = jest.fn();
  await render(<HistoryEmptyState onClear={onClear} />);
  await fireEvent.press(screen.getByRole('button', { name: 'CLEAR FILTERS' }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test('resolves a seven-day window across a month boundary', () => {
  expect(historyRange({ period: 'week', fromKey: '', toKey: '' }, '2026-11-03')).toEqual({
    fromKey: '2026-10-28', toKey: '2026-11-03',
  });
});

test('resets the filter draft and applies the cleared values', async () => {
  const onApply = jest.fn();
  await render(
    <HistoryFilterSheet
      initial={{ categoryId: 4, period: 'today', fromKey: '2026-11-21', toKey: '2026-11-21' }}
      onApply={onApply}
      onClose={jest.fn()}
    />
  );
  expect(await screen.findByRole('radio', { name: 'Coffee (archived)', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('radio', { name: 'All categories', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'All time', checked: true })).toBeTruthy();
  expect(onApply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ period: 'all' }), undefined);
});
