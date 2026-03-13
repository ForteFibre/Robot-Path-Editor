import { useEffect, useMemo, useState } from 'react';
import {
  getLoopedPathTime,
  sampleTimedPathAtTime,
  type PathTiming,
  type TimedPathPose,
} from '../../../domain/pathTiming';

const START_WAIT_SECONDS = 1;
const END_WAIT_SECONDS = 1;

export type PathAnimationState = {
  currentTime: number;
  totalTime: number;
  progress: number;
  pose: TimedPathPose | null;
};

export const usePathAnimation = (
  timing: PathTiming | null,
  enabled: boolean,
): PathAnimationState => {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (
      !enabled ||
      timing === null ||
      timing.samples.length === 0 ||
      timing.totalTime <= 0
    ) {
      setCurrentTime(0);
      return;
    }

    let startTimestamp: number | null = null;
    let frameId = 0;

    const animate = (timestamp: number): void => {
      startTimestamp ??= timestamp;
      const elapsedSeconds = (timestamp - startTimestamp) / 1000;
      setCurrentTime(
        getLoopedPathTime(
          elapsedSeconds,
          timing.totalTime,
          START_WAIT_SECONDS,
          END_WAIT_SECONDS,
        ),
      );
      frameId = globalThis.requestAnimationFrame(animate);
    };

    setCurrentTime(0);
    frameId = globalThis.requestAnimationFrame(animate);

    return () => {
      globalThis.cancelAnimationFrame(frameId);
    };
  }, [enabled, timing]);

  const pose = useMemo<TimedPathPose | null>(() => {
    if (timing === null) {
      return null;
    }

    return sampleTimedPathAtTime(timing, currentTime);
  }, [currentTime, timing]);

  return {
    currentTime,
    totalTime: timing?.totalTime ?? 0,
    progress:
      timing === null || timing.totalTime <= 0
        ? 0
        : currentTime / timing.totalTime,
    pose,
  };
};
