import { type ReactElement } from 'react';
import { SNAP_SETTING_DEFINITIONS } from '../../../domain/snapping';
import type { SnapSettings, SnapToggleKey } from '../../../domain/snapSettings';
import styles from './SnapSettingsPanel.module.css';

type SnapSettingsPanelProps = {
  settings: SnapSettings;
  isOpen: boolean;
  onToggleSetting: (key: SnapToggleKey) => void;
  onToggleOpen: () => void;
};

const pointSettings = SNAP_SETTING_DEFINITIONS.filter(
  (item) => item.section === 'point',
);
const headingSettings = SNAP_SETTING_DEFINITIONS.filter(
  (item) => item.section === 'heading',
);

export const SnapSettingsPanel = ({
  settings,
  isOpen,
  onToggleSetting,
  onToggleOpen,
}: SnapSettingsPanelProps): ReactElement => {
  return (
    <aside className={styles.panel} aria-label="snap settings panel">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Snap Settings</h2>
          <p className={styles.subtitle}>
            Shift: 角度制約 / Alt: スナップ無効化
          </p>
        </div>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          aria-label="toggle snap settings panel"
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {isOpen ? (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Point</h3>
            <div className={styles.settingList}>
              {pointSettings.map((item) => (
                <label
                  key={item.key}
                  className={styles.settingRow}
                  title={item.description}
                >
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    checked={settings[item.key]}
                    onChange={() => {
                      onToggleSetting(item.key);
                    }}
                    aria-label={item.label}
                  />
                  <span className={styles.settingLabel}>{item.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Heading</h3>
            <div className={styles.settingList}>
              {headingSettings.map((item) => (
                <label
                  key={item.key}
                  className={styles.settingRow}
                  title={item.description}
                >
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    checked={settings[item.key]}
                    onChange={() => {
                      onToggleSetting(item.key);
                    }}
                    aria-label={item.label}
                  />
                  <span className={styles.settingLabel}>{item.label}</span>
                </label>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </aside>
  );
};
