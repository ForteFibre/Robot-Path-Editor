import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import { worldToScreen } from '../../domain/geometry';
import {
  discretizePathDetailed,
  resolveDiscretizedHeadingKeyframes,
} from '../../domain/interpolation';
import { resolveSectionRMin } from '../../domain/sectionRadius';
import { SECTION_R_MIN_INPUT_STEP } from '../../domain/metricScale';
import type {
  CanvasTransform,
  PathModel,
  Point,
  SelectionState,
} from '../../domain/models';
import { useWorkspaceActions } from '../../store/workspaceStore';
import {
  useCanvasTransform,
  useEditorTool,
  useLockedPointIds,
  usePoints,
  usePaths,
  useSelection,
} from '../../store/workspaceSelectors';
import type {
  HeadingKeyframeUpdatePatch,
  WaypointUpdatePatch,
} from '../../store/types';
import {
  Library,
  Link2Off,
  MapPin,
  RotateCcw,
  Route,
  Trash2,
} from 'lucide-react';
import { NumberInput } from '../../components/common/NumberInput';
import styles from './FloatingInspector.module.css';

type SectionSelection = {
  index: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  manualRMin: number | null;
  effectiveRMin: number;
  sliderMax: number;
};

type WaypointSelection = ReturnType<
  typeof resolvePathModel
>['waypoints'][number] & {
  interpolatedRobotHeading: number;
  linkedWaypointCount: number;
};

type HeadingKeyframeSelection = ReturnType<
  typeof resolveDiscretizedHeadingKeyframes
>[number];

type ResolvedPath = ReturnType<typeof resolvePathModel>;

const resolveSelectedPath = (
  resolvedPaths: ResolvedPath[],
  pathId: string | null,
): ResolvedPath | null => {
  if (pathId === null) {
    return null;
  }

  return resolvedPaths.find((path) => path.id === pathId) ?? null;
};

const resolveSelectedPathInput = (
  rawPaths: PathModel[],
  selectedPath: ResolvedPath | null,
  pathId: string | null,
): PathModel | ResolvedPath | null => {
  if (pathId === null) {
    return null;
  }

  return rawPaths.find((path) => path.id === pathId) ?? selectedPath;
};

const resolveSelectedDetail = (
  selectedPathInput: PathModel | ResolvedPath | null,
  points: Point[],
) => {
  if (selectedPathInput === null) {
    return null;
  }

  return discretizePathDetailed(selectedPathInput, points, 0.1);
};

const resolveWaypointSampleIndex = (
  detail: ReturnType<typeof discretizePathDetailed> | null,
  waypointIndex: number,
): number => {
  if (detail === null) {
    return -1;
  }

  if (waypointIndex <= 0) {
    return 0;
  }

  return (
    detail.sectionSampleRanges[waypointIndex - 1]?.endSampleIndex ??
    detail.samples.length - 1
  );
};

const countLinkedWaypoints = (
  paths: PathModel[],
  libraryPointId: string | null,
): number => {
  if (libraryPointId === null) {
    return 0;
  }

  return paths.reduce((count, path) => {
    return (
      count +
      path.waypoints.filter(
        (waypoint) => waypoint.libraryPointId === libraryPointId,
      ).length
    );
  }, 0);
};

const resolveSelectedWaypoint = (
  selectedPath: ResolvedPath | null,
  rawPaths: PathModel[],
  detail: ReturnType<typeof discretizePathDetailed> | null,
  waypointId: string | null,
): WaypointSelection | null => {
  if (selectedPath === null || waypointId === null) {
    return null;
  }

  const waypointIndex = selectedPath.waypoints.findIndex(
    (waypoint) => waypoint.id === waypointId,
  );
  const waypoint = selectedPath.waypoints[waypointIndex];
  if (waypoint === undefined) {
    return null;
  }

  const sampleIndex = resolveWaypointSampleIndex(detail, waypointIndex);
  const interpolatedSample =
    sampleIndex >= 0 && detail !== null
      ? detail.samples[sampleIndex]
      : undefined;

  return {
    ...waypoint,
    interpolatedRobotHeading:
      interpolatedSample?.robotHeading ?? waypoint.pathHeading,
    linkedWaypointCount: countLinkedWaypoints(
      rawPaths,
      waypoint.libraryPointId,
    ),
  };
};

