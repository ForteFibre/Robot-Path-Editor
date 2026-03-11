export const APP_SHELL_URL = '/index.html';
export const DOCUMENT_NAVIGATION_CACHE_NAME = 'document-navigation-runtime';
export const DOCUMENT_NAVIGATION_CACHE_EXPIRATION = Object.freeze({
  maxEntries: 10,
  maxAgeSeconds: 60 * 60 * 24,
});

type ExpirationOptions = {
  maxAgeSeconds: number;
  maxEntries: number;
};

type NavigationRequestLike = Pick<Request, 'mode'>;

export type NavigationRouteMatchContext = {
  request: NavigationRequestLike;
  url: URL;
};

export type NavigationRouteHandlerContext = {
  event?: unknown;
  params?: unknown;
  request: Request;
  url: URL;
};

export type NavigationStrategyLike = {
  handle: (
    options: NavigationRouteHandlerContext,
  ) => Promise<Response | undefined>;
};

export type NavigationFallbackHandler = (
  options: NavigationRouteHandlerContext,
) => Promise<Response>;

type ExpirationPluginFactory = (options: ExpirationOptions) => unknown;

type NavigationFallbackHandlerFactory = (
  appShellUrl: string,
) => NavigationFallbackHandler;

type RouteRegistrar = (
  match: (options: NavigationRouteMatchContext) => boolean,
  handler: (options: NavigationRouteHandlerContext) => Promise<Response>,
) => unknown;

export const isSameOriginNavigationRequest = (
  { request, url }: NavigationRouteMatchContext,
  origin: string,
): boolean => {
  return request.mode === 'navigate' && url.origin === origin;
};

export const createDocumentNavigationStrategyConfig = ({
  createExpirationPlugin,
}: {
  createExpirationPlugin: ExpirationPluginFactory;
}): {
  cacheName: string;
  plugins: unknown[];
} => {
  return {
    cacheName: DOCUMENT_NAVIGATION_CACHE_NAME,
    plugins: [createExpirationPlugin(DOCUMENT_NAVIGATION_CACHE_EXPIRATION)],
  };
};

export const createDocumentNavigationHandler = ({
  fallbackHandler,
  strategy,
}: {
  fallbackHandler: NavigationFallbackHandler;
  strategy: NavigationStrategyLike;
}): ((options: NavigationRouteHandlerContext) => Promise<Response>) => {
  return async (options: NavigationRouteHandlerContext): Promise<Response> => {
    try {
      const response = await strategy.handle(options);

      if (response !== undefined) {
        return response;
      }
    } catch {
      // Network failures should fall back to the precached app shell.
    }

    return fallbackHandler(options);
  };
};

export const registerDocumentNavigationRoute = ({
  appShellUrl = APP_SHELL_URL,
  createFallbackHandler,
  origin,
  register,
  strategy,
}: {
  appShellUrl?: string;
  createFallbackHandler: NavigationFallbackHandlerFactory;
  origin: string;
  register: RouteRegistrar;
  strategy: NavigationStrategyLike;
}): {
  handler: (options: NavigationRouteHandlerContext) => Promise<Response>;
  match: (options: NavigationRouteMatchContext) => boolean;
  strategy: NavigationStrategyLike;
} => {
  const match = (options: NavigationRouteMatchContext): boolean => {
    return isSameOriginNavigationRequest(options, origin);
  };
  const handler = createDocumentNavigationHandler({
    fallbackHandler: createFallbackHandler(appShellUrl),
    strategy,
  });

  register(match, handler);

  return {
    handler,
    match,
    strategy,
  };
};
