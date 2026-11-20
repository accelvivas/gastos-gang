import { migrate001Init } from '@/db/migrations/001_init';

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
];