const resolveSelectedHeadingKeyframe = (
  selectedPath: ResolvedPath | null,
  detail: ReturnType<typeof discretizePathDetailed> | null,
  headingKeyframeId: string | null,
): HeadingKeyframeSelection | null => {
  if (selectedPath === null || detail === null || headingKeyframeId === null) {
    return null;
  }

  return (
    resolveDiscretizedHeadingKeyframes(selectedPath, detail).find(
      (keyframe) => keyframe.id === headingKeyframeId,
    ) ?? null
  );
};

const resolveSelectedSection = (
  selectedPath: ResolvedPath | null,
  sectionIndex: number | null,
): SectionSelection | null => {
  if (selectedPath === null || sectionIndex === null) {
    return null;
  }

  const start = selectedPath.waypoints[sectionIndex];
  const end = selectedPath.waypoints[sectionIndex + 1];
  if (start === undefined || end === undefined) {
    return null;
  }

  const effectiveRMin = resolveSectionRMin(selectedPath, sectionIndex) ?? 1;

  return {
    index: sectionIndex,
    start,
    end,
    manualRMin: selectedPath.sectionRMin[sectionIndex] ?? null,
    effectiveRMin,
    sliderMax: Math.max(
      effectiveRMin,
      Math.hypot(end.x - start.x, end.y - start.y),
      1,
    ),
  };
};

const resolveSelection = (
  resolvedPaths: ResolvedPath[],
  rawPaths: PathModel[],
  points: Point[],
  selection: SelectionState,
): {
  selectedPath: ResolvedPath | null;
  selectedWaypoint: WaypointSelection | null;
  selectedHeadingKeyframe: HeadingKeyframeSelection | null;
  selectedSection: SectionSelection | null;
} => {
  const selectedPath = resolveSelectedPath(resolvedPaths, selection.pathId);
  const selectedPathInput = resolveSelectedPathInput(
    rawPaths,
    selectedPath,
    selection.pathId,
  );
  const selectedDetail = resolveSelectedDetail(selectedPathInput, points);
  const selectedWaypoint = resolveSelectedWaypoint(
    selectedPath,
    rawPaths,
    selectedDetail,
    selection.waypointId,
  );
  const selectedHeadingKeyframe = resolveSelectedHeadingKeyframe(
    selectedPath,
    selectedDetail,
    selection.headingKeyframeId,
  );
  const selectedSection = resolveSelectedSection(
    selectedPath,
    selection.sectionIndex,
  );

  return {
    selectedPath,
    selectedWaypoint,
    selectedHeadingKeyframe,
    selectedSection,
  };
};

const EMPTY_RESOLVED_SELECTION = {
  selectedPath: null,
  selectedWaypoint: null,
  selectedHeadingKeyframe: null,
  selectedSection: null,
};

const getPanelStyle = (
  canvasTransform: CanvasTransform,
  anchorWorld: { x: number; y: number } | null,
): CSSProperties => {
  if (anchorWorld === null) {
    return {};
  }

  const anchorScreen = worldToScreen(anchorWorld, canvasTransform);
  const sidebarWidth =
    document.querySelector<HTMLElement>('.sidebar')?.getBoundingClientRect()
      .width ?? 320;
  const appBodyWidth =
    document.querySelector<HTMLElement>('.app-body')?.getBoundingClientRect()
      .width ?? 1200;

  return {
    left: `${Math.min(Math.max(sidebarWidth + anchorScreen.x + 80, sidebarWidth + 8), appBodyWidth - 280)}px`,
    top: `${Math.max(anchorScreen.y - 120, 12)}px`,
    right: 'auto',
  };
};

