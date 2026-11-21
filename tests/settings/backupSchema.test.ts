import {
  BACKUP_FORMAT,
  MAX_BACKUP_CATEGORIES,
  MAX_BACKUP_FILE_BYTES,
  parseBackupJson,
  serializeBackup,
  validateBackup,
} from '@/features/settings/utils/backupSchema';

function validBackup() {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    createdAt: '2026-11-21T06:30:00.000Z',
    appVersion: '1.2.3',
    data: {
      categories: [
        {
          id: 1,
          name: 'Food',
          icon: 'fast-food-outline',
          color: '#F59E0B',
          sortOrder: 0,
          isArchived: false,
          createdAt: 1_700_000_000_000,
        },
        {
          id: 2,
          name: 'Archived',
          icon: 'bus-outline',
          color: '#3B82F6',
          sortOrder: 1,
          isArchived: true,
          createdAt: 1_700_000_000_001,
        },
      ],
      expenses: [
        {
          id: 3,
          amountCentavos: 123_456,
          categoryId: 2,
          note: 'Tara, kain! 🇵🇭',
          createdAt: 2_000_000_000_000,
          localDay: '2033-05-18',
          updatedAt: 2_000_000_000_001,
        },
      ],
      settings: [
        { source: 'app_settings', key: 'daily_budget_enabled', value: 'true', updatedAt: 10 },
        { source: 'app_settings', key: 'daily_budget_centavos', value: '50000', updatedAt: 11 },
        { source: 'app_settings', key: 'theme_mode', value: 'system', updatedAt: 12 },
        { source: 'settings', key: 'legacy_option', value: 'preserved', updatedAt: null },
      ],
    },
  };
}

describe('versioned backup validation', () => {
  test('accepts archived and future expenses with exact settings and Unicode', () => {
    const backup = validateBackup(validBackup());

    expect(backup.data.categories[1]?.isArchived).toBe(true);
    expect(backup.data.expenses[0]?.localDay).toBe('2033-05-18');
    expect(backup.data.expenses[0]?.note).toBe('Tara, kain! 🇵🇭');
    expect(backup.data.settings).toHaveLength(4);
  });

  test.each([
    ['unknown format', (value: ReturnType<typeof validBackup>) => { value.format = 'other'; }],
    ['unsupported schema', (value: ReturnType<typeof validBackup>) => { value.schemaVersion = 2; }],
    ['duplicate category IDs', (value: ReturnType<typeof validBackup>) => {
      value.data.categories[1]!.id = value.data.categories[0]!.id;
    }],
    ['duplicate expense IDs', (value: ReturnType<typeof validBackup>) => {
      value.data.expenses.push({ ...value.data.expenses[0]!, categoryId: 1 });
    }],
    ['orphaned expense', (value: ReturnType<typeof validBackup>) => {
      value.data.expenses[0]!.categoryId = 999;
    }],
    ['unsupported icon', (value: ReturnType<typeof validBackup>) => {
      value.data.categories[0]!.icon = 'not-an-ionicon';
    }],
    ['unsupported color', (value: ReturnType<typeof validBackup>) => {
      value.data.categories[0]!.color = '#123456';
    }],
    ['unsafe amount', (value: ReturnType<typeof validBackup>) => {
      value.data.expenses[0]!.amountCentavos = Number.MAX_SAFE_INTEGER + 1;
    }],
    ['invalid local day', (value: ReturnType<typeof validBackup>) => {
      value.data.expenses[0]!.localDay = '2033-02-30';
    }],
    ['invalid theme preference', (value: ReturnType<typeof validBackup>) => {
      value.data.settings[2]!.value = 'neon';
    }],
    ['enabled budget without a limit', (value: ReturnType<typeof validBackup>) => {
      value.data.settings = value.data.settings.filter((setting) => setting.key !== 'daily_budget_centavos');
    }],
  ])('rejects %s', (_label, mutate) => {
    const value = validBackup();
    mutate(value);
    expect(() => validateBackup(value)).toThrow();
  });

  test('rejects active names that conflict case-insensitively', () => {
    const value = validBackup();
    value.data.categories[1]!.isArchived = false;
    value.data.categories[1]!.name = 'fOOD';

    expect(() => validateBackup(value)).toThrow('Active category names must be unique');
  });

  test('matches SQLite NOCASE behavior for non-ASCII category names', () => {
    const value = validBackup();
    value.data.categories[0]!.name = 'Ä';
    value.data.categories[1]!.name = 'ä';
    value.data.categories[1]!.isArchived = false;

    expect(() => validateBackup(value)).not.toThrow();
  });

  test('rejects record counts beyond the supported size', () => {
    const value = validBackup();
    value.data.categories = Array.from({ length: MAX_BACKUP_CATEGORIES + 1 }, () => ({})) as typeof value.data.categories;

    expect(() => validateBackup(value)).toThrow('exceeds supported record limits');
  });

  test('parses a UTF-8 BOM and serializes only validated JSON within the file limit', () => {
    const value = validBackup();
    const { json, byteLength } = serializeBackup(value);

    expect(byteLength).toBeGreaterThan(0);
    expect(byteLength).toBeLessThanOrEqual(MAX_BACKUP_FILE_BYTES);
    expect(parseBackupJson(`\uFEFF${json}`)).toEqual(validateBackup(value));
    expect(() => parseBackupJson('{broken')).toThrow('invalid JSON');
  });
});
