import type { ReactNode } from 'react';
import styles from './FormField.module.css';

type FormFieldVariant = 'stack' | 'floating' | 'compact';

type FormFieldProps = Readonly<{
  label: ReactNode;
  children: ReactNode;
  variant?: FormFieldVariant;
  htmlFor?: string;
  trailing?: ReactNode;
  className?: string;
}>;

export function FormField({
  label,
  children,
  variant = 'stack',
  htmlFor,
  trailing,
  className,
}: FormFieldProps) {
  const rootClassName =
    className === undefined || className.length === 0
      ? `${styles.root} ${styles[variant]}`
      : `${styles.root} ${styles[variant]} ${className}`;

  return (
    <div className={rootClassName}>
      <div className={styles.labelRow}>
        {htmlFor !== undefined && htmlFor.length > 0 ? (
          <label className={styles.label} htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className={styles.label}>{label}</span>
        )}
        {trailing !== undefined && trailing !== null ? (
          <div className={styles.trailing}>{trailing}</div>
        ) : null}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
