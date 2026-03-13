import type { AppError } from './appError';

export const toAppErrorMessage = (error: AppError): string => {
  switch (error.kind) {
    case 'workspace-import':
      switch (error.reason) {
        case 'read-failed':
          return 'JSONの読み込みに失敗しました。';
        case 'invalid-format':
          return 'JSONの読み込みに失敗しました。現行形式の workspace.json を選択してください。';
        case 'apply-failed':
          return 'ワークスペースの読み込みに失敗しました。';
        case 'persist-failed':
          return '読み込んだワークスペースの保存に失敗しました。';
      }
      break;
    case 'workspace-export':
      switch (error.reason) {
        case 'write-failed':
          return 'JSONの書き込みに失敗しました。';
        case 'permission-denied':
          return 'JSONの書き込みに失敗しました。（アクセスが拒否されました）';
      }
      break;
    case 'workspace-restore':
      switch (error.reason) {
        case 'read-failed':
          return '保存されたワークスペースの読み込みに失敗しました。';
        case 'apply-failed':
          return '保存されたワークスペースの復元に失敗しました。';
      }
      break;
    case 'workspace-reset':
      return '新しいワークスペースの開始に失敗しました。';
    case 'autosave':
      return '自動保存に失敗しました。';
    case 'csv-export':
      return 'CSVの書き込みに失敗しました。';
    case 'background-image':
      switch (error.reason) {
        case 'file-too-large':
          return '背景画像は 10 MB 以下のファイルを選択してください。';
        case 'image-too-large':
          return '背景画像の読み込みに失敗しました。総画素数が大きすぎるため、より小さい画像を選択してください。';
        case 'dimensions-too-large':
          return '背景画像の読み込みに失敗しました。幅または高さが大きすぎるため、より小さい画像を選択してください。';
        case 'unsupported-type':
          return '背景画像の読み込みに失敗しました。画像ファイルを選択してください。';
        case 'svg-disallowed':
          return '背景画像に SVG は使用できません。PNG / JPEG / WebP などの画像ファイルを選択してください。';
        case 'read-failed':
          return '背景画像ファイルの読み込みに失敗しました。';
        case 'invalid-dimensions':
          return '背景画像の読み込みに失敗しました。幅と高さが正しい画像ファイルを選択してください。';
        case 'invalid-format':
          return '背景画像の読み込みに失敗しました。対応した画像ファイルを選択してください。';
      }
  }
};