const SectionPanel = ({
  style,
  path,
  section,
  pause,
  resume,
  setSectionRMin,
}: {
  style: CSSProperties;
  path: ReturnType<typeof resolvePathModel>;
  section: SectionSelection;
  pause: () => void;
  resume: () => void;
  setSectionRMin: (
    pathId: string,
    sectionIndex: number,
    rMin: number | null,
  ) => void;
}): ReactElement => {
  const isSliderPreviewActiveRef = useRef(false);
  const resolvedValue = section.manualRMin ?? section.effectiveRMin;

  const beginSliderPreview = useCallback(() => {
    if (isSliderPreviewActiveRef.current) {
      return;
    }

    isSliderPreviewActiveRef.current = true;
    pause();
  }, [pause]);

  const commitSliderPreview = useCallback(() => {
    if (!isSliderPreviewActiveRef.current) {
      return;
    }

    isSliderPreviewActiveRef.current = false;
    resume();
  }, [resume]);

  useEffect(() => {
    return () => {
      if (!isSliderPreviewActiveRef.current) {
        return;
      }

      isSliderPreviewActiveRef.current = false;
      resume();
    };
  }, [resume]);

  const handleSliderPointerDown = useCallback(
    (_event: PointerEvent<HTMLInputElement>) => {
      beginSliderPreview();
    },
    [beginSliderPreview],
  );

  const handleSliderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowDown' &&
        event.key !== 'Home' &&
        event.key !== 'End' &&
        event.key !== 'PageUp' &&
        event.key !== 'PageDown'
      ) {
        return;
      }

      beginSliderPreview();
    },
    [beginSliderPreview],
  );

  return (
    <section
      className={styles.floatingPanel}
      aria-label="floating inspector"
      style={style}
    >
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Route size={18} />
        </div>
        <div className={styles.headerInfo}>
          <h2>Section Inspector</h2>
          <p>
            {path.name} / Sect {section.index + 1}
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <span className={styles.fieldLabel}>Curve Radius (rMin)</span>
            {section.manualRMin === null ? null : (
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setSectionRMin(path.id, section.index, null);
                }}
                aria-label="reset section r min to auto"
              >
                <RotateCcw size={12} /> Auto
              </button>
            )}
          </div>
          <div className={styles.inputWrapper}>
            <NumberInput
              min={SECTION_R_MIN_INPUT_STEP}
              step={SECTION_R_MIN_INPUT_STEP}
              value={section.manualRMin}
              placeholder={`Auto (${section.effectiveRMin.toFixed(2)})`}
              onChange={(value) => {
                if (value === null) {
                  setSectionRMin(path.id, section.index, null);
                } else {
                  setSectionRMin(
                    path.id,
                    section.index,
                    Math.max(SECTION_R_MIN_INPUT_STEP, value),
                  );
                }
              }}
              aria-label="section r min"
            />
          </div>
        </div>

        <div className={styles.field}>
          <input
            type="range"
            min={SECTION_R_MIN_INPUT_STEP}
            max={section.sliderMax}
            step={SECTION_R_MIN_INPUT_STEP}
            value={resolvedValue}
            onPointerDown={handleSliderPointerDown}
            onPointerUp={commitSliderPreview}
            onPointerCancel={commitSliderPreview}
            onBlur={commitSliderPreview}
            onKeyDown={handleSliderKeyDown}
            onKeyUp={commitSliderPreview}
            onChange={(event) => {
              setSectionRMin(
                path.id,
                section.index,
                Math.max(SECTION_R_MIN_INPUT_STEP, Number(event.target.value)),
              );
            }}
            aria-label="section r min slider"
            className={styles.rangeInput}
          />
        </div>
      </div>
    </section>
  );
};

