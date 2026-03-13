import {
  discretizePath,
  discretizePathDetailed,
  resolveDiscretizedHeadingKeyframes,
} from '../../domain/interpolation';
import {
  projectPointToPathSections,
  getSectionPositionPoint,
} from '../../domain/headingKeyframes';
import {
  createPointIndex,
  resolvePathModel,
} from '../../domain/pointResolution';
import {
  DEFAULT_CSV_EXPORT_STEP,
  MIN_RENDER_STEP,
} from '../../domain/metricScale';
import type { CsvWorkspaceSource } from '../../domain/workspaceContract';
import { generateWorkspaceCsvFiles } from '../../io/csv';
import type { PathModel, Point } from '../../domain/models';

const createPoints = (
  robotHeadings: [number | null, number | null, number | null] = [0, 180, 180],
): Point[] => {
  return [
    {
      id: 'p1',
      x: 0,
      y: 0,
      robotHeading: robotHeadings[0],
      isLibrary: false,
      name: 'WP 1',
    },
    {
      id: 'p2',
      x: 1,
      y: 0,
      robotHeading: robotHeadings[1],
      isLibrary: false,
      name: 'WP 2',
    },
    {
      id: 'p3',
      x: 2,
      y: 0,
      robotHeading: robotHeadings[2],
      isLibrary: false,
      name: 'WP 3',
    },
  ];
};

const points = createPoints();

const basePath: PathModel = {
  id: 'path-1',
  name: 'Path 1',
  color: '#000000',
  visible: true,
  waypoints: [
    {
      id: 'w1',
      pointId: 'p1',
      libraryPointId: null,
      pathHeading: 0,
    },
    {
      id: 'w2',
      pointId: 'p2',
      libraryPointId: null,
      pathHeading: 0,
    },
  ],
  headingKeyframes: [
    {
      id: 'start',
      sectionIndex: 0,
      sectionRatio: 0,
      robotHeading: 0,
      name: 'Start H',
    },
    {
      id: 'end',
      sectionIndex: 0,
      sectionRatio: 1,
      robotHeading: 180,
      name: 'End H',
    },
  ],
  sectionRMin: [0.35],
};

