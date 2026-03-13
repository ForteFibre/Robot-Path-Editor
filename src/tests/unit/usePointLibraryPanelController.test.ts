import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppConfirmationProvider,
  useAppConfirmation,
} from '../../features/app-shell/AppConfirmationContext';
import { usePointLibraryPanelController } from '../../features/pointLibrary/usePointLibraryPanelController';

const { mockUsePointLibrary } = vi.hoisted(() => ({
  mockUsePointLibrary: vi.fn(),
}));

vi.mock('../../features/pointLibrary/usePointLibrary', () => ({
  usePointLibrary: mockUsePointLibrary,
}));

const defaultDraft = {
  name: '',
  x: null,
  y: null,
  robotHeading: null,
};

const createPointLibraryState = () => {
  return {
    createPoint: vi.fn(() => 'created-point-id'),
    defaultDraft,
    deletePoint: vi.fn(() => ({ kind: 'deleted' as const })),
    highlightedLibraryPointId: null,
    insertPointIntoPath: vi.fn(),
    items: [],
    selectPoint: vi.fn(),
    selectedLibraryPointId: null,
    togglePointLock: vi.fn(),
    updatePointItem: vi.fn(),
  };
};

const wrapper = ({ children }: { children: ReactNode }) => {
  return createElement(AppConfirmationProvider, null, children);
};

describe('usePointLibraryPanelController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePointLibrary.mockReturnValue(createPointLibraryState());
  });

  it('creates, updates, saves, and cancels the create draft', () => {
    const pointLibraryState = createPointLibraryState();
    mockUsePointLibrary.mockReturnValue(pointLibraryState);

    const { result } = renderHook(() => usePointLibraryPanelController(), {
      wrapper,
    });

    act(() => {
      result.current.startCreate();
    });

    expect(result.current.createDraft).toEqual(defaultDraft);

    act(() => {
      result.current.changeCreateDraft({
        name: 'Alpha',
        x: 1.2,
        y: 3.4,
      });
    });

    expect(result.current.createDraft).toEqual({
      name: 'Alpha',
      x: 1.2,
      y: 3.4,
      robotHeading: null,
    });

    act(() => {
      result.current.saveCreateDraft();
    });

    expect(pointLibraryState.createPoint).toHaveBeenCalledWith({
      name: 'Alpha',
      x: 1.2,
      y: 3.4,
      robotHeading: null,
    });
    expect(result.current.createDraft).toBeNull();

    act(() => {
      result.current.startCreate();
    });

    expect(result.current.createDraft).toEqual(defaultDraft);

    act(() => {
      result.current.cancelCreate();
    });

    expect(result.current.createDraft).toBeNull();
  });

  it('opens a confirmation before deleting a used library point', async () => {
    const deletePoint = vi
      .fn()
      .mockReturnValueOnce({
        kind: 'confirmation-required' as const,
        pointId: 'point-1',
        pointName: 'Alpha',
        usageCount: 2,
      })
      .mockReturnValueOnce({ kind: 'deleted' as const });

    mockUsePointLibrary.mockReturnValue({
      ...createPointLibraryState(),
      deletePoint,
    });

    const { result } = renderHook(
      () => ({
        confirmation: useAppConfirmation(),
        controller: usePointLibraryPanelController(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.controller.deletePoint('point-1');
    });

    expect(deletePoint).toHaveBeenCalledWith('point-1');
    expect(result.current.confirmation.request?.title).toBe(
      'ライブラリポイントを削除しますか？',
    );

    await act(async () => {
      await result.current.confirmation.request?.onConfirm();
    });

    expect(deletePoint).toHaveBeenNthCalledWith(2, 'point-1', {
      force: true,
    });
  });
});
