import { type ReactElement, type Ref } from 'react';
import { useActivePathId, usePaths } from '../../store/workspaceSelectors';
import { PointLibraryPanel } from '../pointLibrary/PointLibraryPanel';
import { SidebarPresenter } from './SidebarPresenter';
import { useSidebarActions } from './useSidebarActions';

type SidebarProps = {
  hostRef?: Ref<HTMLElement> | undefined;
};

export const Sidebar = ({ hostRef }: SidebarProps): ReactElement => {
  const {
    addPath,
    deletePath,
    duplicatePath,
    recolorPath,
    renamePath,
    setActivePath,
    togglePathVisible,
  } = useSidebarActions();
  const paths = usePaths();
  const activePathId = useActivePathId();

  return (
    <SidebarPresenter
      hostRef={hostRef}
      paths={paths}
      activePathId={activePathId}
      onAddPath={addPath}
      onDeletePath={deletePath}
      onDuplicatePath={duplicatePath}
      onRenamePath={renamePath}
      onRecolorPath={recolorPath}
      onSetActivePath={setActivePath}
      onTogglePathVisible={togglePathVisible}
      libraryPanel={<PointLibraryPanel />}
    />
  );
};
