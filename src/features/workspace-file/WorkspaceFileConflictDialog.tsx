import { type ReactElement } from 'react';
import { AlertTriangle, RefreshCw, Save, XCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  DialogActions,
  DialogSection,
  TwoColumnChoiceGrid,
} from '../../components/common/DialogBody';
import type { ConflictState } from '../persistence/types';
import {
  formatAbsoluteDateTime,
  formatTimestampLabel,
} from '../persistence/timeFormatting';
import styles from './WorkspaceFileConflictDialog.module.css';

type WorkspaceFileConflictDialogProps = {
  conflict: ConflictState | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirmOverwrite: () => void;
  onLoadLatestFromFile: () => void;
};

export const WorkspaceFileConflictDialog = ({
  conflict,
  isBusy,
  onCancel,
  onConfirmOverwrite,
  onLoadLatestFromFile,
}: WorkspaceFileConflictDialogProps): ReactElement | null => {
  if (conflict === null) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="ファイルの競合を解決しますか？"
      closable={false}
    >
      <DialogSection>
        <div className={styles.warning}>
          <AlertTriangle size={18} />
          <p>
            リンクされた JSON ファイル「{conflict.fileName}
            」が外部で更新されました。
            このまま保存すると、外部変更を上書きします。
          </p>
        </div>

        <TwoColumnChoiceGrid
          left={
            <div className={styles.timelineCard}>
              <span className={styles.timelineLabel}>
                最後に認識していた更新
              </span>
              <strong className={styles.timelineValue}>
                {formatTimestampLabel(conflict.lastKnownModifiedAt)}
              </strong>
              <span className={styles.timelineSubtext}>
                保存時刻: {formatAbsoluteDateTime(conflict.lastKnownModifiedAt)}
              </span>
            </div>
          }
          right={
            <div className={styles.timelineCard}>
              <span className={styles.timelineLabel}>
                現在のファイル更新時刻
              </span>
              <strong className={styles.timelineValue}>
                {formatTimestampLabel(conflict.linkedFileModifiedAt)}
              </strong>
              <span className={styles.timelineSubtext}>
                保存時刻:{' '}
                {formatAbsoluteDateTime(conflict.linkedFileModifiedAt)}
              </span>
            </div>
          }
        />

        <DialogActions>
          <Button
            variant="danger"
            style={{ width: '100%' }}
            onClick={onConfirmOverwrite}
            disabled={isBusy}
          >
            <Save size={16} />
            <span>上書きする</span>
          </Button>
          <Button
            variant="secondary"
            style={{ width: '100%' }}
            onClick={onLoadLatestFromFile}
            disabled={isBusy}
          >
            <RefreshCw size={16} />
            <span>ファイルの最新版を読み込む</span>
          </Button>
          <Button
            variant="ghost"
            style={{ width: '100%' }}
            onClick={onCancel}
            disabled={isBusy}
          >
            <XCircle size={16} />
            <span>キャンセル</span>
          </Button>
        </DialogActions>
      </DialogSection>
    </Modal>
  );
};
