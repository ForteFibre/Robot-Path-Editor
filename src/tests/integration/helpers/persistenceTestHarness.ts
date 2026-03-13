import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { CsvTarget } from '../../../io/csv';
import { saveWorkspacePersistence } from '../../../io/workspacePersistence';
import * as workspaceIO from '../../../io/workspaceIO';
import type { WorkspaceAutosavePayload } from '../../../store/types';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import type {
  DirectoryPickerWindow,
  FilePickerWindow,
} from './filePickerMocks';

const stubBackgroundImageFileLoad = (params: {
  dataUrl: string;
  width: number;
  height: number;
}): void => {
  const { dataUrl, width, height } = params;

  class MockFileReader {
    public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

    public readAsDataURL(_file: Blob): void {
      this.onload?.({
        target: {
          result: dataUrl,
        },
      } as ProgressEvent<FileReader>);
    }
  }

  class MockImage {
    public onload: (() => void) | null = null;
    public naturalWidth = width;
    public naturalHeight = height;
    public width = width;
    public height = height;

    set src(_value: string) {
      this.onload?.();
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);
  vi.stubGlobal('Image', MockImage);
};

const getCurrentWorkspaceAutosavePayload = (): WorkspaceAutosavePayload => {
  const state = useWorkspaceStore.getState();

  return {
    document: {
      domain: state.domain,
      backgroundImage:
        state.ui.backgroundImage === null
          ? null
          : {
              ...state.ui.backgroundImage,
            },
      robotSettings: {
        ...state.ui.robotSettings,
      },
    },
    session: {
      mode: state.ui.mode,
      tool: state.ui.tool,
      selection: {
        pathId: state.ui.selection.pathId,
        waypointId: state.ui.selection.waypointId,
        headingKeyframeId: state.ui.selection.headingKeyframeId,
        sectionIndex: state.ui.selection.sectionIndex,
      },
      canvasTransform: {
        ...state.ui.canvasTransform,
      },
      robotPreviewEnabled: state.ui.robotPreviewEnabled,
    },
  };
};

export const openFileMenu = (): void => {
  const fileMenuButton = screen.getByRole('button', { name: 'file menu' });
  if (fileMenuButton.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(fileMenuButton);
  }
};

export const openSettingsMenu = (): void => {
  const settingsMenuButton = screen.getByRole('button', {
    name: 'open settings menu',
  });
  if (settingsMenuButton.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(settingsMenuButton);
  }
};

export const confirmDialog = (buttonName: string): void => {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
};

export const setCsvTargetFromToolbar = (target: CsvTarget): void => {
  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.change(screen.getByDisplayValue(/All Paths|Active Path/), {
    target: { value: target },
  });
};

export const getBackgroundImageLoadInput = (): HTMLInputElement => {
  const input = document.getElementById('background-image-file-input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('expected background image file input');
  }

  return input;
};

export const loadBackgroundImageFromToolbar = async (
  params: {
    dataUrl?: string;
    width?: number;
    height?: number;
  } = {},
): Promise<void> => {
  const {
    dataUrl = 'data:image/png;base64,dGVzdA==',
    width = 640,
    height = 360,
  } = params;

  stubBackgroundImageFileLoad({ dataUrl, width, height });

  openSettingsMenu();
  fireEvent.change(getBackgroundImageLoadInput(), {
    target: {
      files: [new File(['fake-image'], 'field.png', { type: 'image/png' })],
    },
  });

  await waitFor(() => {
    expect(screen.getByLabelText('X (m)')).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
    expect(
      screen
        .getByLabelText('robot path editor canvas')
        .querySelectorAll('canvas').length,
    ).toBeGreaterThan(0);
  });
};

export const exportWorkspaceJsonFromToolbar = (): string => {
  if (!vi.isMockFunction(workspaceIO.downloadText)) {
    vi.spyOn(workspaceIO, 'downloadText').mockImplementation(() => undefined);
  }

  const downloadSpy = vi.mocked(workspaceIO.downloadText);

  openFileMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

  const exportedJson = downloadSpy.mock.calls.at(-1)?.[1];
  if (typeof exportedJson !== 'string') {
    throw new TypeError('expected exported workspace json');
  }

  return exportedJson;
};

export const importWorkspaceJsonFile = async (json: string): Promise<void> => {
  openFileMenu();
  fireEvent.change(screen.getByLabelText('load workspace file'), {
    target: {
      files: [new File([json], 'workspace.json', { type: 'application/json' })],
    },
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().canUndo()).toBe(false);
  });
};

export const primePersistedWorkspaceCandidate = async (): Promise<void> => {
  act(() => {
    useWorkspaceStore.getState().setBackgroundImage({
      url: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
      x: 1.25,
      y: -2.5,
      scale: 0.75,
      alpha: 0.35,
    });
    useWorkspaceStore.getState().setRobotSettings({
      length: 1.25,
      width: 0.92,
      maxVelocity: 3.4,
    });
  });

  await saveWorkspacePersistence(getCurrentWorkspaceAutosavePayload());

  act(() => {
    useWorkspaceStore.getState().resetWorkspace();
  });
};

export const setupIntegrationTestLifecycle = (): void => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (globalThis.window as DirectoryPickerWindow).showDirectoryPicker;
    delete (globalThis.window as FilePickerWindow).showOpenFilePicker;
    delete (globalThis.window as FilePickerWindow).showSaveFilePicker;
    Object.defineProperty(globalThis.window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
    useWorkspaceStore
      .getState()
      .addLibraryPoint({ name: 'Slow Turn', x: 1.2, y: 0 });
    useWorkspaceStore.temporal.getState().clear();
  });
};

export { ACTIVE_WORKSPACE_PERSISTENCE_KEY } from '../../../io/workspacePersistence';
export { putIndexedDbRecord } from '../../../io/indexedDb';
