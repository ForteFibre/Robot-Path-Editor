import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SidePanel,
  SidePanelCard,
  SidePanelSection,
} from '../../components/common/SidePanel';
import styles from '../../components/common/SidePanel.module.css';

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

describe('SidePanel', () => {
  it('left side の panel を描画する', () => {
    const { container } = render(
      <SidePanel side="left">
        <div>Left content</div>
      </SidePanel>,
    );

    expect(container.querySelector('aside')).toHaveClass(
      requireClassName(styles.panel),
      requireClassName(styles.panelLeft),
    );
    expect(screen.getByText('Left content')).toBeInTheDocument();
  });

  it('right side の panel を描画する', () => {
    const { container } = render(
      <SidePanel side="right">
        <div>Right content</div>
      </SidePanel>,
    );

    expect(container.querySelector('aside')).toHaveClass(
      requireClassName(styles.panel),
      requireClassName(styles.panelRight),
    );
    expect(screen.getByText('Right content')).toBeInTheDocument();
  });
});

describe('SidePanelSection', () => {
  it('title を表示する', () => {
    render(
      <SidePanelSection title="Section title">
        <div>Section content</div>
      </SidePanelSection>,
    );

    expect(
      screen.getByRole('heading', { name: 'Section title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });
});

describe('SidePanelCard', () => {
  it('active のとき active スタイルを付与する', () => {
    const { container } = render(
      <ul>
        <SidePanelCard active>Card content</SidePanelCard>
      </ul>,
    );

    expect(container.querySelector('li')).toHaveClass(
      requireClassName(styles.card),
      requireClassName(styles.cardActive),
    );
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });
});
