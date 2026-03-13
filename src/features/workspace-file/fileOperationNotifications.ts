import type { AppNotification } from '../../errors';
import type { WorkspaceFileActionResult } from '../persistence/types';
import {
  notifyPersistenceError,
  toJsonLoadedMessage,
  type NotificationSetter,
} from '../persistence/persistenceNotifications';

const FILE_WRITE_PERMISSION_DENIED_MESSAGE =
  'ファイルへの書き込み権限がありません。';

const toJsonSavedMessage = (fileName: string): string => {
  return `JSONを「${fileName}」に保存しました。`;
};

const toJsonDownloadedMessage = (fileName: string): string => {
  return `${fileName} をダウンロードしました。`;
};

const toCsvDirectoryExportMessage = (
  writtenCount: number,
  directoryName: string,
): string => {
  return `CSVを ${writtenCount} ファイル、フォルダ「${directoryName}」に出力しました。`;
};

const toCsvDownloadExportMessage = (writtenCount: number): string => {
  return `CSVを ${writtenCount} ファイル出力しました。`;
};

export const toWorkspaceSaveSuccessNotification = (
  result: WorkspaceFileActionResult,
  isFileSystemAccessSupported: boolean,
): AppNotification => {
  return {
    kind: 'success',
    message: isFileSystemAccessSupported
      ? toJsonSavedMessage(result.fileName)
      : toJsonDownloadedMessage(result.fileName),
  };
};

export const toWorkspaceLoadSuccessNotification = (
  result: WorkspaceFileActionResult,
): AppNotification => {
  return {
    kind: 'success',
    message: toJsonLoadedMessage(result.fileName),
  };
};

export const toCsvDirectoryExportSuccessNotification = (params: {
  directoryName: string;
  writtenCount: number;
}): AppNotification => {
  return {
    kind: 'success',
    message: toCsvDirectoryExportMessage(
      params.writtenCount,
      params.directoryName,
    ),
  };
};

export const toCsvDownloadExportSuccessNotification = (
  writtenCount: number,
): AppNotification => {
  return {
    kind: 'success',
    message: toCsvDownloadExportMessage(writtenCount),
  };
};

export const notifyFileOperationError = (
  error: unknown,
  fallback: AppNotification,
  setNotification: NotificationSetter,
): void => {
  if (
    fallback.kind === 'error' &&
    error instanceof Error &&
    error.message === FILE_WRITE_PERMISSION_DENIED_MESSAGE
  ) {
    setNotification({
      kind: 'error',
      error: { kind: 'workspace-export', reason: 'permission-denied' },
    });
    return;
  }

  notifyPersistenceError(error, fallback, setNotification);
};
