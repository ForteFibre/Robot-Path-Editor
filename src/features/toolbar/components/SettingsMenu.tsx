import { type ReactElement } from 'react';
import { Bot, Image as ImageIcon, Settings, Trash2 } from 'lucide-react';
import { NumberInput } from '../../../components/common/NumberInput';
import { Modal } from '../../../components/common/Modal';
import styles from './SettingsMenu.module.css';
import { useSettingsMenuController } from './useSettingsMenuController';

export const SettingsMenu = (): ReactElement => {
  const {
    backgroundImage,
    closeMenu,
    handleBackgroundImageLoad,
    handleBackgroundImageOpacityChange,
    handleBackgroundImageScaleChange,
    handleBackgroundImageXChange,
    handleBackgroundImageYChange,
    handleRemoveBackgroundImage,
    handleRobotAccelerationChange,
    handleRobotCentripetalAccelerationChange,
    handleRobotDecelerationChange,
    handleRobotLengthChange,
    handleRobotMaxVelocityChange,
    handleRobotWidthChange,
    handleToggleImageLock,
    handleToggleRobotPreview,
    isOpen,
    isRobotPreviewEnabled,
    openMenu,
    robotSettings,
    tool,
  } = useSettingsMenuController();

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.isOpen : ''}`}
        onClick={openMenu}
        aria-expanded={isOpen}
        aria-label="open settings menu"
        title="Settings"
      >
        <Settings size={16} />
      </button>

      <Modal isOpen={isOpen} onClose={closeMenu} title="Settings">
        <div className={styles.modalContent} aria-label="settings menu content">
          {/* Robot Settings Section */}
          <div className={styles.settingsSection} aria-label="robot settings">
            <h3 className={styles.sectionTitle}>
              <Bot size={16} />
              Robot Settings
            </h3>
            <div className={styles.fieldGroup}>
              <div className={styles.inlineLabel}>
                <label htmlFor="robot-length-input">Length (m)</label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-length-input"
                    aria-label="Robot Length (m)"
                    min={0.01}
                    step={0.01}
                    value={robotSettings.length}
                    onChange={handleRobotLengthChange}
                  />
                </div>
              </div>
              <div className={styles.inlineLabel}>
                <label htmlFor="robot-width-input">Width (m)</label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-width-input"
                    aria-label="Robot Width (m)"
                    min={0.01}
                    step={0.01}
                    value={robotSettings.width}
                    onChange={handleRobotWidthChange}
                  />
                </div>
              </div>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isRobotPreviewEnabled}
                  onChange={(event) => {
                    handleToggleRobotPreview(event.target.checked);
                  }}
                  aria-label="Robot Preview"
                />
                <span>Show Preview</span>
              </label>

              <div className={styles.inlineLabel}>
                <label htmlFor="robot-max-velocity-input">Max Vel (m/s)</label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-max-velocity-input"
                    aria-label="Max Velocity (m/s)"
                    min={0.001}
                    step={0.01}
                    value={robotSettings.maxVelocity}
                    onChange={handleRobotMaxVelocityChange}
                  />
                </div>
              </div>
              <div className={styles.inlineLabel}>
                <label htmlFor="robot-acceleration-input">Accel (m/s²)</label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-acceleration-input"
                    aria-label="Acceleration (m/s²)"
                    min={0.001}
                    step={0.01}
                    value={robotSettings.acceleration}
                    onChange={handleRobotAccelerationChange}
                  />
                </div>
              </div>
              <div className={styles.inlineLabel}>
                <label htmlFor="robot-deceleration-input">Decel (m/s²)</label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-deceleration-input"
                    aria-label="Deceleration (m/s²)"
                    min={0.001}
                    step={0.01}
                    value={robotSettings.deceleration}
                    onChange={handleRobotDecelerationChange}
                  />
                </div>
              </div>
              <div className={styles.inlineLabel}>
                <label htmlFor="robot-centripetal-input">
                  Centripetal (m/s²)
                </label>
                <div className={styles.numberInputWrapper}>
                  <NumberInput
                    id="robot-centripetal-input"
                    aria-label="Centripetal Acceleration (m/s²)"
                    min={0.001}
                    step={0.01}
                    value={robotSettings.centripetalAcceleration}
                    onChange={handleRobotCentripetalAccelerationChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Background Settings Section */}
          <div
            className={styles.settingsSection}
            aria-label="background image settings"
          >
            <h3 className={styles.sectionTitle}>
              <ImageIcon size={16} />
              Background Image
              {backgroundImage === null ? null : (
                <span className={styles.activeBadge} />
              )}
            </h3>

            <div className={styles.fieldGroup}>
              {backgroundImage === null ? (
                <label className={styles.loadButton}>
                  <span>Load Image...</span>
                  <input
                    id="background-image-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageLoad}
                    className="visually-hidden"
                  />
                </label>
              ) : (
                <>
                  <div className={styles.inlineLabel}>
                    <span title="X Position (m)">X (m)</span>
                    <div className={styles.numberInputWrapper}>
                      <NumberInput
                        aria-label="X (m)"
                        value={backgroundImage.x}
                        step={0.1}
                        onChange={handleBackgroundImageXChange}
                      />
                    </div>
                  </div>
                  <div className={styles.inlineLabel}>
                    <span title="Y Position (m)">Y (m)</span>
                    <div className={styles.numberInputWrapper}>
                      <NumberInput
                        aria-label="Y (m)"
                        value={backgroundImage.y}
                        step={0.1}
                        onChange={handleBackgroundImageYChange}
                      />
                    </div>
                  </div>
                  <div className={styles.inlineLabel}>
                    <span title="Scale">Scale</span>
                    <div className={styles.numberInputWrapper}>
                      <NumberInput
                        aria-label="Scale"
                        value={backgroundImage.scale}
                        step={0.1}
                        min={0.0001}
                        onChange={handleBackgroundImageScaleChange}
                      />
                    </div>
                  </div>
                  <div className={styles.inlineLabel}>
                    <span title="Opacity (0.0 - 1.0)">Opacity</span>
                    <div className={styles.numberInputWrapper}>
                      <NumberInput
                        aria-label="Opacity"
                        value={backgroundImage.alpha}
                        step={0.1}
                        min={0}
                        max={1}
                        onChange={handleBackgroundImageOpacityChange}
                      />
                    </div>
                  </div>

                  <div className={styles.bgActions}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={tool !== 'edit-image'}
                        onChange={(event) => {
                          handleToggleImageLock(event.target.checked);
                        }}
                      />
                      <span>Lock Image</span>
                    </label>

                    <button
                      type="button"
                      className="icon-button btn-danger icon-button--small"
                      title="Remove Image"
                      onClick={handleRemoveBackgroundImage}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
