import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarPresenter } from '../../features/toolbar/ToolbarPresenter';

const defaultProps = {
  mode: 'path' as const,
  tool: 'select' as const,
  canUndo: false,
  canRedo: false,
  onSelectPathMode: vi.fn(),
  onSelectHeadingMode: vi.fn(),
  onSelectTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  fileMenu: <div data-testid="file-menu" />,
  settingsMenu: <div data-testid="settings-menu" />,
};

describe('ToolbarPresenter', () => {
  describe('mode buttons aria-pressed', () => {
    it('path mode: path button is pressed, heading button is not', () => {
      render(<ToolbarPresenter {...defaultProps} mode="path" />);

      const pathBtn = screen.getByRole('button', { name: /path/i });
      const headingBtn = screen.getByRole('button', { name: /heading/i });

      expect(pathBtn).toHaveAttribute('aria-pressed', 'true');
      expect(headingBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('heading mode: heading button is pressed, path button is not', () => {
      render(<ToolbarPresenter {...defaultProps} mode="heading" />);

      const pathBtn = screen.getByRole('button', { name: /path/i });
      const headingBtn = screen.getByRole('button', { name: /heading/i });

      expect(pathBtn).toHaveAttribute('aria-pressed', 'false');
      expect(headingBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('tool buttons aria-pressed', () => {
    it('select tool: select button is pressed', () => {
      render(<ToolbarPresenter {...defaultProps} tool="select" />);

      expect(
        screen.getByRole('button', { name: 'tool select' }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: 'tool add point' }),
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('add-point tool: add-point button is pressed', () => {
      render(<ToolbarPresenter {...defaultProps} tool="add-point" />);

      expect(
        screen.getByRole('button', { name: 'tool select' }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(
        screen.getByRole('button', { name: 'tool add point' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('undo/redo disabled state', () => {
    it('undo is disabled when canUndo is false', () => {
      render(<ToolbarPresenter {...defaultProps} canUndo={false} />);
      expect(
        screen.getByRole('button', { name: 'undo workspace' }),
      ).toBeDisabled();
    });

    it('undo is enabled when canUndo is true', () => {
      render(<ToolbarPresenter {...defaultProps} canUndo={true} />);
      expect(
        screen.getByRole('button', { name: 'undo workspace' }),
      ).not.toBeDisabled();
    });

    it('redo is disabled when canRedo is false', () => {
      render(<ToolbarPresenter {...defaultProps} canRedo={false} />);
      expect(
        screen.getByRole('button', { name: 'redo workspace' }),
      ).toBeDisabled();
    });

    it('redo is enabled when canRedo is true', () => {
      render(<ToolbarPresenter {...defaultProps} canRedo={true} />);
      expect(
        screen.getByRole('button', { name: 'redo workspace' }),
      ).not.toBeDisabled();
    });
  });

  describe('callbacks', () => {
    it('clicking path mode button calls onSelectPathMode', () => {
      const onSelectPathMode = vi.fn();
      render(
        <ToolbarPresenter
          {...defaultProps}
          onSelectPathMode={onSelectPathMode}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^path$/i }));
      expect(onSelectPathMode).toHaveBeenCalledOnce();
    });

    it('clicking heading mode button calls onSelectHeadingMode', () => {
      const onSelectHeadingMode = vi.fn();
      render(
        <ToolbarPresenter
          {...defaultProps}
          onSelectHeadingMode={onSelectHeadingMode}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^heading$/i }));
      expect(onSelectHeadingMode).toHaveBeenCalledOnce();
    });

    it('clicking undo button calls onUndo', () => {
      const onUndo = vi.fn();
      render(
        <ToolbarPresenter {...defaultProps} canUndo={true} onUndo={onUndo} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'undo workspace' }));
      expect(onUndo).toHaveBeenCalledOnce();
    });

    it('clicking redo button calls onRedo', () => {
      const onRedo = vi.fn();
      render(
        <ToolbarPresenter {...defaultProps} canRedo={true} onRedo={onRedo} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'redo workspace' }));
      expect(onRedo).toHaveBeenCalledOnce();
    });

    it('clicking select tool calls onSelectTool with select', () => {
      const onSelectTool = vi.fn();
      render(
        <ToolbarPresenter
          {...defaultProps}
          tool="add-point"
          onSelectTool={onSelectTool}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'tool select' }));
      expect(onSelectTool).toHaveBeenCalledWith('select');
    });

    it('clicking add-point tool calls onSelectTool with add-point', () => {
      const onSelectTool = vi.fn();
      render(
        <ToolbarPresenter
          {...defaultProps}
          tool="select"
          onSelectTool={onSelectTool}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
      expect(onSelectTool).toHaveBeenCalledWith('add-point');
    });
  });
});
