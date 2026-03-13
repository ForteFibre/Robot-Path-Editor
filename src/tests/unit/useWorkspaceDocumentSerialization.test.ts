import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkspaceDocument } from '../../domain/workspaceContract';
import { useWorkspaceDocumentSerialization } from '../../features/persistence/useWorkspaceDocumentSerialization';
import { useWorkspaceStore } from '../../store/workspaceStore';

type SerializedWorkspaceSnapshot = {
  version: number;
  coordinateSystem: string;
  document: {
    backgroundImage: {
      url: string;
      scale: number;
    } | null;
    robotSettings: {
      length: number;
    };
  };
};

type WorkspaceDocumentSerializationResult = ReturnType<
  typeof useWorkspaceDocumentSerialization
>;

describe('useWorkspaceDocumentSerialization', () => {
  it('returns the latest workspace document snapshot after store updates', () => {
    const { result } = renderHook<
      WorkspaceDocumentSerializationResult,
      undefined
    >(() => useWorkspaceDocumentSerialization());

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ length: 9 });
      useWorkspaceStore.getState().setBackgroundImage({
        url: 'blob:background-image',
        width: 640,
        height: 480,
        x: 12,
        y: 18,
        scale: 1.1,
        alpha: 0.7,
      });
    });

    const workspaceDocument = result.current.getWorkspaceDocument();

    expect(workspaceDocument.robotSettings.length).toBe(9);
    expect(workspaceDocument.backgroundImage?.url).toBe(
      'blob:background-image',
    );
    expect(workspaceDocument.backgroundImage?.scale).toBe(1.1);
  });

  it('serializes the latest document even from a stale callback in the same tick', () => {
    const { result } = renderHook<
      WorkspaceDocumentSerializationResult,
      undefined
    >(() => useWorkspaceDocumentSerialization());

    const readWorkspaceDocument = (): WorkspaceDocument => {
      return (
        result.current as unknown as WorkspaceDocumentSerializationResult
      ).getWorkspaceDocument();
    };

    const readSerializedWorkspace = (): string => {
      return (
        result.current as unknown as WorkspaceDocumentSerializationResult
      ).getSerializedWorkspace();
    };

    let workspaceDocument = readWorkspaceDocument();
    let serializedWorkspace = readSerializedWorkspace();

    act(() => {
      useWorkspaceStore.getState().setRobotSettings({ length: 11 });
      useWorkspaceStore.getState().setBackgroundImage({
        url: 'blob:background-image-latest',
        width: 800,
        height: 600,
        x: 20,
        y: 24,
        scale: 1.4,
        alpha: 0.9,
      });
      workspaceDocument = readWorkspaceDocument();
      serializedWorkspace = readSerializedWorkspace();
    });

    const parsed = JSON.parse(
      serializedWorkspace,
    ) as SerializedWorkspaceSnapshot;

    expect(workspaceDocument.robotSettings.length).toBe(11);
    expect(workspaceDocument.backgroundImage?.url).toBe(
      'blob:background-image-latest',
    );
    expect(parsed.version).toBe(1);
    expect(parsed.coordinateSystem).toBe('ros-x-up-y-left');
    expect(parsed.document.robotSettings.length).toBe(11);
    expect(parsed.document.backgroundImage?.url).toBe(
      'blob:background-image-latest',
    );
  });
});
