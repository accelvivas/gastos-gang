import { fireEvent, render, screen } from '@testing-library/react-native';

import { CategoryManagementScreen } from '@/features/settings/components/CategoryManagementScreen';

const mockCategories = [
  {
    id: 1,
    name: 'Food',
    icon: 'fast-food-outline',
    color: '#F59E0B',
    sortOrder: 0,
    isArchived: false,
    createdAt: 1,
  },
  {
    id: 2,
    name: 'Old Shopping',
    icon: 'bag-handle-outline',
    color: '#EC4899',
    sortOrder: 1,
    isArchived: true,
    createdAt: 1,
  },
];

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));

jest.mock('@/repositories/categoriesRepo', () => {
  const actual = jest.requireActual('@/repositories/categoriesRepo');
  return {
    ...actual,
    listAll: jest.fn(async () => mockCategories),
    create: jest.fn(async () => mockCategories[0]),
    update: jest.fn(async () => mockCategories[0]),
    archive: jest.fn(async () => mockCategories[0]),
    unarchive: jest.fn(async () => mockCategories[1]),
    reorder: jest.fn(async () => mockCategories),
  };
});

test('renders active and archived category sections with add and edit controls', async () => {
  await render(<CategoryManagementScreen onBack={jest.fn()} />);

  expect(await screen.findByText('ACTIVE')).toBeTruthy();
  expect(screen.getByText('ARCHIVED')).toBeTruthy();
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('Old Shopping')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add category' })).toBeTruthy();
});

test('opens the category form and exposes icon and color choices', async () => {
  await render(<CategoryManagementScreen onBack={jest.fn()} />);
  await screen.findByText('ACTIVE');

  await fireEvent.press(screen.getByRole('button', { name: 'Add category' }));
  expect(screen.getByText('NEW CATEGORY')).toBeTruthy();
  expect(screen.getByLabelText('Category name')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'fast-food' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Color #F59E0B' })).toBeTruthy();
});
