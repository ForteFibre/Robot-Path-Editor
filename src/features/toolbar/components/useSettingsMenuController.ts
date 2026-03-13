import { useCallback, useState, type ChangeEvent } from 'react';
import { isAppError } from '../../../errors';
import {
  useBackgroundImage,
  useEditorTool,
  useRobotPreviewEnabled,
  useRobotSettings,
} from '../../../store/workspaceSelectors';
import { useAppNotification } from '../../app-shell/AppNotificationContext';
import { loadBackgroundImageFile } from '../backgroundImageFile';
import { useSettingsMenuActions } from './useSettingsMenuActions';

export const useSettingsMenuController = () => {
  const {
    setBackgroundImage,
    setRobotPreviewEnabled,
    setRobotSettings,
    setTool,
    updateBackgroundImage,
  } = useSettingsMenuActions();
  const { setNotification } = useAppNotification();
  const backgroundImage = useBackgroundImage();
  const tool = useEditorTool();
  const isRobotPreviewEnabled = useRobotPreviewEnabled();
  const robotSettings = useRobotSettings();
  const [isOpen, setIsOpen] = useState(false);

  const openMenu = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const handleBackgroundImageLoad = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (file === undefined) {
        return;
      }

      event.target.value = '';
      setNotification(null);

      void loadBackgroundImageFile(file)
        .then((loadedBackgroundImage) => {
          setBackgroundImage(loadedBackgroundImage);
        })
        .catch((error: unknown) => {
          if (isAppError(error)) {
            setNotification({
              kind: 'error',
              error: error.appError,
            });
            return;
          }

          setNotification({
            kind: 'error',
            error: {
              kind: 'background-image',
              reason: 'read-failed',
            },
          });
        });
    },
    [setBackgroundImage, setNotification],
  );

  const handleRemoveBackgroundImage = useCallback((): void => {
    setBackgroundImage(null);
  }, [setBackgroundImage]);

  const handleToggleImageLock = useCallback(
    (checked: boolean): void => {
      setTool(checked ? 'select' : 'edit-image');
    },
    [setTool],
  );

  const handleBackgroundImageXChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        updateBackgroundImage({ x: value });
      }
    },
    [updateBackgroundImage],
  );

  const handleBackgroundImageYChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        updateBackgroundImage({ y: value });
      }
    },
    [updateBackgroundImage],
  );

  const handleBackgroundImageScaleChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        updateBackgroundImage({ scale: value });
      }
    },
    [updateBackgroundImage],
  );

  const handleBackgroundImageOpacityChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        updateBackgroundImage({ alpha: value });
      }
    },
    [updateBackgroundImage],
  );

  const handleRobotLengthChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ length: value });
      }
    },
    [setRobotSettings],
  );

  const handleRobotWidthChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ width: value });
      }
    },
    [setRobotSettings],
  );

  const handleToggleRobotPreview = useCallback(
    (checked: boolean): void => {
      setRobotPreviewEnabled(checked);
    },
    [setRobotPreviewEnabled],
  );

  const handleRobotMaxVelocityChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ maxVelocity: value });
      }
    },
    [setRobotSettings],
  );

  const handleRobotAccelerationChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ acceleration: value });
      }
    },
    [setRobotSettings],
  );

  const handleRobotDecelerationChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ deceleration: value });
      }
    },
    [setRobotSettings],
  );

  const handleRobotCentripetalAccelerationChange = useCallback(
    (value: number | null): void => {
      if (value !== null) {
        setRobotSettings({ centripetalAcceleration: value });
      }
    },
    [setRobotSettings],
  );

  return {
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
  };
};
