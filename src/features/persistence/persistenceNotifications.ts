import { isAppError, type AppNotification } from '../../errors';
import type { WorkspacePersistenceBootstrapResult } from './types';

export type NotificationSetter = (notification: AppNotification | null) => void;

export const toRecoveredWorkspaceNotification = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): AppNotification | null => {
  if (bootstrapResult?.kind !== 'recovered') {
    return null;
  }

  switch (bootstrapResult.reason) {
    case 'corrupt':
      return {
        kind: 'info',
        message: '保存データが破損していたため自動削除して起動しました。',
      };
    case 'unsupported-format':
      return {
        kind: 'info',
        message:
          '保存データが現在の形式に対応していなかったため自動削除して起動しました。',
      };
    case 'unreadable':
      return {
        kind: 'info',
        message: '保存データを読み取れなかったため自動削除して起動しました。',
      };
    default:
      return {
        kind: 'info',
        message: '保存データを復旧できなかったため自動削除して起動しました。',
      };
  }
};

export const toLinkedFileUnreadableNotification = (
  bootstrapResult: WorkspacePersistenceBootstrapResult | null,
): AppNotification | null => {
  if (
    bootstrapResult?.kind !== 'autosave-only' ||
    !bootstrapResult.linkedFileUnreadable ||
    bootstrapResult.linkedFileName === null
  ) {
    return null;
  }

  return {
    kind: 'info',
    message: `前回リンクしたファイル「${bootstrapResult.linkedFileName}」を読み込めませんでした。自動保存データのみ復元できます。`,
  };
};

export const toJsonLoadedMessage = (fileName: string): string => {
  return `JSONを「${fileName}」から読み込みました。`;
};

export const notifyPersistenceError = (
  error: unknown,
  fallback: AppNotification,
  setNotification: NotificationSetter,
): void => {
  if (isAppError(error)) {
    setNotification({ kind: 'error', error: error.appError });
    return;
  }

  setNotification(fallback);
};
