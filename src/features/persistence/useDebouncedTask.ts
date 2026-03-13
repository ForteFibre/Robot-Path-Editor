import { useCallback, useEffect, useRef } from 'react';

type UseDebouncedTaskResult = {
  schedule: (task: () => void, delayMs: number) => void;
  cancel: () => void;
};

export const useDebouncedTask = (): UseDebouncedTaskResult => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTaskRef = useRef<(() => void) | null>(null);

  const cancel = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    latestTaskRef.current = null;
  }, []);

  const schedule = useCallback((task: () => void, delayMs: number): void => {
    latestTaskRef.current = task;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const nextTask = latestTaskRef.current;
      latestTaskRef.current = null;
      nextTask?.();
    }, delayMs);
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    schedule,
    cancel,
  };
};
