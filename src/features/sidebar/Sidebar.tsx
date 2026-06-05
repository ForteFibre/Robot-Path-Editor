import { memo, useMemo, type ReactElement, type Ref } from 'react';
import { useActivePathId, usePaths } from '../../store/workspaceSelectors';
import { PointLibraryPanel } from '../pointLibrary/PointLibraryPanel';
import { SidebarPresenter } from './SidebarPresenter';
import { sortPathsByDisplayName } from './sidebarPathList';
import { useSidebarActions } from './useSidebarActions';

type SidebarProps = {
  hostRef?: Ref<HTMLElement> | undefined;
};

const SidebarComponent = ({ hostRef }: SidebarProps): ReactElement => {
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

  const sortedPaths = useMemo(() => sortPathsByDisplayName(paths), [paths]);
  const libraryPanel = useMemo(() => <PointLibraryPanel />, []);

  return (
    <SidebarPresenter
      hostRef={hostRef}
      paths={sortedPaths}
      activePathId={activePathId}
      onAddPath={addPath}
      onDeletePath={deletePath}
      onDuplicatePath={duplicatePath}
      onRenamePath={renamePath}
      onRecolorPath={recolorPath}
      onSetActivePath={setActivePath}
      onTogglePathVisible={togglePathVisible}
      libraryPanel={libraryPanel}
    />
  );
};

export const Sidebar = memo(SidebarComponent);
