import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PathModel } from '../../domain/models';
import { SidebarPresenter } from '../../features/sidebar/SidebarPresenter';
import type { ResizableSidebarState } from '../../features/app-shell/useResizableSidebar';
import type { ResizableSidebarSectionsState } from '../../features/sidebar/useResizableSidebarSections';

const makePath = (id: string, name: string): PathModel => ({
  id,
  name,
  color: '#ff0000',
  visible: true,
  waypoints: [],
  headingKeyframes: [],
  sectionRMin: [],
});

const makeResizeState = (): ResizableSidebarState => ({
  width: 320,
  minWidth: 240,
  maxWidth: 520,
  isResizing: false,
  onResizeStart: vi.fn(),
  onResizeKeyDown: vi.fn(),
});

const makeSectionResizeState = (): ResizableSidebarSectionsState => ({
  pathsHeight: 220,
  minPathsHeight: 120,
  maxPathsHeight: 520,
  isResizing: false,
  onResizeStart: vi.fn(),
  onResizeKeyDown: vi.fn(),
});

const defaultProps = {
  paths: [makePath('p1', 'Path 1'), makePath('p2', 'Path 2')],
  activePathId: 'p1',
  onAddPath: vi.fn(),
  onDeletePath: vi.fn(),
  onDuplicatePath: vi.fn(),
  onRenamePath: vi.fn(),
  onRecolorPath: vi.fn(),
  onSetActivePath: vi.fn(),
  onTogglePathVisible: vi.fn(),
  libraryPanel: <div data-testid="library-panel" />,
  resize: makeResizeState(),
  sectionResize: makeSectionResizeState(),
};

describe('SidebarPresenter', () => {
  it('renders path names', () => {
    render(<SidebarPresenter {...defaultProps} />);
    expect(screen.getByDisplayValue('Path 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Path 2')).toBeInTheDocument();
  });

  it('clicking add path button calls onAddPath', () => {
    const onAddPath = vi.fn();
    render(<SidebarPresenter {...defaultProps} onAddPath={onAddPath} />);
    fireEvent.click(screen.getByRole('button', { name: 'create new path' }));
    expect(onAddPath).toHaveBeenCalledOnce();
  });

  it('delete button is disabled when only one path exists', () => {
    render(
      <SidebarPresenter {...defaultProps} paths={[makePath('p1', 'Path 1')]} />,
    );
    expect(
      screen.getByRole('button', { name: 'delete Path 1' }),
    ).toBeDisabled();
  });

  it('delete button is enabled when multiple paths exist', () => {
    render(<SidebarPresenter {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'delete Path 1' }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'delete Path 2' }),
    ).not.toBeDisabled();
  });

  it('clicking delete calls onDeletePath with the path id', () => {
    const onDeletePath = vi.fn();
    render(<SidebarPresenter {...defaultProps} onDeletePath={onDeletePath} />);
    fireEvent.click(screen.getByRole('button', { name: 'delete Path 2' }));
    expect(onDeletePath).toHaveBeenCalledWith('p2');
  });

  it('clicking visibility toggle calls onTogglePathVisible', () => {
    const onTogglePathVisible = vi.fn();
    render(
      <SidebarPresenter
        {...defaultProps}
        onTogglePathVisible={onTogglePathVisible}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'toggle visibility Path 1' }),
    );
    expect(onTogglePathVisible).toHaveBeenCalledWith('p1');
  });

  it('keeps a path in place while renaming and commits on blur', () => {
    const onRenamePath = vi.fn();
    render(<SidebarPresenter {...defaultProps} onRenamePath={onRenamePath} />);

    const input = screen.getByLabelText('rename Path 1');
    fireEvent.change(input, {
      target: { value: 'Renamed Path' },
    });
    expect(onRenamePath).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onRenamePath).toHaveBeenCalledWith('p1', 'Renamed Path');
  });

  it('commits path rename on Enter', () => {
    const onRenamePath = vi.fn();
    render(<SidebarPresenter {...defaultProps} onRenamePath={onRenamePath} />);

    const input = screen.getByLabelText('rename Path 1');
    fireEvent.change(input, {
      target: { value: 'Renamed Path' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenamePath).toHaveBeenCalledWith('p1', 'Renamed Path');
  });

  it('cancels path rename on Escape', () => {
    const onRenamePath = vi.fn();
    render(<SidebarPresenter {...defaultProps} onRenamePath={onRenamePath} />);

    const input = screen.getByLabelText('rename Path 1');
    fireEvent.change(input, {
      target: { value: 'Renamed Path' },
    });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRenamePath).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Path 1')).toBeInTheDocument();
  });

  it('renders the library panel slot', () => {
    render(<SidebarPresenter {...defaultProps} />);
    expect(screen.getByTestId('library-panel')).toBeInTheDocument();
  });

  it('renders a resize handle with current width metadata', () => {
    render(<SidebarPresenter {...defaultProps} />);

    const handle = screen.getByRole('slider', {
      name: 'resize editor sidebar',
    });
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuemin', '240');
    expect(handle).toHaveAttribute('aria-valuemax', '520');
    expect(handle).toHaveAttribute('aria-valuenow', '320');
  });

  it('forwards pointer and keyboard events from the resize handle', () => {
    const resize = makeResizeState();
    render(<SidebarPresenter {...defaultProps} resize={resize} />);

    const handle = screen.getByRole('slider', {
      name: 'resize editor sidebar',
    });
    fireEvent.pointerDown(handle, { button: 0, clientX: 320 });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(resize.onResizeStart).toHaveBeenCalledOnce();
    expect(resize.onResizeKeyDown).toHaveBeenCalledOnce();
  });

  it('renders a section resize handle with current paths height metadata', () => {
    render(<SidebarPresenter {...defaultProps} />);

    const handle = screen.getByRole('slider', {
      name: 'resize paths and library panels',
    });
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuemin', '120');
    expect(handle).toHaveAttribute('aria-valuemax', '520');
    expect(handle).toHaveAttribute('aria-valuenow', '220');
  });

  it('forwards pointer and keyboard events from the section resize handle', () => {
    const sectionResize = makeSectionResizeState();
    render(
      <SidebarPresenter {...defaultProps} sectionResize={sectionResize} />,
    );

    const handle = screen.getByRole('slider', {
      name: 'resize paths and library panels',
    });
    fireEvent.pointerDown(handle, { button: 0, clientY: 220 });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });

    expect(sectionResize.onResizeStart).toHaveBeenCalledOnce();
    expect(sectionResize.onResizeKeyDown).toHaveBeenCalledOnce();
  });
});
