import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PointLibraryPanel } from '../../features/pointLibrary/PointLibraryPanel';
import panelStyles from '../../features/pointLibrary/PointLibraryPanel.module.css';
import type { LibraryPointDraft } from '../../features/pointLibrary/usePointLibrary';

const { mockUsePointLibraryPanelController } = vi.hoisted(() => ({
  mockUsePointLibraryPanelController: vi.fn(),
}));

vi.mock('../../features/pointLibrary/usePointLibraryPanelController', () => ({
  usePointLibraryPanelController: mockUsePointLibraryPanelController,
}));

type PointLibraryControllerState = {
  cancelCreate: () => void;
  changeCreateDraft: (patch: Partial<LibraryPointDraft>) => void;
  createDraft: LibraryPointDraft | null;
  deletePoint: (pointId: string) => void;
  highlightedLibraryPointId: string | null;
  insertPoint: (pointId: string) => void;
  items: {
    id: string;
    name: string;
    x: number;
    y: number;
    robotHeading: number | null;
    usageCount: number;
    isLocked: boolean;
  }[];
  saveCreateDraft: () => void;
  savePoint: (
    pointId: string,
    patch: Partial<{
      name: string;
      x: number;
      y: number;
      robotHeading: number | null;
    }>,
  ) => void;
  selectPoint: (pointId: string) => void;
  selectedLibraryPointId: string | null;
  startCreate: () => void;
  togglePointLock: (pointId: string) => void;
};

const requireClassName = (className: string | undefined): string => {
  if (className === undefined) {
    throw new Error('Expected CSS module class name to be defined.');
  }

  return className;
};

const createControllerState = (
  overrides: Partial<PointLibraryControllerState> = {},
): PointLibraryControllerState => {
  return {
    cancelCreate: vi.fn(),
    changeCreateDraft: vi.fn(),
    createDraft: null,
    deletePoint: vi.fn(),
    highlightedLibraryPointId: null,
    insertPoint: vi.fn(),
    items: [],
    saveCreateDraft: vi.fn(),
    savePoint: vi.fn(),
    selectPoint: vi.fn(),
    selectedLibraryPointId: null,
    startCreate: vi.fn(),
    togglePointLock: vi.fn(),
    ...overrides,
  };
};

describe('PointLibraryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('item がないときに empty state を表示する', () => {
    mockUsePointLibraryPanelController.mockReturnValue(createControllerState());

    render(<PointLibraryPanel />);

    expect(
      screen.getByText(
        'ライブラリポイントがまだありません。右上の＋ボタンから追加してください。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'library point list' }),
    ).not.toBeInTheDocument();
  });

  it('既存 item と create draft row に共通の item 枠クラスを適用する', () => {
    mockUsePointLibraryPanelController.mockReturnValue(
      createControllerState({
        createDraft: {
          name: '',
          x: null,
          y: null,
          robotHeading: null,
        },
        items: [
          {
            id: 'point-1',
            name: 'Alpha',
            x: 1,
            y: 2,
            robotHeading: 90,
            usageCount: 0,
            isLocked: false,
          },
        ],
      }),
    );

    render(<PointLibraryPanel />);

    const existingItem = screen.getByLabelText('library point Alpha');
    const createDraftRow = screen.getByLabelText('new library point draft');

    expect(existingItem).toHaveClass(requireClassName(panelStyles.item));
    expect(createDraftRow).toHaveClass(requireClassName(panelStyles.item));
  });

  it('new/create draft action の aria-label とイベントを維持する', () => {
    const controllerState = createControllerState({
      createDraft: {
        name: '',
        x: null,
        y: null,
        robotHeading: null,
      },
    });
    mockUsePointLibraryPanelController.mockReturnValue(controllerState);

    render(<PointLibraryPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'new library point' }));
    expect(controllerState.startCreate).toHaveBeenCalledTimes(1);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'library point name' }),
      {
        target: { value: 'Beta' },
      },
    );
    expect(controllerState.changeCreateDraft).toHaveBeenCalledWith({
      name: 'Beta',
    });

    fireEvent.click(screen.getByRole('button', { name: 'save library point' }));
    expect(controllerState.saveCreateDraft).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'cancel library point creation' }),
    );
    expect(controllerState.cancelCreate).toHaveBeenCalledTimes(1);
  });

  it('編集開始後も Edit/Lock/Delete ボタンが DOM 上で表示されていること', () => {
    mockUsePointLibraryPanelController.mockReturnValue(
      createControllerState({
        items: [
          {
            id: 'point-1',
            name: 'Alpha',
            x: 1,
            y: 2,
            robotHeading: 90,
            usageCount: 0,
            isLocked: false,
          },
        ],
      }),
    );

    render(<PointLibraryPanel />);

    // Initially elements should be in DOM
    const editButton = screen.getByRole('button', { name: 'edit Alpha' });
    const lockButton = screen.getByRole('button', {
      name: 'lock library point Alpha',
    });
    const deleteButton = screen.getByRole('button', { name: 'delete Alpha' });

    expect(editButton).toBeInTheDocument();
    expect(lockButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();

    // Start editing
    fireEvent.click(editButton);

    // Form should appear
    expect(
      screen.getByRole('textbox', { name: 'library point name' }),
    ).toBeInTheDocument();

    // The edit, lock, delete buttons must remain in the DOM without conditionally disappearing
    expect(
      screen.getByRole('button', { name: 'edit Alpha' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'lock library point Alpha' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'delete Alpha' }),
    ).toBeInTheDocument();
  });
});
