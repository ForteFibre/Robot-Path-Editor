import { deserializeWorkspace } from '../../io/workspaceCodec';
import { loadLinkedFileHandle } from '../../io/workspaceFileLinkPersistence';
import { loadWorkspacePersistence } from '../../io/workspacePersistence';
import type { WorkspacePersistenceBootstrapResult } from './types';

const loadLinkedWorkspaceCandidate = async (): Promise<
  | {
      kind: 'loaded';
      linkedFile: Awaited<ReturnType<typeof deserializeWorkspace>>;
      linkedFileModifiedAt: number;
      linkedFileName: string;
    }
  | {
      kind: 'missing';
    }
  | {
      kind: 'unreadable';
      linkedFileName: string;
    }
> => {
  const linkedRecord = await loadLinkedFileHandle();

  if (linkedRecord === null) {
    return {
      kind: 'missing',
    };
  }

  try {
    const linkedFile = await linkedRecord.handle.getFile();

    return {
      kind: 'loaded',
      linkedFile: deserializeWorkspace(await linkedFile.text()),
      linkedFileModifiedAt: linkedFile.lastModified,
      linkedFileName: linkedRecord.handle.name,
    };
  } catch {
    return {
      kind: 'unreadable',
      linkedFileName: linkedRecord.handle.name,
    };
  }
};

export const bootstrapWorkspacePersistence =
  async (): Promise<WorkspacePersistenceBootstrapResult> => {
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

    if (linkedWorkspaceCandidate.kind === 'missing') {
      return {
        kind: 'autosave-only',
        autosave: autosaveResult.workspace,
        savedAt: autosaveResult.savedAt,
        linkedFileUnreadable: false,
        linkedFileName: null,
      } as const;
    }

    if (linkedWorkspaceCandidate.kind === 'unreadable') {
      return {
        kind: 'autosave-only',
        autosave: autosaveResult.workspace,
        savedAt: autosaveResult.savedAt,
        linkedFileUnreadable: true,
        linkedFileName: linkedWorkspaceCandidate.linkedFileName,
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
  };
