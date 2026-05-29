import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactElement,
  type ReactNode,
} from 'react';

export type BenchmarkRenderRecord = {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

type BenchmarkApi = {
  records: BenchmarkRenderRecord[];
  clearRecords: () => void;
};

type BenchmarkPerfWindow = Window & {
  __PATH_EDITOR_PERF__?: BenchmarkApi;
};

declare global {
  type BenchmarkPerfWindowApi = BenchmarkApi;
}

const hasBenchmarkFlag = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).has('benchmark');
};

const getBenchmarkApi = (): BenchmarkApi | null => {
  if (!hasBenchmarkFlag()) {
    return null;
  }

  const benchmarkWindow = window as BenchmarkPerfWindow;

  benchmarkWindow.__PATH_EDITOR_PERF__ ??= {
    records: [],
    clearRecords: () => {
      benchmarkWindow.__PATH_EDITOR_PERF__?.records.splice(0);
    },
  };

  return benchmarkWindow.__PATH_EDITOR_PERF__;
};

const handleRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  const benchmarkApi = getBenchmarkApi();
  if (benchmarkApi === null) {
    return;
  }

  benchmarkApi.records.push({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  });
};

type BenchmarkProfilerProps = {
  id: string;
  children: ReactNode;
};

export const BenchmarkProfiler = ({
  id,
  children,
}: BenchmarkProfilerProps): ReactElement => {
  if (getBenchmarkApi() === null) {
    return <>{children}</>;
  }

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
};
