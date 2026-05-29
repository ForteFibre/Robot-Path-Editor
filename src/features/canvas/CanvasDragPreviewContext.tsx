import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { CanvasDragPreview } from './canvasDragPreview';

type CanvasDragPreviewState = {
  preview: CanvasDragPreview | null;
};

type CanvasDragPreviewStore = {
  getState: () => CanvasDragPreviewState;
  subscribe: (listener: () => void) => () => void;
  setPreview: (preview: CanvasDragPreview | null) => void;
  clearPreview: () => void;
};

const createCanvasDragPreviewStore = (): CanvasDragPreviewStore => {
  let state: CanvasDragPreviewState = {
    preview: null,
  };
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPreview: (preview) => {
      state = { preview };
      emit();
    },
    clearPreview: () => {
      state = { preview: null };
      emit();
    },
  };
};

const CanvasDragPreviewContext = createContext<CanvasDragPreviewStore | null>(
  null,
);

type CanvasDragPreviewProviderProps = {
  children: ReactNode;
};

const useCanvasDragPreviewStore = (): CanvasDragPreviewStore => {
  const store = useContext(CanvasDragPreviewContext);

  if (store === null) {
    throw new Error(
      'useCanvasDragPreview must be used within CanvasDragPreviewProvider.',
    );
  }

  return store;
};

export const CanvasDragPreviewProvider = ({
  children,
}: CanvasDragPreviewProviderProps): ReactElement => {
  const storeRef = useRef<CanvasDragPreviewStore | null>(null);

  storeRef.current ??= createCanvasDragPreviewStore();

  return (
    <CanvasDragPreviewContext.Provider value={storeRef.current}>
      {children}
    </CanvasDragPreviewContext.Provider>
  );
};

export const useCanvasDragPreview = (): CanvasDragPreview | null => {
  const store = useCanvasDragPreviewStore();

  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().preview,
    () => store.getState().preview,
  );
};

export const useCanvasDragPreviewActions = (): {
  setPreview: (preview: CanvasDragPreview | null) => void;
  clearPreview: () => void;
} => {
  const store = useCanvasDragPreviewStore();

  const setPreview = useCallback(
    (preview: CanvasDragPreview | null) => {
      store.setPreview(preview);
    },
    [store],
  );

  const clearPreview = useCallback(() => {
    store.clearPreview();
  }, [store]);

  return {
    setPreview,
    clearPreview,
  };
};
