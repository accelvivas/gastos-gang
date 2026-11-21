import { Ionicons } from '@expo/vector-icons';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import type { Category, ExpenseWithCategory } from '@/db/types';
import { CategoryGrid } from '@/features/entry/components/CategoryGrid';
import { EditCategoryGrid } from '@/features/expense/components/EditCategoryGrid';
import { ExpenseRow } from '@/features/history/components/ExpenseRow';
import { listActive } from '@/repositories/categoriesRepo';
import { streetColors } from '@/theme/tokens';

import { createTestDb } from './helpers/testDb';

jest.mock('@/lib/haptics', () => ({ tapHaptic: jest.fn() }));

function glyph(name: string): string {
  const match = Object.entries(Ionicons.glyphMap).find(([key]) => key === name);
  if (!match) throw new Error(`Missing Ionicons glyph: ${name}`);
  return typeof match[1] === 'number' ? String.fromCodePoint(match[1]) : match[1];
}

const hiddenIcon = { includeHiddenElements: true };

test('renders every seeded SQLite icon on Entry and preserves the category press action', async () => {
  const db = await createTestDb();
  try {
    const categories = await listActive(db);
    expect(categories).toHaveLength(6);
    const onSelect = jest.fn();
    await render(
      <CategoryGrid categories={categories} error={null} isLoading={false} onRetry={jest.fn()} onSelect={onSelect} />
    );

    for (const category of categories) {
      const card = screen.getByRole('button', { name: `Save as ${category.name}` });
      expect(within(card).getByText(glyph(category.icon), hiddenIcon)).toBeTruthy();
      expect(within(card).queryByText(category.name[0]!, { exact: true })).toBeNull();
      await fireEvent.press(card);
      expect(onSelect).toHaveBeenLastCalledWith(category);
    }
    expect(screen.queryByText('•••')).toBeNull();
  } finally {
    db.close();
  }
});

test('uses a fallback for unsupported names and picks a contrasting foreground', async () => {
  await render(
    <>
      <CategoryIcon icon="toString" color="#161820" size={40} iconSize={23} />
      <CategoryIcon icon="cafe-outline" color="#FDE68A" size={40} iconSize={23} />
    </>
  );
  expect(screen.getByText(glyph('help-circle-outline'), hiddenIcon)).toHaveStyle({ color: streetColors.cream });
  expect(screen.getByText(glyph('cafe-outline'), hiddenIcon)).toHaveStyle({ color: streetColors.black });
});

const archived: Category = {
  id: 8, name: 'Coffee', icon: 'cafe-outline', color: '#374151',
  sortOrder: 0, isArchived: true, createdAt: 1,
};

test('displays an archived category’s saved icon in History and Edit', async () => {
  const expense: ExpenseWithCategory = {
    id: 9, amountCentavos: 12500, categoryId: archived.id, note: 'Latte',
    localDay: '2026-11-21', createdAt: 1, updatedAt: 1,
    categoryName: archived.name, categoryIcon: archived.icon, categoryColor: archived.color,
    categoryIsArchived: true,
  };
  const onPress = jest.fn();
  const onSelect = jest.fn();
  await render(
    <>
      <ExpenseRow expense={expense} onPress={onPress} />
      <EditCategoryGrid categories={[archived]} disabled={false} onSelect={onSelect} selectedId={archived.id} />
    </>
  );
  const row = screen.getByRole('button', { name: /Coffee, Archived category/ });
  const option = screen.getByRole('radio', { name: 'Coffee, archived', checked: true });
  for (const card of [row, option]) {
    expect(within(card).getByText(glyph(archived.icon), hiddenIcon)).toBeTruthy();
    expect(within(card).queryByText('C')).toBeNull();
  }
  await fireEvent.press(row);
  await fireEvent.press(option);
  expect(onPress).toHaveBeenCalledWith(expense);
  expect(onSelect).toHaveBeenCalledWith(archived.id);
});
