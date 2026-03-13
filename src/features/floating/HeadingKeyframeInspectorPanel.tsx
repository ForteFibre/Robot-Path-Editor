import { type CSSProperties, type ReactElement } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { NumberInput } from '../../components/common/NumberInput';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { HeadingKeyframeUpdatePatch } from '../../store/types';
import type { HeadingKeyframeSelection } from './floatingInspectorModel';
import styles from './FloatingInspector.module.css';

type HeadingKeyframeInspectorPanelProps = {
  style: CSSProperties;
  path: ResolvedPathModel;
  headingKeyframe: HeadingKeyframeSelection;
  updateHeadingKeyframe: (
    pathId: string,
    headingKeyframeId: string,
    patch: HeadingKeyframeUpdatePatch,
  ) => void;
  deleteHeadingKeyframe: (pathId: string, headingKeyframeId: string) => void;
};

export const HeadingKeyframeInspectorPanel = ({
  style,
  path,
  headingKeyframe,
  updateHeadingKeyframe,
  deleteHeadingKeyframe,
}: HeadingKeyframeInspectorPanelProps): ReactElement => {
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
