import type { WorkspaceAutosavePayload } from '../../domain/workspaceContract';
import {
  toWorkspaceAutosavePayloadFromSource,
  type WorkspaceAutosaveSource,
} from '../../store/adapters/workspacePersistence';

type SaveWorkspacePersistence = (
  workspace: WorkspaceAutosavePayload,
) => Promise<{ savedAt: number }>;

export const persistWorkspaceAutosaveSource = (
  source: WorkspaceAutosaveSource,
  saveWorkspaceFn: SaveWorkspacePersistence,
): Promise<{ savedAt: number }> => {
  return saveWorkspaceFn(toWorkspaceAutosavePayloadFromSource(source));
};
