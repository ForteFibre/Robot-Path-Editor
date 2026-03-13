import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceDocument } from '../../domain/workspaceContract';
import { serializeWorkspace } from '../../io/workspaceCodec';
import { toWorkspaceDocumentFromSource } from '../../store/adapters/workspacePersistence';
import { selectWorkspaceDocumentSource } from '../../store/workspaceSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';

type UseWorkspaceDocumentSerializationResult = {
  getWorkspaceDocument: () => WorkspaceDocument;
  getSerializedWorkspace: () => string;
};

export const useWorkspaceDocumentSerialization =
  (): UseWorkspaceDocumentSerializationResult => {
    const workspaceDocumentSource = useWorkspaceStore(
      useShallow(selectWorkspaceDocumentSource),
    );
    const workspaceDocumentRef = useRef(
      toWorkspaceDocumentFromSource(workspaceDocumentSource),
    );

    const syncWorkspaceDocument = useCallback(
      (source: typeof workspaceDocumentSource): void => {
        workspaceDocumentRef.current = toWorkspaceDocumentFromSource(source);
      },
      [],
    );

    useEffect(() => {
      syncWorkspaceDocument(workspaceDocumentSource);
    }, [syncWorkspaceDocument, workspaceDocumentSource]);

    useEffect(() => {
      const unsubscribe = useWorkspaceStore.subscribe((state) => {
        syncWorkspaceDocument(selectWorkspaceDocumentSource(state));
      });

      return () => {
        unsubscribe();
      };
    }, [syncWorkspaceDocument]);

    const getWorkspaceDocument = useCallback((): WorkspaceDocument => {
      return workspaceDocumentRef.current;
    }, []);

    const getSerializedWorkspace = useCallback((): string => {
      return serializeWorkspace(getWorkspaceDocument());
    }, [getWorkspaceDocument]);

    return {
      getWorkspaceDocument,
      getSerializedWorkspace,
    };
  };
