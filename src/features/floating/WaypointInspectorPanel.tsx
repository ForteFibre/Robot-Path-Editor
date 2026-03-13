import { type CSSProperties, type ReactElement } from 'react';
import { Library, Link2Off, MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { NumberInput } from '../../components/common/NumberInput';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { WaypointUpdatePatch } from '../../store/types';
import type { WaypointSelection } from './floatingInspectorModel';
import styles from './FloatingInspector.module.css';

type WaypointInspectorPanelProps = {
  style: CSSProperties;
  path: ResolvedPathModel;
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
};

export const WaypointInspectorPanel = ({
  style,
  path,
  waypoint,
  isLibraryPointLocked,
  setSelectedLibraryPointId,
  addLibraryPointFromSelection,
  deleteWaypoint,
  unlinkWaypointPoint,
  updateWaypoint,
}: WaypointInspectorPanelProps): ReactElement => {
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
