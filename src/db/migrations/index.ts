import { migrate001Init } from '@/db/migrations/001_init';
import { migrate002ExpenseQueryIndexes } from '@/db/migrations/002_expense_query_indexes';
import { migrate003AppSettings } from '@/db/migrations/003_app_settings';
import { migrate004Recurring } from '@/db/migrations/004_recurring';
import { migrate005RemoveRecurring } from '@/db/migrations/005_remove_recurring';

export type Migration = {
  version: number;
  name: string;
  up: typeof migrate001Init;
  userVersionStatement: string;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: migrate001Init,
    // PRAGMA assignments cannot use bind parameters, so each version statement is static code.
    userVersionStatement: 'PRAGMA user_version = 1;',
  },
  {
    version: 2,
    name: 'expense query indexes',
    up: migrate002ExpenseQueryIndexes,
    userVersionStatement: 'PRAGMA user_version = 2;',
  },
  {
    version: 3,
    name: 'application settings',
    up: migrate003AppSettings,
    userVersionStatement: 'PRAGMA user_version = 3;',
  },
  {
    version: 4,
    name: 'recurring expenses',
    up: migrate004Recurring,
    userVersionStatement: 'PRAGMA user_version = 4;',
  },
  {
    version: 5,
    name: 'remove recurring expenses',
    up: migrate005RemoveRecurring,
    userVersionStatement: 'PRAGMA user_version = 5;',
  },
];
