import { RefreshCw } from 'lucide-react';
import { type ReactElement } from 'react';
import styles from './PwaUpdateBanner.module.css';

type PwaUpdateBannerProps = {
  isVisible: boolean;
  onDismiss: () => void;
  onUpdate: () => void;
};

export const PwaUpdateBanner = ({
  isVisible,
  onDismiss,
  onUpdate,
}: PwaUpdateBannerProps): ReactElement | null => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.messageBlock}>
        <span className={styles.title}>新しいバージョンがあります</span>
        <span className={styles.description}>
          更新して再読み込みすると、最新のオフライン資産と改善を反映できます。
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={onUpdate}
        >
          <RefreshCw size={14} />
          <span>更新して再読み込み</span>
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={onDismiss}
        >
          あとで
        </button>
      </div>
    </div>
  );
};
