import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SNAP_SETTINGS } from '../../domain/snapSettings';
import { SNAP_SETTING_DEFINITIONS } from '../../domain/snapping';
import { SnapSettingsPanel } from '../../features/canvas/components/SnapSettingsPanel';

describe('SnapSettingsPanel', () => {
  it('isOpen=true で section と setting row を定義配列から描画する', () => {
    const onToggleSetting = vi.fn();

    render(
      <SnapSettingsPanel
        settings={DEFAULT_SNAP_SETTINGS}
        isOpen
        onToggleSetting={onToggleSetting}
        onToggleOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Snap Settings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Point' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Heading' }),
    ).toBeInTheDocument();

    SNAP_SETTING_DEFINITIONS.forEach((item, index) => {
      const checkbox = screen.getByRole('checkbox', { name: item.label });
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(onToggleSetting).toHaveBeenNthCalledWith(index + 1, item.key);
    });
  });

  it('toggle ボタンの aria-label を維持し、クリックで onToggleOpen を呼ぶ', () => {
    const onToggleOpen = vi.fn();

    render(
      <SnapSettingsPanel
        settings={DEFAULT_SNAP_SETTINGS}
        isOpen={false}
        onToggleSetting={vi.fn()}
        onToggleOpen={onToggleOpen}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'toggle snap settings panel',
    });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleButton);

    expect(onToggleOpen).toHaveBeenCalledTimes(1);
    for (const item of SNAP_SETTING_DEFINITIONS) {
      expect(screen.queryByRole('checkbox', { name: item.label })).toBeNull();
    }
  });
});
