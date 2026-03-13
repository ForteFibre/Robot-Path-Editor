import { useRef, type ChangeEvent, type ReactElement } from 'react';
import { FileJson2, RotateCcw, Sparkles } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import {
  DialogActions,
  DialogSection,
  TwoColumnChoiceGrid,
} from '../../components/common/DialogBody';
import { Button } from '../../components/common/Button';
import type { WorkspacePersistenceRestoreCandidate } from './types';
import { formatAbsoluteDateTime, formatTimestampLabel } from './timeFormatting';
import styles from './WorkspaceRestoreDialog.module.css';

type WorkspaceRestoreDialogProps = {
  result: WorkspacePersistenceRestoreCandidate | null;
  isBusy: boolean;
  onStartFresh: () => void;
  onRestoreLastEdit: () => void;
  onRestoreLinkedFile: () => void;
  onLoadFromFile: (file: File) => Promise<void>;
};

export const WorkspaceRestoreDialog = ({
  result,
  isBusy,
  onStartFresh,
  onRestoreLastEdit,
  onRestoreLinkedFile,
  onLoadFromFile,
}: WorkspaceRestoreDialogProps): ReactElement | null => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (result === null) {
    return null;
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    void onLoadFromFile(file);
    event.target.value = '';
  };

  const leadText =
    result.kind === 'autosave-only'
      ? '前回保存されたワークスペースが見つかりました。続きから始めるか、空のワークスペースでやり直すかを選べます。'
      : '自動保存とリンクされた JSON ファイルの両方が見つかりました。再開したい状態を選んでください。';

  const restoreChoices =
    result.kind === 'conflict' ? (
      <TwoColumnChoiceGrid
        left={
          <button
            type="button"
            className={styles.restoreChoiceButton}
            data-ui-focus="primary"
            onClick={onRestoreLastEdit}
            disabled={isBusy}
            aria-label={`IndexedDBの自動保存を復元 (${formatAbsoluteDateTime(
              result.autoSavedAt,
            )})`}
          >
            <RotateCcw size={16} />
            <span className={styles.restoreChoiceTitle}>
              IndexedDBの自動保存を復元
            </span>
            <span className={styles.restoreChoiceValue}>
              {formatTimestampLabel(result.autoSavedAt)}
            </span>
            <span className={styles.restoreChoiceSubtext}>
              保存時刻: {formatAbsoluteDateTime(result.autoSavedAt)}
            </span>
          </button>
        }
        right={
          <button
            type="button"
            className={styles.restoreChoiceButton}
            data-ui-focus="primary"
            onClick={onRestoreLinkedFile}
            disabled={isBusy}
            aria-label={`リンクされたJSONファイルを読み込む (${formatAbsoluteDateTime(
              result.linkedFileModifiedAt,
            )})`}
          >
            <FileJson2 size={16} />
            <span className={styles.restoreChoiceTitle}>
              リンクされたJSONファイルを読み込む
            </span>
            <span className={styles.restoreChoiceValue}>
              {formatTimestampLabel(result.linkedFileModifiedAt)}
            </span>
            <span className={styles.restoreChoiceSubtext}>
              {result.linkedFileName} / 保存時刻:{' '}
              {formatAbsoluteDateTime(result.linkedFileModifiedAt)}
            </span>
          </button>
        }
      />
    ) : null;

  const savedMeta =
    result.kind === 'autosave-only' ? (
      <div className={styles.savedMeta}>
        <span className={styles.savedMetaLabel}>最後の保存</span>
        <span className={styles.savedMetaValue}>
          {formatTimestampLabel(result.savedAt)}
        </span>
        <span className={styles.savedMetaSubtext}>
          保存時刻: {formatAbsoluteDateTime(result.savedAt)}
        </span>
      </div>
    ) : (
      restoreChoices
    );

  const primaryActions =
    result.kind === 'autosave-only' ? (
      <DialogActions direction="row">
        <Button
          variant="secondary"
          style={{ flex: 1 }}
          onClick={onRestoreLastEdit}
          disabled={isBusy}
        >
          <RotateCcw size={16} />
          <span>最後の編集を復元</span>
        </Button>
        <Button
          variant="secondary"
          style={{ flex: 1 }}
          onClick={onStartFresh}
          disabled={isBusy}
        >
          <Sparkles size={16} />
          <span>新規で開始</span>
        </Button>
      </DialogActions>
    ) : (
      <Button
        variant="ghost"
        style={{ width: '100%' }}
        onClick={onStartFresh}
        disabled={isBusy}
      >
        <Sparkles size={16} />
        <span>新規で開始</span>
      </Button>
    );

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      title="前回の作業を復元しますか？"
      closable={false}
    >
      <DialogSection>
        <p className={styles.lead}>{leadText}</p>

        {savedMeta}

        <DialogActions>
          {primaryActions}

          <Button
            variant="ghost"
            style={{ width: '100%' }}
            onClick={() => {
              fileInputRef.current?.click();
            }}
            disabled={isBusy}
          >
            <FileJson2 size={16} />
            <span>ファイルを読み込む</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="visually-hidden"
            aria-label="復元する workspace json を選択"
          />
        </DialogActions>
      </DialogSection>
    </Modal>
  );
};
