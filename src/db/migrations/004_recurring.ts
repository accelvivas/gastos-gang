import type { DbLike } from '@/db/client';

export async function migrate004Recurring(db: DbLike): Promise<void> {
  await db.execAsync(`
    CREATE TABLE recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      amount INTEGER NOT NULL CHECK (amount > 0),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
      start_day TEXT NOT NULL,
      end_day TEXT,
      due_time TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('automatic','reminder')),
      offsets INTEGER NOT NULL CHECK (offsets BETWEEN 0 AND 15),
      state TEXT NOT NULL CHECK (state IN ('active','paused','deleted')),
      cursor INTEGER NOT NULL DEFAULT 0 CHECK (cursor >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX recurring_schedule_state ON recurring_expenses(state, id);
    CREATE TABLE recurring_occurrences (
      schedule_id INTEGER NOT NULL REFERENCES recurring_expenses(id),
      due_day TEXT NOT NULL,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      amount INTEGER NOT NULL CHECK (amount > 0),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','skipped','auto')),
      expense_id INTEGER UNIQUE REFERENCES expenses(id) ON DELETE SET NULL,
      payment_day TEXT,
      recorded_amount INTEGER,
      snooze_day TEXT,
      snooze_time TEXT,
      PRIMARY KEY (schedule_id, due_day)
    );
    CREATE INDEX recurring_occurrence_status ON recurring_occurrences(status, due_day);
    CREATE INDEX recurring_occurrence_snooze ON recurring_occurrences(snooze_day) WHERE status='pending';
    CREATE TABLE recurring_notifications (
      id TEXT PRIMARY KEY,
      schedule_id INTEGER NOT NULL,
      due_day TEXT NOT NULL,
      fire_at INTEGER NOT NULL,
      FOREIGN KEY (schedule_id, due_day) REFERENCES recurring_occurrences(schedule_id, due_day)
        ON DELETE CASCADE
    );
    CREATE TABLE recurring_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
      preview INTEGER NOT NULL CHECK (preview IN (0,1)),
      due_time TEXT NOT NULL,
      offsets INTEGER NOT NULL CHECK (offsets BETWEEN 0 AND 15)
    );
    CREATE TABLE recurring_device (
      id INTEGER PRIMARY KEY CHECK (id = 1)
    );
    CREATE TRIGGER recurring_unlink_deleted_expense AFTER DELETE ON expenses
    BEGIN
      UPDATE recurring_occurrences SET expense_id = NULL WHERE expense_id = OLD.id;
    END;
  `);
}
