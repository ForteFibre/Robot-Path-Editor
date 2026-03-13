import { screen } from '@testing-library/react';
import { vi } from 'vitest';

export const parseDisplayedSeconds = (text: string | null): number => {
  const matchedSeconds = /(\d+(?:\.\d+)?) s/.exec(text ?? '');

  if (matchedSeconds?.[1] === undefined) {
    throw new Error(`expected time text, received: ${text ?? 'null'}`);
  }

  return Number(matchedSeconds[1]);
};

export const getDisplayedTotalSeconds = (): number => {
  return parseDisplayedSeconds(screen.getByText(/^Total /).textContent);
};

export const getVelocityOverlays = (): HTMLElement[] => {
  return screen.queryAllByLabelText('path velocity overlay');
};

export const stubAnimationFrames = (): {
  advanceFrames: (count: number, frameDurationMs?: number) => void;
} => {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id);
  });

  return {
    advanceFrames: (count: number, frameDurationMs = 16) => {
      for (let frameIndex = 0; frameIndex < count; frameIndex += 1) {
        now += frameDurationMs;
        const scheduledCallbacks = [...callbacks.entries()].sort(
          ([leftId], [rightId]) => leftId - rightId,
        );
        callbacks.clear();

        for (const [, callback] of scheduledCallbacks) {
          callback(now);
        }
      }
    },
  };
};
