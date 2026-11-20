import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Category } from '@/db/types';
import { CategoryGrid } from '@/features/entry/components/CategoryGrid';

jest.mock('@/lib/haptics', () => ({ tapHaptic: jest.fn() }));

const active: Category = {
  id: 1,
  name: 'Food',
  icon: 'fast-food-outline',
  color: '#F59E0B',
  sortOrder: 0,
  isArchived: false,
  createdAt: 1,
};

describe('CategoryGrid', () => {
  test('renders active SQLite categories and excludes archived rows defensively', async () => {
    const onSelect = jest.fn();
    await render(
      <CategoryGrid
        categories={[active, { ...active, id: 2, name: 'Old', isArchived: true }]}
        error={null}
        isLoading={false}
        onRetry={jest.fn()}
        onSelect={onSelect}
      />
    );

    expect(screen.queryByRole('button', { name: 'Save as Old' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save as Food' }));
    expect(onSelect).toHaveBeenCalledWith(active);
  });

  test('offers retry after a load failure', async () => {
    const onRetry = jest.fn();
    await render(
      <CategoryGrid
        categories={[]}
        error="Could not load categories."
        isLoading={false}
        onRetry={onRetry}
        onSelect={jest.fn()}
      />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
