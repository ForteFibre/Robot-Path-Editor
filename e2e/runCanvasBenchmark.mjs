import { chromium } from 'playwright';

const targetUrl = process.argv[2];

if (typeof targetUrl !== 'string' || targetUrl.length === 0) {
  throw new Error('Usage: node e2e/runCanvasBenchmark.mjs <url>');
}

const benchmarkSetup = `
(() => {
  const createPoint = ({ id, name, x, y, isLibrary = false, robotHeading = null }) => ({
    id,
    name,
    x,
    y,
    isLibrary,
    robotHeading,
  });

  const createLibraryPoints = (count) => {
    return Array.from({ length: count }, (_, index) => createPoint({
      id: 'library-point-' + index,
      name: 'Library ' + (index + 1),
      x: Math.sin(index / 7) * 18 + (index % 8) * 0.7,
      y: Math.cos(index / 9) * 15 + Math.floor(index / 8) * 0.9,
      isLibrary: true,
      robotHeading: (index * 19) % 360,
    }));
  };

  const createPathData = ({ pathIndex, waypointCount, libraryPoints }) => {
    const pathPoints = [];
    const waypoints = [];
    const headingKeyframes = [];
    const sectionRMin = [];

    for (let waypointIndex = 0; waypointIndex < waypointCount; waypointIndex += 1) {
      const t = waypointIndex / Math.max(1, waypointCount - 1);
      const x = pathIndex * 1.6 + waypointIndex * 0.85 + Math.sin((pathIndex + 1) * t * Math.PI * 2) * 1.4;
      const y = Math.cos(t * Math.PI * 2.4 + pathIndex * 0.35) * (4 + pathIndex * 0.12) + pathIndex * 2.3;
      const pointId = 'path-' + pathIndex + '-point-' + waypointIndex;
      const linkedLibraryPoint = waypointIndex % 5 === 0
        ? libraryPoints[(pathIndex * waypointCount + waypointIndex) % libraryPoints.length] ?? null
        : null;

      pathPoints.push(
        linkedLibraryPoint === null
          ? createPoint({
              id: pointId,
              name: 'P' + (pathIndex + 1) + '-WP' + (waypointIndex + 1),
              x,
              y,
              robotHeading: waypointIndex % 3 === 0 ? (pathIndex * 17 + waypointIndex * 11) % 360 : null,
            })
          : createPoint({
              id: pointId,
              name: linkedLibraryPoint.name,
              x: linkedLibraryPoint.x,
              y: linkedLibraryPoint.y,
              robotHeading: linkedLibraryPoint.robotHeading,
            }),
      );

      waypoints.push({
        id: 'path-' + pathIndex + '-waypoint-' + waypointIndex,
        pointId,
        libraryPointId: linkedLibraryPoint?.id ?? null,
        pathHeading: ((waypointIndex + pathIndex) * 13) % 360,
      });

      if (waypointIndex < waypointCount - 1) {
        sectionRMin.push(waypointIndex % 4 === 0 ? 0.8 + (waypointIndex % 6) * 0.12 : null);
      }

      if (waypointIndex < waypointCount - 1 && waypointIndex % 3 === 1) {
        headingKeyframes.push({
          id: 'path-' + pathIndex + '-heading-' + headingKeyframes.length,
          sectionIndex: waypointIndex,
          sectionRatio: 0.5,
          robotHeading: ((pathIndex + 1) * 23 + waypointIndex * 9) % 360,
          name: 'H' + (headingKeyframes.length + 1),
        });
      }
    }

    return {
      points: pathPoints,
      path: {
        id: 'path-' + pathIndex,
        name: 'Path ' + (pathIndex + 1),
        color: 'hsl(' + ((pathIndex * 37) % 360) + ' 70% 55%)',
        visible: true,
        waypoints,
        headingKeyframes,
        sectionRMin,
      },
    };
  };

  const createBenchmarkDocument = () => {
    const libraryPoints = createLibraryPoints(160);
    const points = [...libraryPoints];
    const paths = [];

    for (let pathIndex = 0; pathIndex < 18; pathIndex += 1) {
      const pathData = createPathData({
        pathIndex,
        waypointCount: 42,
        libraryPoints,
      });
      points.push(...pathData.points);
      paths.push(pathData.path);
    }

    return {
      domain: {
        paths,
        points,
        lockedPointIds: libraryPoints.filter((_, index) => index % 6 === 0).map((point) => point.id),
        activePathId: paths[0]?.id ?? 'path-0',
      },
      backgroundImage: null,
      robotSettings: {
        length: 0.9,
        width: 0.7,
        acceleration: 1,
        deceleration: 1,
        maxVelocity: 4,
        centripetalAcceleration: 2,
      },
    };
  };

  window.__runPathEditorBenchmark = async () => {
    const documentPayload = createBenchmarkDocument();

    const injectStore = async () => {
      if (window.__PATH_EDITOR_BENCH__?.loadBenchmarkWorkspace) {
        window.__PATH_EDITOR_BENCH__.loadBenchmarkWorkspace();
        return;
      }

      const module = await import('/src/store/workspaceStore.ts');
      module.useWorkspaceStore.getState().importWorkspaceDocument(documentPayload);
    };

    const flushFrames = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    const waitForSettled = async () => {
      let stableCount = 0;
      let previousRecordCount = -1;

      while (stableCount < 3) {
        await flushFrames();
        const recordCount = window.__PATH_EDITOR_PERF__?.records.length ?? 0;

        if (recordCount === previousRecordCount) {
          stableCount += 1;
          continue;
        }

        previousRecordCount = recordCount;
        stableCount = 0;
      }
    };

    await injectStore();
    await waitForSettled();
    window.__PATH_EDITOR_PERF__?.clearRecords();
    await flushFrames();

    const canvas = document.querySelector('[aria-label="robot path editor canvas"]');
    if (!(canvas instanceof HTMLElement)) {
      throw new Error('Canvas element unavailable');
    }

    const rect = canvas.getBoundingClientRect();
    const pointerStart = { clientX: rect.left + 420, clientY: rect.top + 260 };
    const pointerEnd = { clientX: rect.left + 680, clientY: rect.top + 420 };

    const measurePointer = async () => {
      const start = performance.now();
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, ...pointerStart }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, ...pointerStart }));
      for (let index = 0; index < 24; index += 1) {
        const t = (index + 1) / 24;
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          clientX: pointerStart.clientX + (pointerEnd.clientX - pointerStart.clientX) * t,
          clientY: pointerStart.clientY + (pointerEnd.clientY - pointerStart.clientY) * t,
        }));
      }
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, ...pointerEnd }));
      await flushFrames();
      return performance.now() - start;
    };

    const measureWheel = async () => {
      const samples = [];
      for (let index = 0; index < 10; index += 1) {
        const start = performance.now();
        canvas.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 460,
          clientY: rect.top + 280,
          deltaY: -180,
        }));
        await flushFrames();
        samples.push(performance.now() - start);
      }
      return samples;
    };

    await flushFrames();
    const pointerSamples = [];
    for (let index = 0; index < 5; index += 1) {
      pointerSamples.push(await measurePointer());
    }
    const wheelSamples = await measureWheel();

    const summarize = (scenario, samples) => ({
      scenario,
      samples,
      average: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      max: Math.max(...samples),
      min: Math.min(...samples),
    });

    return {
      pointer: summarize('pointer-drag', pointerSamples),
      wheel: summarize('wheel-zoom', wheelSamples),
    };
  };
})();
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PATH_EDITOR_BENCH__ !== undefined);
  await page.addScriptTag({ content: benchmarkSetup });
  const result = await page.evaluate(async () => {
    return window.__runPathEditorBenchmark();
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await page.close();
  await browser.close();
}
