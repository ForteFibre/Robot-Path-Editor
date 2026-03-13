import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceAutosavePayload,
  WorkspaceDocument,
} from '../../domain/workspaceContract';
import type { WorkspacePersistenceRestoreCandidate } from '../../features/persistence/types';
import { WorkspaceRestoreDialog } from '../../features/persistence/WorkspaceRestoreDialog';

const autosavePayload = {} as WorkspaceAutosavePayload;
const document = {} as WorkspaceDocument;

const autosaveOnlyResult: WorkspacePersistenceRestoreCandidate = {
  kind: 'autosave-only',
  autosave: autosavePayload,
  savedAt: Date.UTC(2026, 2, 10, 9, 30, 0),
  linkedFileUnreadable: false,
  linkedFileName: null,
};

const conflictResult: WorkspacePersistenceRestoreCandidate = {
  kind: 'conflict',
  autosave: autosavePayload,
  autoSavedAt: Date.UTC(2026, 2, 10, 9, 30, 0),
  linkedFile: document,
  linkedFileModifiedAt: Date.UTC(2026, 2, 10, 9, 45, 0),
  linkedFileName: 'linked-workspace.json',
};

type RenderOptions = {
  result: WorkspacePersistenceRestoreCandidate;
  isBusy?: boolean;
};

const renderDialog = ({ result, isBusy = false }: RenderOptions) => {
  const onStartFresh = vi.fn();
  const onRestoreLastEdit = vi.fn();
  const onRestoreLinkedFile = vi.fn();
  const onLoadFromFile = vi.fn(() => Promise.resolve());

  render(
    <WorkspaceRestoreDialog
      result={result}
      isBusy={isBusy}
      onStartFresh={onStartFresh}
      onRestoreLastEdit={onRestoreLastEdit}
      onRestoreLinkedFile={onRestoreLinkedFile}
      onLoadFromFile={onLoadFromFile}
    />,
  );

  return {
    onStartFresh,
    onRestoreLastEdit,
    onRestoreLinkedFile,
    onLoadFromFile,
  };
};

describe('WorkspaceRestoreDialog', () => {
  it('autosave-only モードの表示を行う', () => {
    renderDialog({ result: autosaveOnlyResult });

    expect(
      screen.getByRole('heading', { name: '前回の作業を復元しますか？' }),
    ).toBeInTheDocument();
    expect(screen.getByText('最後の保存')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '最後の編集を復元' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '新規で開始' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /リンクされたJSONファイルを読み込む/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('conflict モードの表示を行う', () => {
    renderDialog({ result: conflictResult });

    expect(
      screen.getByText(
        '自動保存とリンクされた JSON ファイルの両方が見つかりました。再開したい状態を選んでください。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /IndexedDBの自動保存を復元/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /リンクされたJSONファイルを読み込む/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/linked-workspace\.json/)).toBeInTheDocument();
  });

  it('busy 時は操作ボタンを disabled にする', () => {
    renderDialog({ result: conflictResult, isBusy: true });

    expect(
      screen.getByRole('button', { name: /IndexedDBの自動保存を復元/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: /リンクされたJSONファイルを読み込む/i,
      }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '新規で開始' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'ファイルを読み込む' }),
    ).toBeDisabled();
  });

  it('各ボタンとファイル入力の callback を呼び出す', () => {
    const {
      onStartFresh,
      onRestoreLastEdit,
      onRestoreLinkedFile,
      onLoadFromFile,
    } = renderDialog({ result: conflictResult });

    fireEvent.click(
      screen.getByRole('button', { name: /IndexedDBの自動保存を復元/i }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /リンクされたJSONファイルを読み込む/i,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '新規で開始' }));

    const file = new File(['{}'], 'workspace.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('復元する workspace json を選択'), {
      target: {
        files: [file],
      },
    });

    expect(onRestoreLastEdit).toHaveBeenCalledTimes(1);
    expect(onRestoreLinkedFile).toHaveBeenCalledTimes(1);
    expect(onStartFresh).toHaveBeenCalledTimes(1);
    expect(onLoadFromFile).toHaveBeenCalledWith(file);
  });
});