describe('interpolation and csv', () => {
  it('discretizes path and interpolates robot headings from heading keyframes', () => {
    const samples = discretizePath(basePath, points, 0.05);

    expect(samples.length).toBeGreaterThan(3);
    expect(samples[0]?.robotHeading).toBeCloseTo(0, 6);
    expect(samples.at(-1)?.robotHeading).toBeCloseTo(180, 6);
  });

  it('uses path heading when only boundary heading keyframes exist', () => {
    const autoPoints = createPoints([null, null, null]);
    const path: PathModel = {
      ...basePath,
      waypoints: [
        {
          id: 'w1',
          pointId: 'p1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w2',
          pointId: 'p2',
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [
        {
          id: 'start',
          sectionIndex: 0,
          sectionRatio: 0,
          robotHeading: 0,
          name: 'Start H',
        },
        {
          id: 'end',
          sectionIndex: 0,
          sectionRatio: 1,
          robotHeading: 0,
          name: 'End H',
        },
      ],
    };

    const samples = discretizePath(path, autoPoints, 0.05);

    expect(
      samples.every((sample) => sample.robotHeading === sample.pathHeading),
    ).toBe(true);
  });

  it('lets manual heading keyframes influence only robot heading interpolation', () => {
    const pointsWithWaypointHeadings = createPoints([0, null, 180]);
    const path: PathModel = {
      ...basePath,
      waypoints: [
        {
          id: 'w1',
          pointId: 'p1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w2',
          pointId: 'p2',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w3',
          pointId: 'p3',
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      sectionRMin: [null, null],
      headingKeyframes: [
        {
          id: 'manual',
          sectionIndex: 0,
          sectionRatio: 0.5,
          robotHeading: 90,
          name: 'HK 1',
        },
      ],
    };

    const samples = discretizePath(path, pointsWithWaypointHeadings, 0.05);
    const midpoint = samples[Math.floor(samples.length / 2)];

    if (midpoint === undefined) {
      throw new Error('expected midpoint sample');
    }

    expect(midpoint.robotHeading).toBeGreaterThan(45);
    expect(midpoint.robotHeading).toBeLessThan(135);
    expect(midpoint.pathHeading).toBe(0);
  });

  it('exports csv files with the x,y,theta header', () => {
    const domain: CsvWorkspaceSource = {
      paths: [basePath],
      points,
      activePathId: basePath.id,
    };

    const [file] = generateWorkspaceCsvFiles(domain, {
      step: DEFAULT_CSV_EXPORT_STEP,
      target: 'all',
    });
    const [header, firstRow] = file?.content.trim().split('\n') ?? [];

    expect(file).toBeDefined();
    expect(header).toBe('x,y,theta');
    expect(firstRow?.split(',').length).toBe(3);
  });

  it('exports theta in radians', () => {
    const domain: CsvWorkspaceSource = {
      paths: [basePath],
      points,
      activePathId: basePath.id,
    };

    const [file] = generateWorkspaceCsvFiles(domain, {
      step: DEFAULT_CSV_EXPORT_STEP,
      target: 'active',
    });
    const rows = file?.content.trim().split('\n') ?? [];
    const lastTheta = Number(rows.at(-1)?.split(',')[2]);

    expect(lastTheta).toBeCloseTo(Math.PI, 3);
  });

  it('exports hidden paths when they have waypoints', () => {
    const hiddenPath: PathModel = {
      ...basePath,
      id: 'hidden-path',
      name: 'Hidden Path',
      visible: false,
    };

    const domain: CsvWorkspaceSource = {
      paths: [hiddenPath],
      points,
      activePathId: hiddenPath.id,
    };

    const [file] = generateWorkspaceCsvFiles(domain, {
      step: DEFAULT_CSV_EXPORT_STEP,
      target: 'all',
    });

    expect(file).toMatchObject({
      pathId: hiddenPath.id,
      pathName: hiddenPath.name,
      filename: 'hidden-path.csv',
    });
  });

  it('supports csv target=active and exports only one file for the active path', () => {
    const secondPath: PathModel = {
      ...basePath,
      id: 'path-2',
      name: 'Path 2',
      waypoints: [
        {
          id: 'w3',
          pointId: 'p2',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w4',
          pointId: 'p3',
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [
        {
          id: 'start-2',
          sectionIndex: 0,
          sectionRatio: 0,
          robotHeading: 180,
          name: 'Start H',
        },
        {
          id: 'end-2',
          sectionIndex: 0,
          sectionRatio: 1,
          robotHeading: 180,
          name: 'End H',
        },
      ],
    };

    const domain: CsvWorkspaceSource = {
      paths: [basePath, secondPath],
      points,
      activePathId: basePath.id,
    };

    const activeFiles = generateWorkspaceCsvFiles(domain, {
      target: 'active',
      step: 0.5,
    });
    const denseFiles = generateWorkspaceCsvFiles(domain, {
      target: 'active',
      step: 0.05,
    });

    expect(activeFiles).toHaveLength(1);
    expect(activeFiles[0]).toMatchObject({
      pathId: basePath.id,
      pathName: basePath.name,
      filename: 'path-1.csv',
    });
    expect(denseFiles[0]?.content.trim().split('\n').length).toBeGreaterThan(
      activeFiles[0]?.content.trim().split('\n').length ?? 0,
    );
  });

  it('supports csv target=all and exports one file per path with path-based filenames', () => {
    const secondPath: PathModel = {
      ...basePath,
      id: 'path-2',
      name: 'Path 1',
      waypoints: [
        {
          id: 'w3',
          pointId: 'p2',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w4',
          pointId: 'p3',
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [
        {
          id: 'start-2',
          sectionIndex: 0,
          sectionRatio: 0,
          robotHeading: 180,
          name: 'Start H',
        },
        {
          id: 'end-2',
          sectionIndex: 0,
          sectionRatio: 1,
          robotHeading: 180,
          name: 'End H',
        },
      ],
    };

    const thirdPath: PathModel = {
      ...basePath,
      id: 'path-3',
      name: '  !!!  ',
      waypoints: [
        {
          id: 'w5',
          pointId: 'p1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'w6',
          pointId: 'p3',
          libraryPointId: null,
          pathHeading: 0,
        },
      ],
      headingKeyframes: [
        {
          id: 'start-3',
          sectionIndex: 0,
          sectionRatio: 0,
          robotHeading: 90,
          name: 'Start H',
        },
        {
          id: 'end-3',
          sectionIndex: 0,
          sectionRatio: 1,
          robotHeading: 90,
          name: 'End H',
        },
      ],
    };

    const domain: CsvWorkspaceSource = {
      paths: [basePath, secondPath, thirdPath],
      points,
      activePathId: basePath.id,
    };

    const files = generateWorkspaceCsvFiles(domain, {
      target: 'all',
      step: 0.5,
    });

    expect(files).toHaveLength(3);
    expect(files.map((file) => file.filename)).toEqual([
      'path-1.csv',
      'path-1-2.csv',
      'path.csv',
    ]);
  });

  it('produces denser samples for high zoom render steps', () => {
    const coarse = discretizePath(basePath, points, 0.08);
    const dense = discretizePath(basePath, points, MIN_RENDER_STEP);

    expect(dense.length).toBeGreaterThan(coarse.length);
  });

  it('produces section sample ranges aligned with path samples', () => {
    const detail = discretizePathDetailed(basePath, points, 0.05);
    const firstSection = detail.sectionSampleRanges[0];

    expect(firstSection).toBeDefined();
    expect(firstSection?.startSampleIndex).toBe(0);
    expect((firstSection?.endSampleIndex ?? 0) + 1).toBeLessThanOrEqual(
      detail.samples.length,
    );
  });

  it('reuses discretized detail when a path is recreated without geometric changes', () => {
    const firstDetail = discretizePathDetailed(basePath, points, 0.05);
    const equivalentPath: PathModel = {
      ...basePath,
      name: 'Renamed Path',
      color: '#ff00aa',
      waypoints: [...basePath.waypoints],
      headingKeyframes: basePath.headingKeyframes.map((keyframe) => ({
        ...keyframe,
        name: `${keyframe.name} updated`,
      })),
      sectionRMin: [...basePath.sectionRMin],
    };

    const secondDetail = discretizePathDetailed(equivalentPath, points, 0.05);

    expect(secondDetail).toBe(firstDetail);
  });

  it('reuses discretized detail when unrelated points change elsewhere', () => {
    const firstDetail = discretizePathDetailed(basePath, points, 0.05);
    const pointsWithUnrelatedWaypoint = [
      ...points,
      {
        id: 'unrelated',
        x: 9,
        y: 9,
        robotHeading: null,
        isLibrary: false,
        name: 'Unrelated',
      },
    ];

    const secondDetail = discretizePathDetailed(
      { ...basePath, waypoints: [...basePath.waypoints] },
      pointsWithUnrelatedWaypoint,
      0.05,
    );

    expect(secondDetail).toBe(firstDetail);
  });

  it('reuses discretized detail when the points array is recreated with the same point references', () => {
    const firstDetail = discretizePathDetailed(basePath, points, 0.05);
    const equivalentPath: PathModel = {
      ...basePath,
      waypoints: [...basePath.waypoints],
      headingKeyframes: [...basePath.headingKeyframes],
      sectionRMin: [...basePath.sectionRMin],
    };

    const secondDetail = discretizePathDetailed(
      equivalentPath,
      [...points],
      0.05,
    );

    expect(secondDetail).toBe(firstDetail);
  });

  it('invalidates discretized detail when a referenced point changes', () => {
    const firstDetail = discretizePathDetailed(basePath, points, 0.05);
    const movedPoints = points.map((point) =>
      point.id === 'p2' ? { ...point, x: point.x + 1 } : point,
    );

    const secondDetail = discretizePathDetailed(basePath, movedPoints, 0.05);

    expect(secondDetail).not.toBe(firstDetail);
  });

  it('resolves heading keyframe positions on the discretized curve', () => {
    const curvedPoints: Point[] = [
      {
        id: 'cp1',
        x: 0,
        y: 0,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 1',
      },
      {
        id: 'cp2',
        x: 1,
        y: 1,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 2',
      },
    ];
    const curvedPath: PathModel = {
      ...basePath,
      waypoints: [
        {
          id: 'cw1',
          pointId: 'cp1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'cw2',
          pointId: 'cp2',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [
        {
          id: 'curve-mid',
          sectionIndex: 0,
          sectionRatio: 0.5,
          robotHeading: 45,
          name: 'HK 1',
        },
      ],
      sectionRMin: [0.35],
    };

    const detail = discretizePathDetailed(curvedPath, curvedPoints, 0.02);
    const resolvedPath = resolvePathModel(
      curvedPath,
      createPointIndex(curvedPoints),
    );
    const keyframe = resolveDiscretizedHeadingKeyframes(
      resolvedPath,
      detail,
    )[0];

    expect(keyframe).toBeDefined();
    expect(keyframe?.x).not.toBeCloseTo(0.5, 2);
    expect(keyframe?.y).not.toBeCloseTo(0.5, 2);
  });

  it('projects heading points onto the visible curve instead of the straight chord', () => {
    const curvedPoints: Point[] = [
      {
        id: 'cp1',
        x: 0,
        y: 0,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 1',
      },
      {
        id: 'cp2',
        x: 1,
        y: 1,
        robotHeading: null,
        isLibrary: false,
        name: 'WP 2',
      },
    ];
    const curvedPath: PathModel = {
      ...basePath,
      waypoints: [
        {
          id: 'cw1',
          pointId: 'cp1',
          libraryPointId: null,
          pathHeading: 0,
        },
        {
          id: 'cw2',
          pointId: 'cp2',
          libraryPointId: null,
          pathHeading: 90,
        },
      ],
      headingKeyframes: [],
      sectionRMin: [0.35],
    };

    const detail = discretizePathDetailed(curvedPath, curvedPoints, 0.02);
    const midpoint = getSectionPositionPoint(detail, {
      sectionIndex: 0,
      sectionRatio: 0.5,
    });
    if (midpoint === null) {
      throw new Error('expected section midpoint');
    }

    const projected = projectPointToPathSections(detail, {
      x: midpoint.x + 0.02,
      y: midpoint.y + 0.02,
    });
    const resolved =
      projected === null ? null : getSectionPositionPoint(detail, projected);

    expect(projected).not.toBeNull();
    expect(resolved).not.toBeNull();
    expect(resolved?.x).toBeCloseTo(midpoint.x, 1);
    expect(resolved?.y).toBeCloseTo(midpoint.y, 1);
    expect(resolved?.x).not.toBeCloseTo(0.5, 2);
    expect(resolved?.y).not.toBeCloseTo(0.5, 2);
  });
});
