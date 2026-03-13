import { AlertTriangle, CircleAlert } from 'lucide-react';
import { type ReactElement } from 'react';
import { Modal } from '../../components/common/Modal';
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

  return (
    <Modal
      isOpen
      onClose={() => {
        handleCancel().catch(() => undefined);
      }}
      title={title}
      closable={false}
    >
      <div className={styles.content}>
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

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => {
              handleCancel().catch(() => undefined);
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={[
              styles.confirmButton,
              tone === 'danger'
                ? styles.confirmButtonDanger
                : styles.confirmButtonDefault,
            ].join(' ')}
            onClick={() => {
              handleConfirm().catch(() => undefined);
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
