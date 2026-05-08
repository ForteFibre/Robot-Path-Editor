import { describe, expect, it } from 'vitest';
import {
  createHeadingKeyframe,
  createLibraryPoint,
  createPath,
  createPoint,
  createWaypoint,
} from '../../domain/factories';
import type { WorkspaceDomainState } from '../../domain/workspaceContract';
import { generatePathSetV1 } from '../../io/pathSetExport';

const toRad = (deg: number): number => (deg * Math.PI) / 180;

describe('generatePathSetV1', () => {
  const normalizedNegative90 = toRad(270);

  it('outputs a line command for a straight section', () => {
    const p1 = createPoint({ name: 'P1', x: 0, y: 0, robotHeading: 0 });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: 0 });
    const path = createPath(0);
    path.name = 'TestPath';
    path.waypoints = [
      createWaypoint({ pointId: p1.id, pathHeading: 0 }),
      createWaypoint({ pointId: p2.id, pathHeading: 0 }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [p1, p2],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);

    expect(result.$schema).toBe(
      'https://fibril-path-editor.fortefibre.net/schemas/path-set-v1.schema.json',
    );
    expect(result.schema_version).toBe(1);
    expect(result.units).toEqual({ length: 'm', angle: 'rad' });

    const pathDef = result.paths.TestPath;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    expect(pathDef.sections).toHaveLength(1);

    const section = pathDef.sections[0];
    expect(section).toBeDefined();
    if (section === undefined) {
      throw new Error('expected section');
    }
    expect(section.from).toBe('TestPath/P1');
    expect(section.to).toBe('TestPath/P2');
    expect(section.path_heading_start).toBeCloseTo(0);
    expect(section.motion).toEqual([{ type: 'line', distance: 10 }]);
  });

  it('keeps library point names unchanged', () => {
    const lib = createLibraryPoint('LibraryA', {
      x: 0,
      y: 0,
      robotHeading: 0,
    });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: 0 });
    const path = createPath(0);
    path.name = 'Path1';
    path.waypoints = [
      createWaypoint({
        pointId: lib.id,
        libraryPointId: lib.id,
        pathHeading: 0,
      }),
      createWaypoint({ pointId: p2.id, pathHeading: 0 }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [lib, p2],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);
    expect(result.points.LibraryA).toBeDefined();
    expect(result.points['Path1/P2']).toBeDefined();

    const pathDef = result.paths.Path1;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    const section = pathDef.sections[0];
    expect(section).toBeDefined();
    if (section === undefined) {
      throw new Error('expected section');
    }
    expect(section.from).toBe('LibraryA');
    expect(section.to).toBe('Path1/P2');
  });

  it('keeps null robotHeading waypoints out of explicit heading endpoints', () => {
    const p1 = createPoint({ name: 'P1', x: 0, y: 0, robotHeading: -90 });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: null });
    const p3 = createPoint({ name: 'P3', x: 20, y: 0, robotHeading: -90 });
    const path = createPath(0);
    path.name = 'Path1';
    path.waypoints = [
      createWaypoint({ pointId: p1.id, pathHeading: 0 }),
      createWaypoint({ pointId: p2.id, pathHeading: 0 }),
      createWaypoint({ pointId: p3.id, pathHeading: 0 }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [p1, p2, p3],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);
    const pathDef = result.paths.Path1;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    const firstSection = pathDef.sections[0];
    const secondSection = pathDef.sections[1];
    expect(firstSection).toBeDefined();
    expect(secondSection).toBeDefined();
    if (firstSection === undefined || secondSection === undefined) {
      throw new Error('expected sections');
    }
    expect(firstSection.robot_heading).toEqual([
      {
        progress: 0,
        heading: normalizedNegative90,
      },
      {
        progress: 1,
        heading: normalizedNegative90,
      },
    ]);
    expect(secondSection.robot_heading).toEqual([
      {
        progress: 0,
        heading: normalizedNegative90,
      },
      {
        progress: 1,
        heading: normalizedNegative90,
      },
    ]);
    expect(result.points['Path1/P2']).toEqual({
      x: 10,
      y: 0,
      robot_heading: normalizedNegative90,
    });
  });

  it('falls back to pathHeading only when no robot heading keyframes exist', () => {
    const p1 = createPoint({ name: 'P1', x: 0, y: 0, robotHeading: null });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: null });
    const path = createPath(0);
    path.name = 'Path1';
    path.waypoints = [
      createWaypoint({ pointId: p1.id, pathHeading: 90 }),
      createWaypoint({ pointId: p2.id, pathHeading: 90 }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [p1, p2],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);
    const pathDef = result.paths.Path1;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    const section = pathDef.sections[0];
    expect(section).toBeDefined();
    if (section === undefined) {
      throw new Error('expected section');
    }
    expect(section.robot_heading).toHaveLength(2);
    expect(section.robot_heading?.[0]).toEqual({
      progress: 0,
      heading: toRad(90),
    });
    expect(section.robot_heading?.[1]).toEqual({
      progress: 1,
      heading: toRad(90),
    });
    expect(result.points['Path1/P1']?.robot_heading).toBeCloseTo(toRad(90));
    expect(result.points['Path1/P2']?.robot_heading).toBeCloseTo(toRad(90));
  });

  it('includes explicit heading keyframes in robot_heading profile', () => {
    const p1 = createPoint({ name: 'P1', x: 0, y: 0, robotHeading: 0 });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: 0 });
    const path = createPath(0);
    path.name = 'Path1';
    path.waypoints = [
      createWaypoint({ pointId: p1.id, pathHeading: 0 }),
      createWaypoint({ pointId: p2.id, pathHeading: 0 }),
    ];
    path.headingKeyframes = [
      createHeadingKeyframe({
        sectionIndex: 0,
        sectionRatio: 0.5,
        robotHeading: 45,
      }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [p1, p2],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);
    const pathDef = result.paths.Path1;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    const section = pathDef.sections[0];
    expect(section).toBeDefined();
    if (section === undefined) {
      throw new Error('expected section');
    }
    expect(section.robot_heading).toBeDefined();
    expect(section.robot_heading).toHaveLength(3);
    expect(section.robot_heading).toContainEqual({
      progress: 0.5,
      heading: toRad(45),
    });
  });

  it('outputs arc commands for a curved section', () => {
    const p1 = createPoint({ name: 'P1', x: 0, y: 0, robotHeading: 0 });
    const p2 = createPoint({ name: 'P2', x: 10, y: 0, robotHeading: 0 });
    const path = createPath(0);
    path.name = 'CurvedPath';
    path.waypoints = [
      createWaypoint({ pointId: p1.id, pathHeading: 0 }),
      createWaypoint({ pointId: p2.id, pathHeading: 90 }),
    ];

    const domain: WorkspaceDomainState = {
      paths: [path],
      points: [p1, p2],
      lockedPointIds: [],
      activePathId: path.id,
    };

    const result = generatePathSetV1(domain);
    const pathDef = result.paths.CurvedPath;
    expect(pathDef).toBeDefined();
    if (pathDef === undefined) {
      throw new Error('expected pathDef');
    }
    const section = pathDef.sections[0];
    expect(section).toBeDefined();
    if (section === undefined) {
      throw new Error('expected section');
    }
    expect(section.motion.length).toBeGreaterThan(0);
    expect(section.motion.some((cmd) => cmd.type === 'arc')).toBe(true);
  });
});
