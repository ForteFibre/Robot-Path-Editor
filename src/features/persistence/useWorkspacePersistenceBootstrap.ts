import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrapWorkspacePersistence } from './bootstrapWorkspacePersistence';
import type { WorkspacePersistenceBootstrapResult } from './types';

type UseWorkspacePersistenceBootstrapResult = {
  bootstrapResult: WorkspacePersistenceBootstrapResult | null;
};

export const useWorkspacePersistenceBootstrap =
  (): UseWorkspacePersistenceBootstrapResult => {
    const bootstrapPromiseRef =
      useRef<Promise<WorkspacePersistenceBootstrapResult> | null>(null);
    const [bootstrapResult, setBootstrapResult] =
      useState<WorkspacePersistenceBootstrapResult | null>(null);

    const loadBootstrapResult =
      useCallback((): Promise<WorkspacePersistenceBootstrapResult> => {
        if (bootstrapPromiseRef.current !== null) {
          return bootstrapPromiseRef.current;
        }

        const nextBootstrapPromise = bootstrapWorkspacePersistence();
        bootstrapPromiseRef.current = nextBootstrapPromise;
        return nextBootstrapPromise;
      }, []);

    useEffect(() => {
      let isMounted = true;

      void loadBootstrapResult()
        .then((result) => {
          if (!isMounted) {
            return;
          }

          setBootstrapResult(result);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setBootstrapResult({ kind: 'no-restore' });
        });

      return () => {
        isMounted = false;
      };
    }, [loadBootstrapResult]);

    return {
      bootstrapResult,
    };
  };
