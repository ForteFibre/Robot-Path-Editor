import { createPoint } from '../../domain/factories';
import { type WorkspaceDocument } from '../../domain/workspaceContract';
import {
  deserializeWorkspace,
  serializeWorkspace,
} from '../../io/workspaceCodec';
import { createInitialDomainState } from '../../store/slices/pathSlice';
import { createInitialUiState } from '../../store/slices/uiSlice';

const createWorkspaceDocumentFixture = (): WorkspaceDocument => {
  const domain = createInitialDomainState();
  const firstPath = domain.paths[0];
  const ui = createInitialUiState();

  if (firstPath === undefined) {
    throw new Error('path missing for test');
  }

  const sourceLibraryPoint = createPoint({
    x: 0,
    y: 0,
    isLibrary: true,
    name: 'Library Point',
  });
  domain.points.push(sourceLibraryPoint);

  const linkedPoint = createPoint({
    id: 'pt-1',
    x: sourceLibraryPoint.x,
    y: sourceLibraryPoint.y,
    robotHeading: null,
    isLibrary: false,
    name: sourceLibraryPoint.name,
  });

  const detachedPoint = createPoint({
    id: 'pt-2',
    x: 0.8,
    y: 0.4,
    robotHeading: null,
    isLibrary: false,
    name: 'WP 2',
  });

  domain.points.push(linkedPoint, detachedPoint);

  firstPath.waypoints = [
    {
      id: 'w1',
      pointId: linkedPoint.id,
      libraryPointId: sourceLibraryPoint.id,
      pathHeading: 0,
    },
    {
      id: 'w2',
      pointId: detachedPoint.id,
      libraryPointId: null,
      pathHeading: 45,
    },
  ];
  firstPath.headingKeyframes = [
    {
      id: 'start-h',
      sectionIndex: 0,
      sectionRatio: 0,
      robotHeading: 0,
      name: 'Start H',
    },
    {
      id: 'end-h',
      sectionIndex: 0,
      sectionRatio: 1,
      robotHeading: 60,
      name: 'End H',
    },
  ];
  firstPath.sectionRMin = [0.055];

  return {
    domain,
    backgroundImage: {
      url: 'data:image/png;base64,d29ya3NwYWNlLWJhY2tncm91bmQ=',
      width: 640,
      height: 360,
      x: 1.25,
      y: -2.5,
      scale: 0.75,
      alpha: 0.35,
    },
    robotSettings: {
      ...ui.robotSettings,
      length: 1.1,
      width: 0.85,
      maxVelocity: 3.2,
    },
  };
};

describe('workspace codec', () => {
  it('serializes and deserializes file workspace documents', () => {
    const document = createWorkspaceDocumentFixture();

    const serialized = serializeWorkspace(document);
    const payload = JSON.parse(serialized) as {
      version: number;
      coordinateSystem: string;
      document: WorkspaceDocument;
    };
    const restored = deserializeWorkspace(serialized);

    expect(payload.version).toBe(1);
    expect(payload.coordinateSystem).toBe('ros-x-up-y-left');
    expect(payload).toHaveProperty('document');
    expect(payload).not.toHaveProperty('workspace');
    expect(payload.document.domain.paths).toHaveLength(
      document.domain.paths.length,
    );
    expect(restored.domain.activePathId).toBe(document.domain.activePathId);
    expect(restored.domain.paths[0]?.sectionRMin[0]).toBe(0.055);
    expect(restored.domain.paths[0]?.waypoints[0]?.libraryPointId).toBe(
      document.domain.points[0]?.id,
    );
    expect(restored.domain.paths[0]?.headingKeyframes).toHaveLength(2);
    expect(restored.robotSettings.length).toBe(1.1);
    expect(restored.robotSettings.width).toBe(0.85);
    expect(restored.robotSettings.maxVelocity).toBe(3.2);
    expect(restored.backgroundImage).toEqual(document.backgroundImage);
  });

  it('throws when format version is invalid', () => {
    const payload = JSON.stringify({
      version: 99,
      coordinateSystem: 'ros-x-up-y-left',
      document: createWorkspaceDocumentFixture(),
    });

    expect(() => deserializeWorkspace(payload)).toThrow();
  });

  it('preserves null section rMin as auto on deserialize', () => {
    const document = createWorkspaceDocumentFixture();
    const firstPath = document.domain.paths[0];

    if (firstPath === undefined) {
      throw new Error('workspace fixture missing');
    }

    firstPath.sectionRMin = [null];

    const restored = deserializeWorkspace(serializeWorkspace(document));

    expect(restored.domain.paths[0]?.sectionRMin[0]).toBeNull();
  });

  it('persists document backgroundImage but not UI session fields in file exports', () => {
    const serialized = serializeWorkspace(createWorkspaceDocumentFixture());

    expect(serialized).toContain('"document"');
    expect(serialized).toContain('"backgroundImage"');
    expect(serialized).not.toContain('"selection"');
    expect(serialized).not.toContain('"canvasTransform"');
    expect(serialized).not.toContain('"robotPreviewEnabled"');
  });

  it('normalizes linked local point names to the library name on deserialize', () => {
    const document = createWorkspaceDocumentFixture();
    const firstPath = document.domain.paths[0];

    if (firstPath === undefined) {
      throw new Error('workspace fixture missing');
    }

    const libraryPoint = createPoint({
      id: 'library-point',
      x: 0,
      y: 0,
      robotHeading: null,
      isLibrary: true,
      name: 'Canonical Library Name',
    });
    const linkedPoint = createPoint({
      id: 'linked-point',
      x: 0,
      y: 0,
      robotHeading: null,
      isLibrary: false,
      name: 'Stale Local Name',
    });

    document.domain.points = [libraryPoint, linkedPoint];
    firstPath.waypoints = [
      {
        id: 'linked-waypoint',
        pointId: linkedPoint.id,
        libraryPointId: libraryPoint.id,
        pathHeading: 0,
      },
    ];

    const restored = deserializeWorkspace(serializeWorkspace(document));
    const restoredLinkedPoint = restored.domain.points.find(
      (point) => point.id === linkedPoint.id,
    );

    expect(restoredLinkedPoint?.name).toBe('Canonical Library Name');
  });

  it('rejects payloads with a different coordinate system marker', () => {
    const payload = JSON.stringify({
      version: 1,
      coordinateSystem: 'screen-x-right-y-down',
      document: createWorkspaceDocumentFixture(),
    });

    expect(() => deserializeWorkspace(payload)).toThrow();
  });

  it('normalizes invalid robot settings on deserialize', () => {
    const payload = JSON.stringify({
      version: 1,
      coordinateSystem: 'ros-x-up-y-left',
      document: {
        ...createWorkspaceDocumentFixture(),
        robotSettings: {
          length: -1,
          width: 0,
          acceleration: Number.NaN,
          deceleration: -3,
          maxVelocity: 0,
          centripetalAcceleration: Number.POSITIVE_INFINITY,
        },
      },
    });

    const restored = deserializeWorkspace(payload);

    expect(restored.robotSettings.length).toBeGreaterThan(0);
    expect(restored.robotSettings.width).toBeGreaterThan(0);
    expect(restored.robotSettings.acceleration).toBeGreaterThan(0);
    expect(restored.robotSettings.deceleration).toBeGreaterThan(0);
    expect(restored.robotSettings.maxVelocity).toBeGreaterThan(0);
    expect(restored.robotSettings.centripetalAcceleration).toBeGreaterThan(0);
  });
});