const WaypointPanel = ({
  style,
  path,
  waypoint,
  isLibraryPointLocked,
  setSelectedLibraryPointId,
  addLibraryPointFromSelection,
  deleteWaypoint,
  unlinkWaypointPoint,
  updateWaypoint,
}: {
  style: CSSProperties;
  path: ReturnType<typeof resolvePathModel>;
  waypoint: WaypointSelection;
  isLibraryPointLocked: boolean;
  setSelectedLibraryPointId: (pointId: string | null) => void;
  addLibraryPointFromSelection: () => string | null;
  deleteWaypoint: (pathId: string, waypointId: string) => void;
  unlinkWaypointPoint: (pathId: string, waypointId: string) => void;
  updateWaypoint: (
    pathId: string,
    waypointId: string,
    patch: WaypointUpdatePatch,
  ) => void;
}): ReactElement => {
  const isLibraryPoint = waypoint.libraryPoint !== null;

  return (
    <div
      className={styles.floatingPanel}
      aria-label="waypoint properties"
      style={style}
    >
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <MapPin size={18} />
        </div>
        <div className={styles.headerInfo}>
          <h2>Waypoint Inspector</h2>
          <p>
            {path.name} / {waypoint.name}
          </p>
        </div>
      </div>

      <div className={styles.section}>
        {isLibraryPoint ? (
          <div className={styles.linkedBlock}>
            <span className={styles.linkedLabel}>Linked Library</span>
            <button
              type="button"
              className={styles.linkedName}
              onClick={() => {
                if (waypoint.libraryPointId !== null) {
                  setSelectedLibraryPointId(waypoint.libraryPointId);
                }
              }}
              aria-label={`open linked library point ${waypoint.libraryPoint?.name ?? waypoint.name}`}
            >
              <Library size={14} />{' '}
              {waypoint.libraryPoint?.name ?? waypoint.name}
            </button>
          </div>
        ) : null}

        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <span className={styles.fieldLabel}>Name</span>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={waypoint.name}
                onChange={(event) => {
                  updateWaypoint(path.id, waypoint.id, {
                    name: event.target.value,
                  });
                }}
                aria-label="waypoint name"
                placeholder={waypoint.name}
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>X</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={waypoint.x}
                disabled={isLibraryPointLocked}
                onChange={(value) => {
                  if (value !== null) {
                    updateWaypoint(path.id, waypoint.id, { x: value });
                  }
                }}
                aria-label="waypoint x"
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Y</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={waypoint.y}
                disabled={isLibraryPointLocked}
                onChange={(value) => {
                  if (value !== null) {
                    updateWaypoint(path.id, waypoint.id, { y: value });
                  }
                }}
                aria-label="waypoint y"
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Heading</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={waypoint.pathHeading}
                onChange={(value) => {
                  if (value !== null) {
                    updateWaypoint(path.id, waypoint.id, {
                      pathHeading: value,
                    });
                  }
                }}
                aria-label="waypoint path heading"
              />
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>Robot H.</span>
              {waypoint.point.robotHeading === null ? null : (
                <button
                  type="button"
                  className={styles.resetBtn}
                  disabled={isLibraryPointLocked}
                  onClick={() => {
                    updateWaypoint(path.id, waypoint.id, {
                      robotHeading: null,
                    });
                  }}
                  aria-label="reset robot heading to auto"
                >
                  <RotateCcw size={12} /> Auto
                </button>
              )}
            </div>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={waypoint.point.robotHeading}
                placeholder={`Auto (${waypoint.interpolatedRobotHeading.toFixed(1)})`}
                disabled={isLibraryPointLocked}
                onChange={(value) => {
                  updateWaypoint(path.id, waypoint.id, { robotHeading: value });
                }}
                aria-label="waypoint robot heading"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        {isLibraryPoint ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              unlinkWaypointPoint(path.id, waypoint.id);
            }}
            aria-label="unlink waypoint from library point"
          >
            <Link2Off size={16} /> Unlink
          </button>
        ) : (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              addLibraryPointFromSelection();
            }}
            aria-label="save to library"
          >
            <Library size={16} /> Save to Library
          </button>
        )}

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.danger}`}
          onClick={() => {
            deleteWaypoint(path.id, waypoint.id);
          }}
          aria-label="delete waypoint"
        >
          <Trash2 size={16} /> Delete Waypoint
        </button>
      </div>
    </div>
  );
};

const HeadingKeyframePanel = ({
  style,
  path,
  headingKeyframe,
  updateHeadingKeyframe,
  deleteHeadingKeyframe,
}: {
  style: CSSProperties;
  path: ReturnType<typeof resolvePathModel>;
  headingKeyframe: HeadingKeyframeSelection;
  updateHeadingKeyframe: (
    pathId: string,
    headingKeyframeId: string,
    patch: HeadingKeyframeUpdatePatch,
  ) => void;
  deleteHeadingKeyframe: (pathId: string, headingKeyframeId: string) => void;
}): ReactElement => {
  const positionLabel = `Sect ${headingKeyframe.sectionIndex + 1} / ${(headingKeyframe.sectionRatio * 100).toFixed(1)}%`;

  return (
    <div
      className={styles.floatingPanel}
      aria-label="heading point properties"
      style={style}
    >
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <MapPin size={18} />
        </div>
        <div className={styles.headerInfo}>
          <h2>Heading Point</h2>
          <p>
            {path.name} / {headingKeyframe.name}
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <span className={styles.fieldLabel}>Name</span>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={headingKeyframe.name}
                onChange={(event) => {
                  updateHeadingKeyframe(path.id, headingKeyframe.id, {
                    name: event.target.value,
                  });
                }}
                aria-label="heading point name"
                placeholder="Heading point name"
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Robot H.</span>
            <div className={styles.inputWrapper}>
              <NumberInput
                value={headingKeyframe.robotHeading}
                onChange={(value) => {
                  if (value !== null) {
                    updateHeadingKeyframe(path.id, headingKeyframe.id, {
                      robotHeading: value,
                    });
                  }
                }}
                aria-label="heading point robot heading"
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>On Path</span>
            <small>{positionLabel}</small>
            <small>
              x: {headingKeyframe.x.toFixed(2)} / y:{' '}
              {headingKeyframe.y.toFixed(2)}
            </small>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.danger}`}
          onClick={() => {
            deleteHeadingKeyframe(path.id, headingKeyframe.id);
          }}
          aria-label="delete heading point"
        >
          <Trash2 size={16} /> Delete Heading Point
        </button>
      </div>
    </div>
  );
};

