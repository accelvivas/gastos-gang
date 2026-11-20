import * as settingsRepo from '@/repositories/settingsRepo';
import { createTestDb } from './helpers/testDb';

test('settings upsert and list values', async () => {
  const db = await createTestDb();
  await settingsRepo.set(db, 'theme', 'dark');
  await settingsRepo.set(db, 'theme', 'light');
  await settingsRepo.set(db, 'daily_budget_centavos', '50000');

  expect(await settingsRepo.get(db, 'theme')).toBe('light');
  expect(await settingsRepo.get(db, 'missing')).toBeNull();
  expect(await settingsRepo.getAll(db)).toEqual({
    daily_budget_centavos: '50000',
    theme: 'light',
  });
  db.close();
});
