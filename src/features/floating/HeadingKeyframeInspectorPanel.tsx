import { type CSSProperties, type ReactElement } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { NumberInput } from '../../components/common/NumberInput';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { PanelHeader } from '../../components/common/PanelHeader';
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
      <PanelHeader
        icon={<MapPin size={18} />}
        title="Heading Point"
        subtitle={`${path.name} / ${headingKeyframe.name}`}
        divider
        iconTone="neutral"
      />

      <div className={styles.section}>
        <div className={styles.grid}>
          <FormField
            className={`${styles.field} ${styles.fieldFullWidth}`}
            variant="floating"
            label="Name"
          >
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
          </FormField>
          <FormField
            className={styles.field ?? ''}
            variant="floating"
            label="Robot H."
          >
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
          </FormField>
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
        <Button
          variant="destructive"
          size="sm"
          style={{ width: '100%' }}
          onClick={() => {
            deleteHeadingKeyframe(path.id, headingKeyframe.id);
          }}
          aria-label="delete heading point"
        >
          <Trash2 size={16} /> Delete Heading Point
        </Button>
      </div>
    </div>
  );
};
