export type AppError =
  | {
      kind: 'workspace-import';
      reason:
        | 'read-failed'
        | 'invalid-format'
        | 'apply-failed'
        | 'persist-failed';
    }
  | {
      kind: 'workspace-export';
      reason: 'write-failed' | 'permission-denied';
    }
  | {
      kind: 'workspace-restore';
      reason: 'read-failed' | 'apply-failed';
    }
  | {
      kind: 'workspace-reset';
      reason: 'persist-failed';
    }
  | {
      kind: 'autosave';
      reason: 'write-failed';
    }
  | {
      kind: 'csv-export';
      reason: 'write-failed';
    }
  | {
      kind: 'background-image';
      reason:
        | 'file-too-large'
        | 'image-too-large'
        | 'dimensions-too-large'
        | 'unsupported-type'
        | 'svg-disallowed'
        | 'read-failed'
        | 'invalid-dimensions'
        | 'invalid-format';
    };

export class AppErrorInstance extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(`${appError.kind}:${appError.reason}`);
    this.name = 'AppErrorInstance';
    this.appError = appError;
  }
}

export const throwAppError = (error: AppError): never => {
  throw new AppErrorInstance(error);
};

export const isAppError = (value: unknown): value is AppErrorInstance => {
  return value instanceof AppErrorInstance;
};
