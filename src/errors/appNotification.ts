import type { AppError } from './appError';

export type AppNotification =
  | { kind: 'error'; error: AppError }
  | { kind: 'success'; message: string }
  | { kind: 'info'; message: string };
