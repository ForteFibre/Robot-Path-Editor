import { Fragment, type HTMLAttributes, type ReactNode } from 'react';
import styles from './InteractiveList.module.css';

export const interactiveListClasses = {
  item: styles.item,
  hoverActions: styles.hoverActions,
  hiddenUntilHover: styles.hiddenUntilHover,
  dimUntilHover: styles.dimUntilHover,
} as const;

export type InteractiveListProps<T> = Omit<
  HTMLAttributes<HTMLElement>,
  'children'
> & {
  as?: 'ul' | 'ol';
  items: T[];
  getKey: (item: T) => string;
  emptyState?: ReactNode;
  renderItem: (item: T, index: number) => ReactNode;
  itemClassName?: string;
};

export const InteractiveList = <T,>({
  as = 'ul',
  items,
  getKey,
  emptyState,
  renderItem,
  className,
  itemClassName,
  ...rest
}: InteractiveListProps<T>): ReactNode => {
  if (items.length === 0) {
    if (emptyState === undefined) {
      return null;
    }

    return <div className={styles.emptyState}>{emptyState}</div>;
  }

  const ListTag = as;
  const listClassName = [styles.list, className ?? '']
    .filter(Boolean)
    .join(' ');
  const wrappedItemClassName = [styles.item, itemClassName ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <ListTag className={listClassName} {...rest}>
      {items.map((item, index) => {
        const rendered = renderItem(item, index);
        const key = getKey(item);

        if (itemClassName === undefined) {
          return <Fragment key={key}>{rendered}</Fragment>;
        }

        return (
          <li key={key} className={wrappedItemClassName}>
            {rendered}
          </li>
        );
      })}
    </ListTag>
  );
};
