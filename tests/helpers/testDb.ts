import Database from 'better-sqlite3';
import type { SQLiteBindParams, SQLiteBindValue } from 'expo-sqlite';

import { initDatabase, type DbLike } from '@/db/client';

type TestBinding = string | number | null | Uint8Array;

function normalizeValue(value: SQLiteBindValue): TestBinding {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return value;
}

function normalizeParams(params: SQLiteBindParams | undefined): TestBinding[] | Record<string, TestBinding> {
  if (params === undefined) {
    return [];
  }
  if (Array.isArray(params)) {
    return params.map(normalizeValue);
  }
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, normalizeValue(value)])
  );
}

export class TestDb implements DbLike {
  private readonly database = new Database(':memory:');

  async execAsync(source: string): Promise<void> {
    this.database.exec(source);
  }

  async runAsync(source: string, params?: SQLiteBindParams) {
    const normalized = normalizeParams(params);
    const result = Array.isArray(normalized)
      ? this.database.prepare<TestBinding[]>(source).run(...normalized)
      : this.database.prepare<Record<string, TestBinding>>(source).run(normalized);
    return {
      changes: result.changes,
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(source: string, params?: SQLiteBindParams): Promise<T | null> {
    const normalized = normalizeParams(params);
    const row = Array.isArray(normalized)
      ? this.database.prepare<TestBinding[], T>(source).get(...normalized)
      : this.database.prepare<Record<string, TestBinding>, T>(source).get(normalized);
    return row ?? null;
  }

  async getAllAsync<T>(source: string, params?: SQLiteBindParams): Promise<T[]> {
    const normalized = normalizeParams(params);
    return Array.isArray(normalized)
      ? this.database.prepare<TestBinding[], T>(source).all(...normalized)
      : this.database.prepare<Record<string, TestBinding>, T>(source).all(normalized);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.runTransaction('BEGIN', task);
  }

  async withExclusiveTransactionAsync(task: (txn: DbLike) => Promise<void>): Promise<void> {
    await this.runTransaction('BEGIN EXCLUSIVE', () => task(this));
  }

  close(): void {
    this.database.close();
  }

  private async runTransaction(beginStatement: string, task: () => Promise<void>): Promise<void> {
    this.database.exec(beginStatement);
    try {
      await task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

export async function createTestDb(): Promise<TestDb> {
  const db = new TestDb();
  await initDatabase(db);
  return db;
}
