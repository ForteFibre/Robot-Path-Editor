import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '../../components/common/FormField';
import styles from '../../components/common/FormField.module.css';

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

describe('FormField', () => {
  it('variantごとのクラスを付与して描画できる', () => {
    const { container, rerender } = render(
      <FormField label="Stack">
        <input />
      </FormField>,
    );

    expect(container.firstElementChild).toHaveClass(
      requireClassName(styles.root),
      requireClassName(styles.stack),
    );

    rerender(
      <FormField label="Floating" variant="floating">
        <input />
      </FormField>,
    );

    expect(container.firstElementChild).toHaveClass(
      requireClassName(styles.floating),
    );

    rerender(
      <FormField label="Compact" variant="compact">
        <input />
      </FormField>,
    );

    expect(container.firstElementChild).toHaveClass(
      requireClassName(styles.compact),
    );
  });

  it('htmlForが指定されるとlabel-inputの関連付けができる', () => {
    render(
      <FormField label="Length" htmlFor="length-input">
        <input id="length-input" />
      </FormField>,
    );

    expect(screen.getByLabelText('Length')).toBe(
      screen.getByRole('textbox', { name: 'Length' }),
    );
  });

  it('trailingを表示できる', () => {
    render(
      <FormField label="Label" trailing={<button type="button">Reset</button>}>
        <input />
      </FormField>,
    );

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });
});
