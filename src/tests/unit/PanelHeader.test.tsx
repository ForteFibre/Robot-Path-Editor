import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelHeader } from '../../components/common/PanelHeader';
import styles from '../../components/common/PanelHeader.module.css';

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

describe('PanelHeader', () => {
  it('title/subtitle/icon/actions/children を描画できる', () => {
    const { container } = render(
      <PanelHeader
        title="Panel Title"
        subtitle="Panel Subtitle"
        icon={<span aria-label="header icon">★</span>}
        actions={<button type="button">Action</button>}
      >
        <span>Meta</span>
      </PanelHeader>,
    );

    expect(screen.getByText('Panel Title')).toBeInTheDocument();
    expect(screen.getByText('Panel Subtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('header icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root).toHaveClass(requireClassName(styles.root));
  });

  it('compact variant でタイトルのcompactクラスを付与する', () => {
    render(<PanelHeader title="Library" compact />);

    const heading = screen.getByRole('heading', { name: 'Library' });
    expect(heading).toHaveClass(
      requireClassName(styles.title),
      requireClassName(styles.titleCompact),
    );
  });

  it('divider=true で区切り線クラスを付与する', () => {
    const { container } = render(<PanelHeader title="Header" divider />);

    expect(container.firstElementChild).toHaveClass(
      requireClassName(styles.root),
      requireClassName(styles.divider),
    );
  });
});
