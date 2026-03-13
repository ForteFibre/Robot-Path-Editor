import type { ReactNode } from 'react';
import styles from './PanelHeader.module.css';

type PanelHeaderIconTone = 'neutral' | 'accent';

type PanelHeaderProps = Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  divider?: boolean;
  iconTone?: PanelHeaderIconTone;
  className?: string;
}>;

export function PanelHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
  compact = false,
  divider = false,
  iconTone = 'neutral',
  className,
}: PanelHeaderProps) {
  const rootClassName = [
    styles.root,
    compact ? styles.rootCompact : '',
    divider ? styles.divider : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const titleClassName = [styles.title, compact ? styles.titleCompact : '']
    .filter(Boolean)
    .join(' ');

  const iconClassName = [
    styles.icon,
    iconTone === 'accent' ? styles.iconAccent : styles.iconNeutral,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <div className={styles.main}>
        {icon !== undefined && icon !== null ? (
          <div className={iconClassName}>{icon}</div>
        ) : null}

        <div className={styles.content}>
          <h2 className={titleClassName}>{title}</h2>
          {subtitle !== undefined && subtitle !== null ? (
            <p className={styles.subtitle}>{subtitle}</p>
          ) : null}
          {children !== undefined && children !== null ? (
            <div className={styles.meta}>{children}</div>
          ) : null}
        </div>
      </div>

      {actions !== undefined && actions !== null ? (
        <div className={styles.actions}>{actions}</div>
      ) : null}
    </div>
  );
}
