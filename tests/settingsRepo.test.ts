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

test('typed settings validate and store supported Phase 5 values', async () => {
  const db = await createTestDb();

  await expect(settingsRepo.setDailyBudget(db, true)).rejects.toThrow('Set a daily budget amount');
  await settingsRepo.setTyped(db, 'daily_budget_centavos', 50_000);
  await settingsRepo.setTyped(db, 'daily_budget_enabled', true);
  await settingsRepo.setTyped(db, 'theme_mode', 'system');

  await expect(settingsRepo.getTyped<boolean>(db, 'daily_budget_enabled')).resolves.toBe(true);
  await expect(settingsRepo.getTyped<number>(db, 'daily_budget_centavos')).resolves.toBe(50_000);
  await expect(settingsRepo.getTyped<settingsRepo.ThemeMode>(db, 'theme_mode')).resolves.toBe('system');

  await expect(settingsRepo.setTyped(db, 'daily_budget_centavos', 0)).rejects.toThrow();
  await expect(settingsRepo.setDailyBudget(db, false)).resolves.toEqual({
    enabled: false,
    limitCentavos: 50_000,
  });
  await expect(settingsRepo.getDailyBudget(db)).resolves.toEqual({
    enabled: false,
    limitCentavos: 50_000,
  });
  await expect(settingsRepo.setDailyBudget(db, true, Number.NaN)).rejects.toThrow();
  await expect(settingsRepo.setDailyBudget(db, true, Number.POSITIVE_INFINITY)).rejects.toThrow();
  await expect(settingsRepo.setDailyBudget(db, true, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow();
  db.close();
});
