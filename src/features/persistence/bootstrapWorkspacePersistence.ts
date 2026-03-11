import { deserializeWorkspace } from '../../io/workspaceIO';
import { loadLinkedFileHandle } from '../../io/workspaceFileLinkPersistence';
import { loadWorkspacePersistence } from '../../io/workspacePersistence';
import type { WorkspacePersistenceBootstrapResult } from './types';

let bootstrapPromise: Promise<WorkspacePersistenceBootstrapResult> | null =
  null;

const loadLinkedWorkspaceCandidate = async (): Promise<{
  linkedFile: Awaited<ReturnType<typeof deserializeWorkspace>>;
  linkedFileModifiedAt: number;
  linkedFileName: string;
} | null> => {
  const linkedRecord = await loadLinkedFileHandle().catch(() => null);

  if (linkedRecord === null) {
    return null;
  }

  try {
    const linkedFile = await linkedRecord.handle.getFile();

    return {
      linkedFile: deserializeWorkspace(await linkedFile.text()),
      linkedFileModifiedAt: linkedFile.lastModified,
      linkedFileName: linkedRecord.handle.name,
    };
  } catch {
    return null;
  }
};

export const bootstrapWorkspacePersistence =
  (): Promise<WorkspacePersistenceBootstrapResult> => {
    if (bootstrapPromise !== null) {
      return bootstrapPromise;
    }

    const nextBootstrapPromise: Promise<WorkspacePersistenceBootstrapResult> =
      (async () => {
        const autosaveResult = await loadWorkspacePersistence();

        if (autosaveResult.kind === 'recovered') {
          return autosaveResult;
        }

        if (autosaveResult.kind !== 'loaded') {
          return {
            kind: 'no-restore',
          } as const;
        }

        const linkedWorkspaceCandidate = await loadLinkedWorkspaceCandidate();

        if (linkedWorkspaceCandidate === null) {
          return {
            kind: 'autosave-only',
            autosave: autosaveResult.workspace,
            savedAt: autosaveResult.savedAt,
          } as const;
        }

        return {
          kind: 'conflict',
          autosave: autosaveResult.workspace,
          autoSavedAt: autosaveResult.savedAt,
          linkedFile: linkedWorkspaceCandidate.linkedFile,
          linkedFileModifiedAt: linkedWorkspaceCandidate.linkedFileModifiedAt,
          linkedFileName: linkedWorkspaceCandidate.linkedFileName,
        } as const;
      })();

    const cachedBootstrapPromise = nextBootstrapPromise.catch(
      (error: unknown) => {
        bootstrapPromise = null;
        throw error;
      },
    );

    bootstrapPromise = cachedBootstrapPromise;

    return cachedBootstrapPromise;
  };

export const resetWorkspacePersistenceBootstrapForTests = (): void => {
  bootstrapPromise = null;
};
