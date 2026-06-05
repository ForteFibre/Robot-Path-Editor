import { memo, useMemo, type ReactElement, type Ref } from 'react';
import { useActivePathId, usePaths } from '../../store/workspaceSelectors';
import { PointLibraryPanel } from '../pointLibrary/PointLibraryPanel';
import type { ResizableSidebarState } from '../app-shell/useResizableSidebar';
import { SidebarPresenter } from './SidebarPresenter';
import { sortPathsByDisplayName } from './sidebarPathList';
import { useSidebarActions } from './useSidebarActions';
import { useResizableSidebarSections } from './useResizableSidebarSections';

type SidebarProps = {
  hostRef?: Ref<HTMLElement> | undefined;
  resize: ResizableSidebarState;
};

const SidebarComponent = ({ hostRef, resize }: SidebarProps): ReactElement => {
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
  const sectionResize = useResizableSidebarSections();

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
      resize={resize}
      sectionResize={sectionResize}
    />
  );
};

export const Sidebar = memo(SidebarComponent);
