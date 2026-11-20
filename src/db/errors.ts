export type AppErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONSTRAINT' | 'DB';

type AppErrorOptions = {
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = options.cause;
  }
}

export function isConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    code.startsWith('SQLITE_CONSTRAINT') ||
    message.includes('constraint') ||
    message.includes('unique')
  );
}

export function wrapDatabaseError(error: unknown, message: string): never {
  if (error instanceof AppError) {
    throw error;
  }

  throw new AppError('DB', message, { cause: error });
}
