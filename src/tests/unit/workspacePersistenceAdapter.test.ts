import { createPoint } from '../../domain/factories';
import {
  applyWorkspaceAutosavePayload,
  applyWorkspaceDocument,
  toWorkspaceAutosavePayload,
  toWorkspaceDocument,
  toWorkspaceSession,
} from '../../store/adapters/workspacePersistence';
import { createInitialDomainState } from '../../store/slices/pathSlice';
import { createInitialUiState } from '../../store/slices/uiSlice';

describe('workspacePersistence adapter', () => {
  it('exports file documents without session-only UI fields', () => {
    const domain = createInitialDomainState();
    const ui = {
      ...createInitialUiState(),
      selectedLibraryPointId: 'library-point',
      isDragging: true,
      snapPanelOpen: true,
      mode: 'heading' as const,
      tool: 'edit-image' as const,
      robotPreviewEnabled: false,
      canvasTransform: {
        x: 10,
        y: 20,
        k: 30,
      },
      backgroundImage: {
        url: 'data:image/png;base64,dGVzdA==',
        width: 640,
        height: 360,
        x: 1,
        y: 2,
        scale: 0.5,
        alpha: 0.6,
      },
      robotSettings: {
        ...createInitialUiState().robotSettings,
        length: 1.35,
      },
    };

    const document = toWorkspaceDocument({ domain, ui });

    expect(document.domain).toEqual(domain);
    expect(document.backgroundImage).toEqual(ui.backgroundImage);
    expect(document.robotSettings.length).toBe(1.35);
    expect(document).not.toHaveProperty('mode');
    expect(document).not.toHaveProperty('tool');
    expect(document).not.toHaveProperty('selection');
    expect(document).not.toHaveProperty('canvasTransform');
    expect(document).not.toHaveProperty('robotPreviewEnabled');
  });

  it('exports autosave payloads with separated document and session data', () => {
    const domain = createInitialDomainState();
    const ui = {
      ...createInitialUiState(),
      mode: 'heading' as const,
      tool: 'edit-image' as const,
      selection: {
        pathId: domain.activePathId,
        waypointId: null,
        headingKeyframeId: null,
        sectionIndex: null,
      },
      canvasTransform: {
        x: 10,
        y: 20,
        k: 30,
      },
      backgroundImage: {
        url: 'data:image/png;base64,dGVzdA==',
        width: 640,
        height: 360,
        x: 1,
        y: 2,
        scale: 0.5,
        alpha: 0.6,
      },
      robotPreviewEnabled: false,
      robotSettings: {
        ...createInitialUiState().robotSettings,
        length: 1.4,
      },
    };

    const payload = toWorkspaceAutosavePayload({ domain, ui });

    expect(payload.document.robotSettings.length).toBe(1.4);
    expect(payload.document.backgroundImage?.width).toBe(640);
    expect(payload.session.mode).toBe('heading');
    expect(payload.session.tool).toBe('edit-image');
    expect(payload.session.canvasTransform).toEqual({ x: 10, y: 20, k: 30 });
    expect(payload.session).not.toHaveProperty('backgroundImage');
    expect(payload.session.robotPreviewEnabled).toBe(false);
  });

  it('normalizes sessions against the normalized document domain', () => {
    const domain = createInitialDomainState();
    const session = toWorkspaceSession({
      domain: {
        ...domain,
        activePathId: 'missing-path',
      },
      ui: {
        ...createInitialUiState(),
        selection: {
          pathId: 'missing-path',
          waypointId: 'missing-waypoint',
          headingKeyframeId: 'missing-heading',
          sectionIndex: 99,
        },
      },
    });

    expect(session.selection).toEqual({
      pathId: domain.activePathId,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    });
    expect(session.robotPreviewEnabled).toBe(true);
  });

  it('applies a file document with initial session defaults', () => {
    const domain = createInitialDomainState();

    const restored = applyWorkspaceDocument({
      domain,
      backgroundImage: {
        url: 'data:image/png;base64,dGVzdA==',
        width: 320,
        height: 180,
        x: 1.25,
        y: -2.5,
        scale: 0.75,
        alpha: 0.35,
      },
      robotSettings: {
        length: 1.1,
        width: 0.8,
        acceleration: 2,
        deceleration: 3,
        maxVelocity: 4,
        centripetalAcceleration: 5,
      },
    });

    expect(restored.domain).toEqual(domain);
    expect(restored.ui.mode).toBe('path');
    expect(restored.ui.tool).toBe('select');
    expect(restored.ui.selection).toEqual({
      pathId: domain.activePathId,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    });
    expect(restored.ui.backgroundImage).toEqual({
      url: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
      x: 1.25,
      y: -2.5,
      scale: 0.75,
      alpha: 0.35,
    });
    expect(restored.ui.robotPreviewEnabled).toBe(true);
    expect(restored.ui.robotSettings.length).toBe(1.1);
    expect(restored.ui.snapPanelOpen).toBe(false);
    expect(restored.ui.isDragging).toBe(false);
  });

  it('applies autosave payloads while keeping runtime defaults normalized', () => {
    const domain = createInitialDomainState();
    const firstPath = domain.paths[0];

    if (firstPath === undefined) {
      throw new Error('expected initial path');
    }

    const libraryPoint = createPoint({
      id: 'library-point',
      x: 1,
      y: 2,
      robotHeading: 15,
      isLibrary: true,
      name: 'Canonical Library',
    });
    const linkedPoint = createPoint({
      id: 'linked-point',
      x: 1,
      y: 2,
      robotHeading: null,
      isLibrary: false,
      name: 'Stale Local Name',
    });
    const orphanPoint = createPoint({
      id: 'orphan-point',
      x: 9,
      y: 9,
      robotHeading: null,
      isLibrary: false,
      name: 'Orphan',
    });

    domain.points.push(libraryPoint, linkedPoint, orphanPoint);
    domain.lockedPointIds = [libraryPoint.id, linkedPoint.id, 'missing-point'];
    domain.activePathId = 'missing-path';
    firstPath.waypoints = [
      {
        id: 'waypoint-1',
        pointId: linkedPoint.id,
        libraryPointId: libraryPoint.id,
        pathHeading: 0,
      },
    ];

    const restored = applyWorkspaceAutosavePayload({
      document: {
        domain,
        backgroundImage: {
          url: 'data:image/png;base64,dGVzdA==',
          width: 640,
          height: 360,
          x: 2,
          y: -1,
          scale: 0.5,
          alpha: 0.6,
        },
        robotSettings: {
          length: -1,
          width: 0,
          acceleration: Number.NaN,
          deceleration: -2,
          maxVelocity: 0,
          centripetalAcceleration: Number.POSITIVE_INFINITY,
        },
      },
      session: {
        mode: 'path',
        tool: 'select',
        selection: {
          pathId: 'missing-path',
          waypointId: 'missing-waypoint',
          headingKeyframeId: 'missing-heading',
          sectionIndex: 99,
        },
        canvasTransform: {
          x: 10,
          y: 20,
          k: 30,
        },
      },
    });

    expect(restored.domain.activePathId).toBe(firstPath.id);
    expect(restored.domain.points.map((point) => point.id)).toEqual([
      libraryPoint.id,
      linkedPoint.id,
    ]);
    expect(restored.domain.points[1]?.name).toBe('Canonical Library');
    expect(restored.domain.lockedPointIds).toEqual([libraryPoint.id]);
    expect(restored.ui.selection).toEqual({
      pathId: firstPath.id,
      waypointId: null,
      headingKeyframeId: null,
      sectionIndex: null,
    });
    expect(restored.ui.selectedLibraryPointId).toBe(libraryPoint.id);
    expect(restored.ui.isDragging).toBe(false);
    expect(restored.ui.snapPanelOpen).toBe(false);
    expect(restored.ui.backgroundImage).toEqual({
      url: 'data:image/png;base64,dGVzdA==',
      width: 640,
      height: 360,
      x: 2,
      y: -1,
      scale: 0.5,
      alpha: 0.6,
    });
    expect(restored.ui.robotPreviewEnabled).toBe(true);
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
