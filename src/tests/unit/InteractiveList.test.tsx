import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  InteractiveList,
  type InteractiveListProps,
} from '../../components/common/InteractiveList';
import styles from '../../components/common/InteractiveList.module.css';

type NumberItem = {
  id: string;
  label: string;
};

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

const renderInteractiveList = (
  props: Partial<InteractiveListProps<NumberItem>>,
) => {
  return render(
    <InteractiveList
      items={[]}
      getKey={(item) => item.id}
      renderItem={(item) => <li>{item.label}</li>}
      {...props}
    />,
  );
};

describe('InteractiveList', () => {
  it('items が空のとき emptyState を表示する', () => {
    renderInteractiveList({ emptyState: '項目がありません' });

    expect(screen.getByText('項目がありません')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('items があるとき renderItem を呼ぶ', () => {
    const renderItem = vi.fn((item: NumberItem) => <li>{item.label}</li>);

    renderInteractiveList({
      items: [
        { id: 'one', label: 'One' },
        { id: 'two', label: 'Two' },
      ],
      renderItem,
    });

    expect(renderItem).toHaveBeenCalledTimes(2);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('className を list 要素に適用する', () => {
    renderInteractiveList({
      items: [{ id: 'one', label: 'One' }],
      className: 'custom-list-class',
    });

    expect(screen.getByRole('list')).toHaveClass(
      requireClassName(styles.list),
      'custom-list-class',
    );
  });
});
