import { createPoint } from '../../domain/models';
import { createInitialDomainState } from '../../store/slices/domainSlice';
import { createInitialUiState } from '../../store/slices/uiSlice';
import { deserializeWorkspace, serializeWorkspace } from '../../io/workspaceIO';

describe('workspace IO', () => {
  it('serializes and deserializes persisted workspace state', () => {
    const domain = createInitialDomainState();
    const ui = createInitialUiState();
    const pathId = domain.activePathId;
    const sourceLibraryPoint = createPoint({
      x: 0,
      y: 0,
      isLibrary: true,
      name: 'Library Point',
    });
    domain.points.push(sourceLibraryPoint);
    const libraryPointId = sourceLibraryPoint.id;

    const firstPath = domain.paths[0];
    if (firstPath === undefined) {
      throw new Error('path missing for test');
    }

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
        libraryPointId,
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

    const persisted = {
      domain,
      ui: {
        mode: ui.mode,
        tool: ui.tool,
        canvasTransform: ui.canvasTransform,
        selection: {
          pathId,
          waypointId: null,
          headingKeyframeId: null,
          sectionIndex: 0,
        },
        backgroundImage: ui.backgroundImage,
        robotPreviewEnabled: ui.robotPreviewEnabled,
        robotSettings: ui.robotSettings,
      },
    };

    const serialized = serializeWorkspace(persisted);
    const payload = JSON.parse(serialized) as {
      version: number;
      coordinateSystem: string;
    };
    const restored = deserializeWorkspace(serialized);

    expect(payload.version).toBe(1);
    expect(payload.coordinateSystem).toBe('ros-x-up-y-left');
    expect(restored.domain.paths).toHaveLength(persisted.domain.paths.length);
    expect(restored.domain.activePathId).toBe(persisted.domain.activePathId);
    expect(restored.domain.paths[0]?.sectionRMin[0]).toBe(0.055);
    expect(restored.domain.paths[0]?.waypoints[0]?.libraryPointId).toBe(
      libraryPointId,
    );
    expect(restored.domain.paths[0]?.headingKeyframes).toHaveLength(2);
    expect(restored.ui.selection.sectionIndex).toBe(0);
  });

  it('throws when format version is invalid', () => {
    const payload = JSON.stringify({
      version: 99,
      coordinateSystem: 'ros-x-up-y-left',
      workspace: {
        domain: createInitialDomainState(),
        ui: {
          mode: createInitialUiState().mode,
          tool: createInitialUiState().tool,
          selection: createInitialUiState().selection,
          canvasTransform: createInitialUiState().canvasTransform,
          backgroundImage: createInitialUiState().backgroundImage,
          robotPreviewEnabled: createInitialUiState().robotPreviewEnabled,
          robotSettings: createInitialUiState().robotSettings,
        },
      },
    });
    expect(() => deserializeWorkspace(payload)).toThrow();
  });

  it('preserves null section rMin as auto on deserialize', () => {
    const domain = createInitialDomainState();
    const ui = createInitialUiState();
    const firstPath = domain.paths[0];
    const sourceLibraryPoint = createPoint({
      x: 0,
      y: 0,
      isLibrary: true,
      name: 'Library Point',
    });
    domain.points.push(sourceLibraryPoint);
    const libraryPointId = sourceLibraryPoint.id;

    if (firstPath === undefined) {
      throw new Error('workspace fixture missing');
    }

    const linkedPoint = createPoint({
      id: 'pt-linked-auto',
      x: sourceLibraryPoint.x,
      y: sourceLibraryPoint.y,
      robotHeading: null,
      isLibrary: false,
      name: sourceLibraryPoint.name,
    });

    const detachedPoint = createPoint({
      id: 'pt-auto',
      x: 1.6,
      y: 0.8,
      robotHeading: null,
      isLibrary: false,
      name: 'WB',
    });
    domain.points.push(linkedPoint, detachedPoint);

    firstPath.waypoints = [
      {
        id: 'wa',
        pointId: linkedPoint.id,
        libraryPointId,
        pathHeading: 0,
      },
      {
        id: 'wb',
        pointId: detachedPoint.id,
        libraryPointId: null,
        pathHeading: 30,
      },
    ];
    firstPath.headingKeyframes = [
      {
        id: 'auto-start',
        sectionIndex: 0,
        sectionRatio: 0,
        robotHeading: 0,
        name: 'Start H',
      },
      {
        id: 'auto-end',
        sectionIndex: 0,
        sectionRatio: 1,
        robotHeading: 30,
        name: 'End H',
      },
    ];
    firstPath.sectionRMin = [null];

    const persisted = {
      domain,
      ui: {
        mode: ui.mode,
        tool: ui.tool,
        canvasTransform: ui.canvasTransform,
        selection: {
          pathId: domain.activePathId,
          waypointId: null,
          headingKeyframeId: null,
          sectionIndex: 0,
        },
        backgroundImage: ui.backgroundImage,
        robotPreviewEnabled: ui.robotPreviewEnabled,
        robotSettings: ui.robotSettings,
      },
    };

    const restored = deserializeWorkspace(serializeWorkspace(persisted));

    expect(restored.domain.paths[0]?.sectionRMin[0]).toBeNull();
  });

  it('preserves non-null background image fields through round-trip', () => {
    const domain = createInitialDomainState();
    const ui = createInitialUiState();

    const persisted = {
      domain,
      ui: {
        mode: ui.mode,
        tool: 'edit-image' as const,
        canvasTransform: ui.canvasTransform,
        selection: ui.selection,
        backgroundImage: {
          url: 'data:image/png;base64,dGVzdA==',
          width: 640,
          height: 360,
          x: 1.25,
          y: -2.5,
          scale: 0.75,
          alpha: 0.35,
        },
        robotPreviewEnabled: false,
        robotSettings: {
          ...ui.robotSettings,
          length: 1.1,
          width: 0.85,
          maxVelocity: 3.2,
        },
      },
    };

    const restored = deserializeWorkspace(serializeWorkspace(persisted));

    expect(restored.ui.backgroundImage).not.toBeNull();
    expect(restored.ui.backgroundImage?.x).toBe(1.25);
    expect(restored.ui.backgroundImage?.y).toBe(-2.5);
    expect(restored.ui.backgroundImage?.scale).toBe(0.75);
    expect(restored.ui.backgroundImage?.alpha).toBe(0.35);
    expect(restored.ui.backgroundImage?.width).toBe(640);
    expect(restored.ui.backgroundImage?.height).toBe(360);
    expect(restored.ui.robotPreviewEnabled).toBe(false);
    expect(restored.ui.robotSettings.length).toBe(1.1);
    expect(restored.ui.robotSettings.width).toBe(0.85);
    expect(restored.ui.robotSettings.maxVelocity).toBe(3.2);
  });

  it('normalizes linked local point names to the library name on deserialize', () => {
    const domain = createInitialDomainState();
    const ui = createInitialUiState();
    const firstPath = domain.paths[0];

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

    domain.points.push(libraryPoint, linkedPoint);
    firstPath.waypoints = [
      {
        id: 'linked-waypoint',
        pointId: linkedPoint.id,
        libraryPointId: libraryPoint.id,
        pathHeading: 0,
      },
    ];

    const payload = JSON.stringify({
      version: 1,
      coordinateSystem: 'ros-x-up-y-left',
      workspace: {
        domain,
        ui: {
          mode: ui.mode,
          tool: ui.tool,
          selection: ui.selection,
          canvasTransform: ui.canvasTransform,
          backgroundImage: ui.backgroundImage,
          robotPreviewEnabled: ui.robotPreviewEnabled,
          robotSettings: ui.robotSettings,
        },
      },
    });

    const restored = deserializeWorkspace(payload);
    const restoredLinkedPoint = restored.domain.points.find(
      (point) => point.id === linkedPoint.id,
    );

    expect(restoredLinkedPoint?.name).toBe('Canonical Library Name');
  });

  it('rejects payloads with a different coordinate system marker', () => {
    const payload = JSON.stringify({
      version: 1,
      coordinateSystem: 'screen-x-right-y-down',
      workspace: {
        domain: createInitialDomainState(),
        ui: {
          mode: createInitialUiState().mode,
          tool: createInitialUiState().tool,
          selection: createInitialUiState().selection,
          canvasTransform: createInitialUiState().canvasTransform,
          backgroundImage: createInitialUiState().backgroundImage,
          robotPreviewEnabled: createInitialUiState().robotPreviewEnabled,
          robotSettings: createInitialUiState().robotSettings,
        },
      },
    });

    expect(() => deserializeWorkspace(payload)).toThrow();
  });

  it('normalizes invalid robot settings on deserialize', () => {
    const ui = createInitialUiState();
    const payload = JSON.stringify({
      version: 1,
      coordinateSystem: 'ros-x-up-y-left',
      workspace: {
        domain: createInitialDomainState(),
        ui: {
          mode: ui.mode,
          tool: ui.tool,
          selection: ui.selection,
          canvasTransform: ui.canvasTransform,
          backgroundImage: ui.backgroundImage,
          robotPreviewEnabled: ui.robotPreviewEnabled,
          robotSettings: {
            length: -1,
            width: 0,
            acceleration: Number.NaN,
            deceleration: -3,
            maxVelocity: 0,
            centripetalAcceleration: Number.POSITIVE_INFINITY,
          },
        },
      },
    });

    const restored = deserializeWorkspace(payload);

    expect(restored.ui.robotSettings.length).toBeGreaterThan(0);
    expect(restored.ui.robotSettings.width).toBeGreaterThan(0);
    expect(restored.ui.robotSettings.acceleration).toBeGreaterThan(0);
    expect(restored.ui.robotSettings.deceleration).toBeGreaterThan(0);
    expect(restored.ui.robotSettings.maxVelocity).toBeGreaterThan(0);
    expect(restored.ui.robotSettings.centripetalAcceleration).toBeGreaterThan(
      0,
    );
  });
});
