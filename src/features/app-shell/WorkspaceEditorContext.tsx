import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  computeWorkspaceDerivedState,
  selectWorkspaceDerivedInputs,
  type WorkspaceDerivedState,
} from '../../store/workspaceDerivedSelectors';
import { useWorkspaceStore } from '../../store/workspaceStore';

const WorkspaceEditorContext = createContext<WorkspaceDerivedState | null>(
  null,
);

type WorkspaceEditorProviderProps = {
  children: ReactNode;
};

const useWorkspaceDerivedValue = (): WorkspaceDerivedState => {
  const inputs = useWorkspaceStore(useShallow(selectWorkspaceDerivedInputs));

  return useMemo(() => computeWorkspaceDerivedState(inputs), [inputs]);
};

export const WorkspaceEditorProvider = ({
  children,
}: WorkspaceEditorProviderProps): ReactElement => {
  const derived = useWorkspaceDerivedValue();

  return (
    <WorkspaceEditorContext.Provider value={derived}>
      {children}
    </WorkspaceEditorContext.Provider>
  );
};

export const useWorkspaceEditorDerived = (): WorkspaceDerivedState => {
  const value = useContext(WorkspaceEditorContext);

  if (value === null) {
    throw new Error(
      'useWorkspaceEditorDerived must be used within WorkspaceEditorProvider.',
    );
  }

  return value;
};
