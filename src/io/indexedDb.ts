export const PATH_EDITOR_DB_NAME = 'path-editor';
export const PATH_EDITOR_DB_VERSION = 1;
export const WORKSPACE_STATE_STORE_NAME = 'workspace-state';

type IndexedDbRecord = {
  key: string;
} & Record<string, unknown>;

const toIndexedDbError = (
  fallbackMessage: string,
  error: DOMException | null,
): Error => {
  return error ?? new Error(fallbackMessage);
};

const requestToPromise = <T>(
  request: IDBRequest<T>,
  fallbackMessage: string,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(toIndexedDbError(fallbackMessage, request.error));
    };
  });
};

const transactionDone = (transaction: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(
        toIndexedDbError('IndexedDB transaction failed', transaction.error),
      );
    };

    transaction.onabort = () => {
      reject(
        toIndexedDbError(
          'IndexedDB transaction was aborted',
          transaction.error,
        ),
      );
    };
  });
};

export const openIndexedDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PATH_EDITOR_DB_NAME, PATH_EDITOR_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(WORKSPACE_STATE_STORE_NAME)) {
        database.createObjectStore(WORKSPACE_STATE_STORE_NAME, {
          keyPath: 'key',
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(toIndexedDbError('Failed to open IndexedDB', request.error));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB open request was blocked'));
    };
  });
};

const withWorkspaceStateStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> => {
  const database = await openIndexedDb();

  try {
    const transaction = database.transaction(WORKSPACE_STATE_STORE_NAME, mode);
    const store = transaction.objectStore(WORKSPACE_STATE_STORE_NAME);
    const completion = transactionDone(transaction);

    try {
      const result = await operation(store);
      await completion;
      return result;
    } catch (error) {
      await completion.catch(() => undefined);
      throw error;
    }
  } finally {
    database.close();
  }
};

export const getIndexedDbRecord = (key: string): Promise<unknown> => {
  return withWorkspaceStateStore('readonly', async (store) => {
    return requestToPromise<unknown>(
      store.get(key) as IDBRequest<unknown>,
      `Failed to read IndexedDB record for key "${key}"`,
    );
  });
};

export const putIndexedDbRecord = (record: IndexedDbRecord): Promise<void> => {
  return withWorkspaceStateStore('readwrite', async (store) => {
    await requestToPromise(
      store.put(record),
      `Failed to write IndexedDB record for key "${record.key}"`,
    );
  });
};

export const deleteIndexedDbRecord = (key: string): Promise<void> => {
  return withWorkspaceStateStore('readwrite', async (store) => {
    await requestToPromise(
      store.delete(key),
      `Failed to delete IndexedDB record for key "${key}"`,
    );
  });
};
