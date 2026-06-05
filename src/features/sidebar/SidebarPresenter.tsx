import { memo, useCallback, useMemo, type ReactElement, type Ref } from 'react';
import { Plus } from 'lucide-react';
import type { PathModel } from '../../domain/models';
import { SidePanel, SidePanelSection } from '../../components/common/SidePanel';
import type { ResizableSidebarState } from '../app-shell/useResizableSidebar';
import type { ResizableSidebarSectionsState } from './useResizableSidebarSections';
import styles from './Sidebar.module.css';
import { Button } from '../../components/common/Button';
import { InteractiveList } from '../../components/common/InteractiveList';
import { SidebarPathItem } from './SidebarPathItem';

export type SidebarPresenterProps = {
  hostRef?: Ref<HTMLElement> | undefined;
  paths: PathModel[];
  activePathId: string;
  onAddPath: () => void;
  onDeletePath: (pathId: string) => void;
  onDuplicatePath: (pathId: string) => void;
  onRenamePath: (pathId: string, name: string) => void;
  onRecolorPath: (pathId: string, color: string) => void;
  onSetActivePath: (pathId: string) => void;
  onTogglePathVisible: (pathId: string) => void;
  libraryPanel: ReactElement;
  resize: ResizableSidebarState;
  sectionResize: ResizableSidebarSectionsState;
};

const SidebarPresenterComponent = ({
  hostRef,
  paths,
  activePathId,
  onAddPath,
  onDeletePath,
  onDuplicatePath,
  onRenamePath,
  onRecolorPath,
  onSetActivePath,
  onTogglePathVisible,
  libraryPanel,
  resize,
  sectionResize,
}: SidebarPresenterProps): ReactElement => {
  const getKey = useCallback((path: PathModel): string => path.id, []);
  const renderItem = useCallback(
    (path: PathModel): ReactElement => {
      return (
        <SidebarPathItem
          path={path}
          isActive={activePathId === path.id}
          canDelete={paths.length > 1}
          onDeletePath={onDeletePath}
          onDuplicatePath={onDuplicatePath}
          onRenamePath={onRenamePath}
          onRecolorPath={onRecolorPath}
          onSetActivePath={onSetActivePath}
          onTogglePathVisible={onTogglePathVisible}
        />
      );
    },
    [
      activePathId,
      onDeletePath,
      onDuplicatePath,
      onRecolorPath,
      onRenamePath,
      onSetActivePath,
      onTogglePathVisible,
      paths.length,
    ],
  );
  const headerActions = useMemo(() => {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddPath}
        aria-label="create new path"
      >
        <Plus size={16} /> New
      </Button>
    );
  }, [onAddPath]);

  return (
    <SidePanel side="left" ref={hostRef} aria-label="editor sidebar">
      <SidePanelSection
        title="Paths"
        headerActions={headerActions}
        className={styles.pathsSection}
        aria-label="path management"
        style={{ flexBasis: `${sectionResize.pathsHeight}px` }}
      >
        <InteractiveList
          items={paths}
          getKey={getKey}
          className={styles.pathsList}
          emptyState="パスがありません。New ボタンから追加してください。"
          renderItem={renderItem}
        />
      </SidePanelSection>

      <div
        className={[
          styles.sectionResizeHandle,
          sectionResize.isResizing ? styles.sectionResizeHandleActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="slider"
        aria-label="resize paths and library panels"
        aria-orientation="vertical"
        aria-valuemin={sectionResize.minPathsHeight}
        aria-valuemax={sectionResize.maxPathsHeight}
        aria-valuenow={sectionResize.pathsHeight}
        tabIndex={0}
        onPointerDown={sectionResize.onResizeStart}
        onKeyDown={sectionResize.onResizeKeyDown}
      />

      <SidePanelSection className={styles.librarySection}>
        {libraryPanel}
      </SidePanelSection>

      <div
        className={[
          styles.resizeHandle,
          resize.isResizing ? styles.resizeHandleActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="slider"
        aria-label="resize editor sidebar"
        aria-orientation="vertical"
        aria-valuemin={resize.minWidth}
        aria-valuemax={resize.maxWidth}
        aria-valuenow={resize.width}
        tabIndex={0}
        onPointerDown={resize.onResizeStart}
        onKeyDown={resize.onResizeKeyDown}
      />
    </SidePanel>
  );
};

export const SidebarPresenter = memo(SidebarPresenterComponent);
