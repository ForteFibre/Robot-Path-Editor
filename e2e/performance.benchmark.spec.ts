import { expect, test } from '@playwright/test';

type BenchmarkSummary = {
  scenario: string;
  sampleCount: number;
  totalActualDuration: number;
  maxActualDuration: number;
  canvasShellActualDuration: number;
  sidebarActualDuration: number;
  pathDetailsActualDuration: number;
};

declare global {
  interface Window {
    __PATH_EDITOR_BENCH__?: {
      loadBenchmarkWorkspace: () => void;
    };
    __PATH_EDITOR_PERF__?: {
      records: Array<{
        id: string;
        phase: 'mount' | 'update' | 'nested-update';
        actualDuration: number;
      }>;
      clearRecords: () => void;
    };
  }
}

const flushFrames = async (page: Parameters<typeof test>[0]['page']) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
};

const waitForBenchmarkSettled = async (
  page: Parameters<typeof test>[0]['page'],
) => {
  await page.evaluate(async () => {
    const flush = async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    };

    let stableCount = 0;
    let previousRecordCount = -1;

    while (stableCount < 3) {
      await flush();
      const recordCount = window.__PATH_EDITOR_PERF__?.records.length ?? 0;

      if (recordCount === previousRecordCount) {
        stableCount += 1;
        continue;
      }

      previousRecordCount = recordCount;
      stableCount = 0;
    }
  });
};

test('benchmark wheel and pointer interactions', async ({ page }) => {
  await page.goto('/?benchmark=1');

  await page.waitForFunction(() => {
    return window.__PATH_EDITOR_BENCH__ !== undefined;
  });

  await page.evaluate(() => {
    window.__PATH_EDITOR_BENCH__?.loadBenchmarkWorkspace();
  });
  await waitForBenchmarkSettled(page);
  await page.evaluate(() => {
    window.__PATH_EDITOR_PERF__?.clearRecords();
  });
  await flushFrames(page);

  const canvas = page.getByLabel('robot path editor canvas');
  await expect(canvas).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  if (canvasBox === null) {
    throw new Error('Canvas bounding box not found');
  }

  await page.mouse.move(canvasBox.x + 420, canvasBox.y + 260);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 680, canvasBox.y + 420, { steps: 24 });
  await page.mouse.up();
  await flushFrames(page);
  await page.evaluate(() => {
    window.__PATH_EDITOR_PERF__?.clearRecords();
  });
  await flushFrames(page);

  const pointerSummary = await page.evaluate<[], BenchmarkSummary>(() => {
    const records = (window.__PATH_EDITOR_PERF__?.records ?? []).filter(
      (record) => record.phase !== 'mount',
    );
    const sumById = (id: string): number => {
      return records
        .filter((record) => record.id === id)
        .reduce((sum, record) => sum + record.actualDuration, 0);
    };

    return {
      scenario: 'pointer-drag',
      sampleCount: records.length,
      totalActualDuration: records.reduce(
        (sum, record) => sum + record.actualDuration,
        0,
      ),
      maxActualDuration: records.reduce(
        (max, record) => Math.max(max, record.actualDuration),
        0,
      ),
      canvasShellActualDuration: sumById('canvas-shell'),
      sidebarActualDuration: sumById('sidebar'),
      pathDetailsActualDuration: sumById('path-details'),
    };
  });

  await page.evaluate(() => {
    window.__PATH_EDITOR_PERF__?.clearRecords();
  });

  for (let index = 0; index < 10; index += 1) {
    await page.mouse.move(canvasBox.x + 460, canvasBox.y + 280);
    await page.mouse.wheel(0, -180);
  }
  await flushFrames(page);

  const wheelSummary = await page.evaluate<[], BenchmarkSummary>(() => {
    const records = (window.__PATH_EDITOR_PERF__?.records ?? []).filter(
      (record) => record.phase !== 'mount',
    );
    const sumById = (id: string): number => {
      return records
        .filter((record) => record.id === id)
        .reduce((sum, record) => sum + record.actualDuration, 0);
    };

    return {
      scenario: 'wheel-zoom',
      sampleCount: records.length,
      totalActualDuration: records.reduce(
        (sum, record) => sum + record.actualDuration,
        0,
      ),
      maxActualDuration: records.reduce(
        (max, record) => Math.max(max, record.actualDuration),
        0,
      ),
      canvasShellActualDuration: sumById('canvas-shell'),
      sidebarActualDuration: sumById('sidebar'),
      pathDetailsActualDuration: sumById('path-details'),
    };
  });

  test.info().annotations.push({
    type: 'benchmark',
    description: JSON.stringify({ pointerSummary, wheelSummary }),
  });

  expect(pointerSummary.maxActualDuration).toBeLessThan(40);
  expect(wheelSummary.maxActualDuration).toBeLessThan(360);
  expect(wheelSummary.sidebarActualDuration).toBeLessThan(5);
});
