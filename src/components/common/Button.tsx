import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Readonly<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} data-ui-focus="primary" {...rest}>
      {children}
    </button>
  );
}
