import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../../components/common/Button';
import styles from '../../components/common/Button.module.css';

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

describe('Button', () => {
  it('デフォルトで ghost variant を使う', () => {
    render(<Button>Ghost</Button>);

    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass(
      requireClassName(styles.btn),
      requireClassName(styles.ghost),
    );
  });

  it('primary variant のクラスを付与する', () => {
    render(<Button variant="primary">Primary</Button>);

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      requireClassName(styles.primary),
    );
  });

  it('danger variant の外観クラスを付与する', () => {
    render(<Button variant="danger">Delete</Button>);

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      requireClassName(styles.danger),
    );
  });

  it('size=sm と size=lg のクラスを切り替える', () => {
    const { rerender } = render(<Button size="sm">Sized</Button>);

    expect(screen.getByRole('button', { name: 'Sized' })).toHaveClass(
      requireClassName(styles.sm),
    );

    rerender(<Button size="lg">Sized</Button>);

    expect(screen.getByRole('button', { name: 'Sized' })).toHaveClass(
      requireClassName(styles.lg),
    );
  });

  it('disabled を button 要素へ渡す', () => {
    render(<Button disabled>Disabled</Button>);

    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  it('type を省略したとき button をデフォルトにする', () => {
    render(<Button>Default Type</Button>);

    expect(
      screen.getByRole('button', { name: 'Default Type' }),
    ).toHaveAttribute('type', 'button');
  });

  it('明示した type でデフォルトを上書きできる', () => {
    render(<Button type="submit">Submit</Button>);

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute(
      'type',
      'submit',
    );
  });
});
