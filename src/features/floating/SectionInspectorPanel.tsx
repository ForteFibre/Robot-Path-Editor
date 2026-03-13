import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import { Route, RotateCcw } from 'lucide-react';
import { NumberInput } from '../../components/common/NumberInput';
import { PanelHeader } from '../../components/common/PanelHeader';
import { SECTION_R_MIN_INPUT_STEP } from '../../domain/metricScale';
import type { ResolvedPathModel } from '../../domain/pointResolution';
import type { SectionSelection } from './floatingInspectorModel';
import styles from './FloatingInspector.module.css';

type SectionInspectorPanelProps = {
  style: CSSProperties;
  path: ResolvedPathModel;
  section: SectionSelection;
  pause: () => void;
  resume: () => void;
  setSectionRMin: (
    pathId: string,
    sectionIndex: number,
    rMin: number | null,
  ) => void;
};

export const SectionInspectorPanel = ({
  style,
  path,
  section,
  pause,
  resume,
  setSectionRMin,
}: SectionInspectorPanelProps): ReactElement => {
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
      <PanelHeader
        icon={<Route size={18} />}
        title="Section Inspector"
        subtitle={`${path.name} / Sect ${section.index + 1}`}
        divider
        iconTone="neutral"
      />

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
