import type { ReactNode } from 'react';
import styles from './DialogBody.module.css';

type DialogSectionProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function DialogSection({
  children,
  className,
}: Readonly<DialogSectionProps>) {
  return (
    <div className={`${styles.section} ${className ?? ''}`}>{children}</div>
  );
}

type DialogActionsProps = {
  readonly children: ReactNode;
  readonly direction?: 'row' | 'column';
};

export function DialogActions({
  children,
  direction = 'column',
}: Readonly<DialogActionsProps>) {
  return (
    <div
      className={`${styles.actions} ${direction === 'row' ? styles.actionsRow : ''}`}
    >
      {children}
    </div>
  );
}

type TwoColumnChoiceGridProps = {
  readonly left: ReactNode;
  readonly right: ReactNode;
};

export function TwoColumnChoiceGrid({
  left,
  right,
}: Readonly<TwoColumnChoiceGridProps>) {
  return (
    <div className={styles.twoColumnGrid}>
      <div className={styles.column}>{left}</div>
      <div className={styles.column}>{right}</div>
    </div>
  );
}
