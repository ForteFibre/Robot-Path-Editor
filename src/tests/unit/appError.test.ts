import { describe, expect, it } from 'vitest';
import {
  AppErrorInstance,
  isAppError,
  throwAppError,
  type AppError,
} from '../../errors/appError';
import { toAppErrorMessage } from '../../errors/appErrorPresenter';

describe('AppErrorInstance', () => {
  it('is an instance of Error', () => {
    const instance = new AppErrorInstance({
      kind: 'workspace-import',
      reason: 'invalid-format',
    });
    expect(instance).toBeInstanceOf(Error);
    expect(instance).toBeInstanceOf(AppErrorInstance);
  });

  it('carries the AppError payload', () => {
    const appError: AppError = {
      kind: 'workspace-export',
      reason: 'write-failed',
    };
    const instance = new AppErrorInstance(appError);
    expect(instance.appError).toEqual(appError);
  });

  it('has the correct name', () => {
    const instance = new AppErrorInstance({
      kind: 'autosave',
      reason: 'write-failed',
    });
    expect(instance.name).toBe('AppErrorInstance');
  });

  it('message contains kind and reason', () => {
    const instance = new AppErrorInstance({
      kind: 'csv-export',
      reason: 'write-failed',
    });
    expect(instance.message).toContain('csv-export');
    expect(instance.message).toContain('write-failed');
  });
});

describe('isAppError', () => {
  it('returns true for AppErrorInstance', () => {
    const instance = new AppErrorInstance({
      kind: 'workspace-reset',
      reason: 'persist-failed',
    });
    expect(isAppError(instance)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(
      isAppError({ kind: 'workspace-import', reason: 'invalid-format' }),
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAppError(undefined)).toBe(false);
  });
});

describe('throwAppError', () => {
  it('throws an AppErrorInstance', () => {
    expect(() => {
      throwAppError({ kind: 'workspace-restore', reason: 'read-failed' });
    }).toThrowError(AppErrorInstance);
  });

  it('thrown error carries the correct AppError payload', () => {
    try {
      throwAppError({ kind: 'workspace-import', reason: 'apply-failed' });
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) {
        expect(error.appError).toEqual({
          kind: 'workspace-import',
          reason: 'apply-failed',
        });
      }
    }
  });
});

describe('toAppErrorMessage', () => {
  it('workspace-import read-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-import',
      reason: 'read-failed',
    });
    expect(message).toContain('JSONの読み込みに失敗しました');
  });

  it('workspace-import invalid-format', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-import',
      reason: 'invalid-format',
    });
    expect(message).toContain('現行形式の workspace.json');
  });

  it('workspace-import apply-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-import',
      reason: 'apply-failed',
    });
    expect(message).toContain('ワークスペースの読み込みに失敗しました');
  });

  it('workspace-import persist-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-import',
      reason: 'persist-failed',
    });
    expect(message).toContain('保存に失敗しました');
  });

  it('workspace-export write-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-export',
      reason: 'write-failed',
    });
    expect(message).toContain('JSONの書き込みに失敗しました');
  });

  it('workspace-export permission-denied', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-export',
      reason: 'permission-denied',
    });
    expect(message).toContain('JSONの書き込みに失敗しました');
  });

  it('workspace-restore read-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-restore',
      reason: 'read-failed',
    });
    expect(message).toContain('失敗しました');
  });

  it('workspace-restore apply-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-restore',
      reason: 'apply-failed',
    });
    expect(message).toContain('復元に失敗しました');
  });

  it('workspace-reset persist-failed', () => {
    const message = toAppErrorMessage({
      kind: 'workspace-reset',
      reason: 'persist-failed',
    });
    expect(message).toContain('ワークスペースの開始に失敗しました');
  });

  it('autosave write-failed', () => {
    const message = toAppErrorMessage({
      kind: 'autosave',
      reason: 'write-failed',
    });
    expect(message).toContain('自動保存に失敗しました');
  });

  it('csv-export write-failed', () => {
    const message = toAppErrorMessage({
      kind: 'csv-export',
      reason: 'write-failed',
    });
    expect(message).toContain('CSVの書き込みに失敗しました');
  });

  it('background-image file-too-large', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'file-too-large',
    });
    expect(message).toContain('10 MB 以下');
  });

  it('background-image unsupported-type', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'unsupported-type',
    });
    expect(message).toContain('画像ファイルを選択してください');
  });

  it('background-image svg-disallowed', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'svg-disallowed',
    });
    expect(message).toContain('SVG は使用できません');
  });

  it('background-image read-failed', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'read-failed',
    });
    expect(message).toContain('背景画像ファイルの読み込みに失敗しました');
  });

  it('background-image invalid-format', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'invalid-format',
    });
    expect(message).toContain('対応した画像ファイルを選択してください');
  });

  it('background-image invalid-dimensions', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'invalid-dimensions',
    });
    expect(message).toContain('幅と高さが正しい画像ファイル');
  });

  it('background-image dimensions-too-large', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'dimensions-too-large',
    });
    expect(message).toContain('幅または高さが大きすぎる');
  });

  it('background-image image-too-large', () => {
    const message = toAppErrorMessage({
      kind: 'background-image',
      reason: 'image-too-large',
    });
    expect(message).toContain('総画素数が大きすぎる');
  });
});
