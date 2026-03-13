import { type ReactElement } from 'react';
import { toAppErrorMessage, type AppNotification } from '../../errors';

type AppNotificationBannerProps = {
  notification: AppNotification | null;
  onDismiss: () => void;
};

export const AppNotificationBanner = ({
  notification,
  onDismiss,
}: AppNotificationBannerProps): ReactElement | null => {
  if (notification === null) {
    return null;
  }

  return (
    <div
      className={`app-status app-status-${notification.kind}`}
      role={notification.kind === 'error' ? 'alert' : undefined}
      aria-live={notification.kind === 'error' ? 'assertive' : 'polite'}
    >
      <span>
        {notification.kind === 'error'
          ? toAppErrorMessage(notification.error)
          : notification.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss notification"
      >
        閉じる
      </button>
    </div>
  );
};
