import { type ReactElement } from 'react';
import { PanelHeader } from '../../../components/common/PanelHeader';
import { SNAP_SETTING_DEFINITIONS } from '../../../domain/snapping';
import type { SnapSettings, SnapToggleKey } from '../../../domain/snapSettings';
import styles from './SnapSettingsPanel.module.css';

type SnapSettingsPanelProps = {
  settings: SnapSettings;
  isOpen: boolean;
  onToggleSetting: (key: SnapToggleKey) => void;
  onToggleOpen: () => void;
};

const SNAP_SECTIONS = [
  { key: 'point', title: 'Point' },
  { key: 'heading', title: 'Heading' },
] as const;

const SNAP_SECTION_ITEMS = SNAP_SECTIONS.map((section) => ({
  ...section,
  items: SNAP_SETTING_DEFINITIONS.filter(
    (item) => item.section === section.key,
  ),
}));

type SnapSettingRowProps = {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
};

const SnapSettingRow = ({
  checked,
  label,
  description,
  onChange,
}: SnapSettingRowProps): ReactElement => {
  return (
    <label className={styles.settingRow} title={description}>
      <input
        className={styles.checkbox}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
      <span className={styles.settingLabel}>{label}</span>
    </label>
  );
};

export const SnapSettingsPanel = ({
  settings,
  isOpen,
  onToggleSetting,
  onToggleOpen,
}: SnapSettingsPanelProps): ReactElement => {
  return (
    <aside className={styles.panel} aria-label="snap settings panel">
      <PanelHeader
        title="Snap Settings"
        subtitle="Shift: 角度制約 / Alt: スナップ無効化"
        actions={
          <button
            type="button"
            className={styles.collapseButton}
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            aria-label="toggle snap settings panel"
          >
            {isOpen ? 'Hide' : 'Show'}
          </button>
        }
      />

      {isOpen ? (
        <div className={styles.sections}>
          {SNAP_SECTION_ITEMS.map((section) => (
            <section key={section.key} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              <div className={styles.settingList}>
                {section.items.map((item) => (
                  <SnapSettingRow
                    key={item.key}
                    checked={settings[item.key]}
                    label={item.label}
                    description={item.description}
                    onChange={() => {
                      onToggleSetting(item.key);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
};
