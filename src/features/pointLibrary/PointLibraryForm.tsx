import { type ReactElement, type ReactNode, type RefObject } from 'react';
import { NumberInput } from '../../components/common/NumberInput';
import { DEFAULT_COORDINATE_INPUT_STEP } from '../../domain/metricScale';
import styles from './PointLibraryPanel.module.css';
import { type LibraryPointDraft } from './usePointLibrary';

type PointLibraryFormProps = {
  draft: LibraryPointDraft;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<LibraryPointDraft>) => void;
  actions: ReactNode;
  disabledCoordinates?: boolean;
  disabledRobotHeading?: boolean;
  nameAriaLabel: string;
  xAriaLabel: string;
  yAriaLabel: string;
  headingAriaLabel: string;
};

export const PointLibraryForm = ({
  draft,
  nameInputRef,
  onChange,
  actions,
  disabledCoordinates = false,
  disabledRobotHeading = false,
  nameAriaLabel,
  xAriaLabel,
  yAriaLabel,
  headingAriaLabel,
}: PointLibraryFormProps): ReactElement => {
  return (
    <div className={styles.formStack}>
      <label className={styles.formField}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          ref={nameInputRef}
          type="text"
          value={draft.name}
          onChange={(event) => {
            onChange({ name: event.target.value });
          }}
          className={styles.textInput}
          aria-label={nameAriaLabel}
        />
      </label>

      <div className={styles.compactGrid}>
        <div className={styles.compactField}>
          <span className={styles.compactLabel}>X</span>
          <NumberInput
            value={draft.x}
            step={DEFAULT_COORDINATE_INPUT_STEP}
            disabled={disabledCoordinates}
            onChange={(value) => {
              onChange({ x: value });
            }}
            className={styles.numberInput ?? ''}
            aria-label={xAriaLabel}
          />
        </div>

        <div className={styles.compactField}>
          <span className={styles.compactLabel}>Y</span>
          <NumberInput
            value={draft.y}
            step={DEFAULT_COORDINATE_INPUT_STEP}
            disabled={disabledCoordinates}
            onChange={(value) => {
              onChange({ y: value });
            }}
            className={styles.numberInput ?? ''}
            aria-label={yAriaLabel}
          />
        </div>

        <div className={styles.compactField}>
          <span className={styles.compactLabel}>H</span>
          <NumberInput
            value={draft.robotHeading}
            disabled={disabledRobotHeading}
            onChange={(value) => {
              onChange({ robotHeading: value });
            }}
            className={styles.numberInput ?? ''}
            aria-label={headingAriaLabel}
          />
          <span className={styles.headingUnit}>°</span>
        </div>
      </div>

      <div className={styles.editorActions}>{actions}</div>
    </div>
  );
};
