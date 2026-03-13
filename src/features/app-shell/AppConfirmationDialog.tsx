import { AlertTriangle, CircleAlert } from 'lucide-react';
import { type ReactElement } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import {
  DialogActions,
  DialogSection,
} from '../../components/common/DialogBody';
import { useAppConfirmation } from './AppConfirmationContext';
import styles from './AppConfirmationDialog.module.css';

export const AppConfirmationDialog = (): ReactElement | null => {
  const { request, closeConfirmation } = useAppConfirmation();

  if (request === null) {
    return null;
  }

  const {
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel = 'キャンセル',
    tone = 'default',
    onConfirm,
    onCancel,
  } = request;

  const handleCancel = async (): Promise<void> => {
    closeConfirmation();
    await onCancel?.();
  };

  const handleConfirm = async (): Promise<void> => {
    closeConfirmation();
    await onConfirm();
  };

  const Icon = tone === 'danger' ? AlertTriangle : CircleAlert;
  const sectionClassName: string = styles.section ?? '';

  return (
    <Modal
      isOpen
      onClose={() => {
        handleCancel().catch(() => undefined);
      }}
      title={title}
      closable={false}
    >
      <DialogSection className={sectionClassName}>
        <div className={styles.messageRow}>
          <div
            className={[
              styles.iconBadge,
              tone === 'danger' ? styles.iconBadgeDanger : styles.iconBadgeInfo,
            ].join(' ')}
          >
            <Icon size={18} />
          </div>
          <div className={styles.message}>{message}</div>
        </div>

        <DialogActions direction="row">
          <Button
            variant="ghost"
            onClick={() => {
              handleCancel().catch(() => undefined);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              handleConfirm().catch(() => undefined);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogSection>
    </Modal>
  );
};
