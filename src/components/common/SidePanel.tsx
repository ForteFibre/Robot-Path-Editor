import {
  forwardRef,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './SidePanel.module.css';

// ── SidePanel ──────────────────────────────────────────────────────────────

type SidePanelProps = HTMLAttributes<HTMLElement> & {
  side: 'left' | 'right';
};

export const SidePanel = forwardRef<HTMLElement, SidePanelProps>(
  ({ side, className, children, ...rest }, ref): ReactElement => {
    const cls = [
      styles.panel,
      side === 'left' ? styles.panelLeft : styles.panelRight,
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <aside ref={ref as Ref<HTMLElement>} className={cls} {...rest}>
        {children}
      </aside>
    );
  },
);
SidePanel.displayName = 'SidePanel';

// ── SidePanelSection ───────────────────────────────────────────────────────

type SidePanelSectionProps = Readonly<HTMLAttributes<HTMLElement>> & {
  title?: string;
  readonly headerActions?: ReactNode;
};

export function SidePanelSection({
  title,
  headerActions,
  className,
  children,
  ...rest
}: SidePanelSectionProps): ReactElement {
  const cls = [styles.section, className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={cls} {...rest}>
      {(title !== undefined || headerActions !== undefined) && (
        <div className={styles.sectionHeader}>
          {title !== undefined && (
            <h2 className={styles.sectionTitle}>{title}</h2>
          )}
          {headerActions}
        </div>
      )}
      {children}
    </section>
  );
}

// ── SidePanelCard ──────────────────────────────────────────────────────────

type SidePanelCardProps = LiHTMLAttributes<HTMLLIElement> & {
  active?: boolean;
};

export const SidePanelCard = forwardRef<HTMLLIElement, SidePanelCardProps>(
  ({ active = false, className, children, ...rest }, ref): ReactElement => {
    const cls = [styles.card, active ? styles.cardActive : '', className ?? '']
      .filter(Boolean)
      .join(' ');
    return (
      <li
        ref={ref}
        className={cls}
        data-selected={active ? 'true' : 'false'}
        {...rest}
      >
        {children}
      </li>
    );
  },
);
SidePanelCard.displayName = 'SidePanelCard';
