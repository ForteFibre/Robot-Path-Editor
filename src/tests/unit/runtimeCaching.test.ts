import { describe, expect, it, vi } from 'vitest';
import {
  APP_SHELL_URL,
  DOCUMENT_NAVIGATION_CACHE_EXPIRATION,
  DOCUMENT_NAVIGATION_CACHE_NAME,
  createDocumentNavigationHandler,
  createDocumentNavigationStrategyConfig,
  isSameOriginNavigationRequest,
  registerDocumentNavigationRoute,
} from '../../pwa/runtimeCaching';

describe('isSameOriginNavigationRequest', () => {
  it('matches only same-origin navigation requests', () => {
    expect(
      isSameOriginNavigationRequest(
        {
          request: { mode: 'navigate' },
          url: new URL('https://editor.example/app'),
        },
        'https://editor.example',
      ),
    ).toBe(true);

    expect(
      isSameOriginNavigationRequest(
        {
          request: { mode: 'navigate' },
          url: new URL('https://cdn.example/app'),
        },
        'https://editor.example',
      ),
    ).toBe(false);

    expect(
      isSameOriginNavigationRequest(
        {
          request: { mode: 'cors' },
          url: new URL('https://editor.example/app'),
        },
        'https://editor.example',
      ),
    ).toBe(false);
  });
});

describe('createDocumentNavigationStrategyConfig', () => {
  it('creates a document cache configuration with expiration limits', () => {
    const expirationPlugin = { kind: 'expiration-plugin' };
    const createExpirationPlugin = vi.fn(() => expirationPlugin);

    const config = createDocumentNavigationStrategyConfig({
      createExpirationPlugin,
    });

    expect(config.cacheName).toBe(DOCUMENT_NAVIGATION_CACHE_NAME);
    expect(createExpirationPlugin).toHaveBeenCalledWith(
      DOCUMENT_NAVIGATION_CACHE_EXPIRATION,
    );
    expect(config.plugins).toEqual([expirationPlugin]);
    expect(DOCUMENT_NAVIGATION_CACHE_EXPIRATION.maxEntries).toBe(10);
    expect(DOCUMENT_NAVIGATION_CACHE_EXPIRATION.maxAgeSeconds).toBe(86_400);
  });
});

describe('createDocumentNavigationHandler', () => {
  it('returns the network-first response when it succeeds', async () => {
    const strategyResponse = new Response('network');
    const fallbackHandler = vi.fn(() =>
      Promise.resolve(new Response('fallback')),
    );
    const handler = createDocumentNavigationHandler({
      fallbackHandler,
      strategy: {
        handle: vi.fn(() => Promise.resolve(strategyResponse)),
      },
    });

    const response = await handler({
      request: new Request('https://editor.example/app'),
      url: new URL('https://editor.example/app'),
    });

    expect(await response.text()).toBe('network');
    expect(fallbackHandler).not.toHaveBeenCalled();
  });

  it('falls back to the precached app shell when the runtime strategy fails', async () => {
    const fallbackHandler = vi.fn(() =>
      Promise.resolve(new Response('fallback')),
    );
    const handler = createDocumentNavigationHandler({
      fallbackHandler,
      strategy: {
        handle: vi.fn(() => Promise.reject(new Error('offline'))),
      },
    });

    const response = await handler({
      request: new Request('https://editor.example/app'),
      url: new URL('https://editor.example/app'),
    });

    expect(await response.text()).toBe('fallback');
    expect(fallbackHandler).toHaveBeenCalledTimes(1);
  });
});

describe('registerDocumentNavigationRoute', () => {
  it('registers the navigation route with the app shell fallback', async () => {
    const register = vi.fn();
    const fallbackHandler = vi.fn(() =>
      Promise.resolve(new Response('fallback')),
    );
    const createFallbackHandler = vi.fn(() => fallbackHandler);
    const strategy = {
      handle: vi.fn(() => Promise.resolve(new Response('network'))),
    };

    const route = registerDocumentNavigationRoute({
      createFallbackHandler,
      origin: 'https://editor.example',
      register,
      strategy,
    });

    expect(createFallbackHandler).toHaveBeenCalledWith(APP_SHELL_URL);
    expect(register).toHaveBeenCalledTimes(1);
    expect(
      route.match({
        request: { mode: 'navigate' },
        url: new URL('https://editor.example/app'),
      }),
    ).toBe(true);
    expect(
      route.match({
        request: { mode: 'navigate' },
        url: new URL('https://assets.example/app'),
      }),
    ).toBe(false);

    const response = await route.handler({
      request: new Request('https://editor.example/app'),
      url: new URL('https://editor.example/app'),
    });

    expect(await response.text()).toBe('network');
  });
});
