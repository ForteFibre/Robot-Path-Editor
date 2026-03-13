import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapWorkspacePersistence } from '../../features/persistence/bootstrapWorkspacePersistence';
import { useWorkspacePersistenceBootstrap } from '../../features/persistence/useWorkspacePersistenceBootstrap';

vi.mock('../../features/persistence/bootstrapWorkspacePersistence', () => ({
  bootstrapWorkspacePersistence: vi.fn(),
}));

describe('useWorkspacePersistenceBootstrap', () => {
  const mockedBootstrapWorkspacePersistence = vi.mocked(
    bootstrapWorkspacePersistence,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads bootstrap state once per mounted hook instance and keeps the result across rerenders', async () => {
    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });

    const { result, rerender } = renderHook(() =>
      useWorkspacePersistenceBootstrap(),
    );

    expect(result.current.bootstrapResult).toBeNull();

    await waitFor(() => {
      expect(result.current.bootstrapResult).toEqual({ kind: 'no-restore' });
    });

    rerender();

    expect(mockedBootstrapWorkspacePersistence).toHaveBeenCalledTimes(1);
  });

  it('runs bootstrap again after the previous hook instance unmounts', async () => {
    mockedBootstrapWorkspacePersistence.mockResolvedValue({
      kind: 'no-restore',
    });

    const firstRender = renderHook(() => useWorkspacePersistenceBootstrap());

    await waitFor(() => {
      expect(firstRender.result.current.bootstrapResult).toEqual({
        kind: 'no-restore',
      });
    });

    firstRender.unmount();

    const secondRender = renderHook(() => useWorkspacePersistenceBootstrap());

    await waitFor(() => {
      expect(secondRender.result.current.bootstrapResult).toEqual({
        kind: 'no-restore',
      });
    });

    expect(mockedBootstrapWorkspacePersistence).toHaveBeenCalledTimes(2);
  });

  it('falls back to no-restore when bootstrap loading fails', async () => {
    mockedBootstrapWorkspacePersistence.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useWorkspacePersistenceBootstrap());

    await waitFor(() => {
      expect(result.current.bootstrapResult).toEqual({ kind: 'no-restore' });
    });
  });
});
