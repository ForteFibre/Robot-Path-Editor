import { useEffect, useRef, type ReactNode, type ReactElement } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closable?: boolean;
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  closable = true,
}: ModalProps): ReactElement | null => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closable && e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Move focus into the dialog for keyboard accessibility
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? dialogRef.current)?.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closable, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onPointerDown={(e) => {
        if (closable && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        ref={dialogRef}
        className={styles.modal}
        open
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          {closable ? (
            <button
              type="button"
              className={styles.closeButton}
              data-ui-focus="primary"
              onClick={onClose}
              aria-label="close"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>
        <div className={styles.content}>{children}</div>
      </dialog>
    </div>
  );
};