export const FloatingInspector = (): ReactElement => {
  const {
    addLibraryPointFromSelection,
    deleteHeadingKeyframe,
    deleteWaypoint,
    pause,
    resume,
    setSelectedLibraryPointId,
    setSectionRMin,
    unlinkWaypointPoint,
    updateHeadingKeyframe,
    updateWaypoint,
  } = useWorkspaceActions();
  const paths = usePaths();
  const points = usePoints();
  const lockedPointIds = useLockedPointIds();
  const selection = useSelection();
  const tool = useEditorTool();
  const canvasTransform = useCanvasTransform();

  const shouldResolveSelection = tool !== 'add-point';
  const shouldShowSelection =
    shouldResolveSelection && selection.pathId !== null;

  const resolvedPaths = useMemo(() => {
    if (!shouldResolveSelection) {
      return [];
    }

    const pointsById = createPointIndex(points);
    return paths.map((path) => resolvePathModel(path, pointsById));
  }, [paths, points, shouldResolveSelection]);

  const {
    selectedPath,
    selectedWaypoint,
    selectedHeadingKeyframe,
    selectedSection,
  } = useMemo(() => {
    if (!shouldResolveSelection) {
      return EMPTY_RESOLVED_SELECTION;
    }

    return resolveSelection(resolvedPaths, paths, points, selection);
  }, [paths, points, selection, resolvedPaths, shouldResolveSelection]);

  if (!shouldShowSelection || selectedPath?.id !== selection.pathId) {
    return <></>;
  }

  const anchor =
    selectedHeadingKeyframe ??
    selectedWaypoint ??
    (selectedSection === null
      ? null
      : {
          x: (selectedSection.start.x + selectedSection.end.x) / 2,
          y: (selectedSection.start.y + selectedSection.end.y) / 2,
        });
  const style = getPanelStyle(canvasTransform, anchor);

  if (selectedHeadingKeyframe !== null) {
    return (
      <HeadingKeyframePanel
        style={style}
        path={selectedPath}
        headingKeyframe={selectedHeadingKeyframe}
        updateHeadingKeyframe={updateHeadingKeyframe}
        deleteHeadingKeyframe={deleteHeadingKeyframe}
      />
    );
  }

  if (selectedWaypoint !== null) {
    return (
      <WaypointPanel
        style={style}
        path={selectedPath}
        waypoint={selectedWaypoint}
        isLibraryPointLocked={
          selectedWaypoint.libraryPointId !== null &&
          lockedPointIds.includes(selectedWaypoint.libraryPointId)
        }
        setSelectedLibraryPointId={setSelectedLibraryPointId}
        addLibraryPointFromSelection={addLibraryPointFromSelection}
        deleteWaypoint={deleteWaypoint}
        unlinkWaypointPoint={unlinkWaypointPoint}
        updateWaypoint={updateWaypoint}
      />
    );
  }

  if (selectedSection !== null) {
    return (
      <SectionPanel
        style={style}
        path={selectedPath}
        section={selectedSection}
        pause={pause}
        resume={resume}
        setSectionRMin={setSectionRMin}
      />
    );
  }

  return <></>;
};
