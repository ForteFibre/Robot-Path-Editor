import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePointLibrary } from '../../features/pointLibrary/usePointLibrary';
import {
  resetWorkspaceStore,
  useWorkspaceStore,
} from '../../store/workspaceStore';

describe('usePointLibrary', () => {
  afterEach(() => {
    resetWorkspaceStore();
  });

  it('library items are ordered by gojuon', () => {
    act(() => {
      resetWorkspaceStore();

      useWorkspaceStore.getState().addLibraryPoint({
        name: 'さくら',
        x: 0,
        y: 0,
        robotHeading: null,
      });
      useWorkspaceStore.getState().addLibraryPoint({
        name: 'あお',
        x: 1,
        y: 1,
        robotHeading: null,
      });
      useWorkspaceStore.getState().addLibraryPoint({
        name: 'たんぽぽ',
        x: 2,
        y: 2,
        robotHeading: null,
      });
    });

    const { result } = renderHook(() => usePointLibrary());

    expect(result.current.items.map((item) => item.name)).toEqual([
      'あお',
      'さくら',
      'たんぽぽ',
    ]);
  });
});
