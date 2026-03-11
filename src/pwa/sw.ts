/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import {
  createDocumentNavigationStrategyConfig,
  registerDocumentNavigationRoute,
} from './runtimeCaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

type SkipWaitingMessage = {
  type: 'SKIP_WAITING';
};

const isSkipWaitingMessage = (data: unknown): data is SkipWaitingMessage => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  return (
    'type' in data &&
    (
      data as {
        type?: unknown;
      }
    ).type === 'SKIP_WAITING'
  );
};

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const documentNavigationStrategyConfig = createDocumentNavigationStrategyConfig(
  {
    createExpirationPlugin: (options) => new ExpirationPlugin(options),
  },
);

const documentNavigationStrategy = new NetworkFirst({
  ...documentNavigationStrategyConfig,
  plugins: documentNavigationStrategyConfig.plugins as Exclude<
    NonNullable<ConstructorParameters<typeof NetworkFirst>[0]>['plugins'],
    undefined
  >,
});

registerDocumentNavigationRoute({
  createFallbackHandler: (appShellUrl) => {
    const fallbackHandler = createHandlerBoundToURL(appShellUrl);

    return async (options) => {
      return fallbackHandler(options as Parameters<typeof fallbackHandler>[0]);
    };
  },
  origin: self.location.origin,
  register: (match, handler) => registerRoute(match, handler),
  strategy: {
    handle: async (options) => {
      return documentNavigationStrategy.handle(
        options as Parameters<typeof documentNavigationStrategy.handle>[0],
      );
    },
  },
});

self.addEventListener('message', (event) => {
  if (isSkipWaitingMessage(event.data)) {
    void self.skipWaiting();
  }
});
