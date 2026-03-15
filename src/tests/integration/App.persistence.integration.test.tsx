import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../App';
import * as workspaceCodec from '../../io/workspaceCodec';
import * as workspaceIO from '../../io/workspaceIO';
import * as workspaceFileLinkPersistence from '../../io/workspaceFileLinkPersistence';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES } from '../../features/toolbar/backgroundImageFile';
import {
  ACTIVE_WORKSPACE_PERSISTENCE_KEY,
  confirmDialog,
  createDirectoryExportMock,
  createWorkspaceFileSaveMock,
  exportWorkspaceJsonFromToolbar,
  getCanvas,
  getBackgroundImageLoadInput,
  importWorkspaceJsonFile,
  loadBackgroundImageFromToolbar,
  openFileMenu,
  openSettingsMenu,
  primePersistedWorkspaceCandidate,
  putIndexedDbRecord,
  setCsvTargetFromToolbar,
  setDirectoryPickerSupport,
  setupIntegrationTestLifecycle,
  canvasClick,
} from './helpers';

setupIntegrationTestLifecycle();

const SAVE_CONFLICT_TEST_TIMEOUT_MS = 15_000;

describe('App persistence integration', () => {
  it('restores a persisted workspace after confirming the startup dialog', async () => {
    await primePersistedWorkspaceCandidate();

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: '前回の作業を復元しますか？',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '最後の編集を復元' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: '前回の作業を復元しますか？',
        }),
      ).not.toBeInTheDocument();
      expect(useWorkspaceStore.getState().ui.backgroundImage).not.toBeNull();
      expect(useWorkspaceStore.getState().ui.robotSettings.length).toBeCloseTo(
        1.25,
      );
      expect(useWorkspaceStore.getState().ui.robotSettings.width).toBeCloseTo(
        0.92,
      );
    });
  });

  it('shows a recovery notice when invalid persisted data is cleared on boot', async () => {
    await putIndexedDbRecord({
      key: ACTIVE_WORKSPACE_PERSISTENCE_KEY,
      savedAt: 123,
      payloadJson: '{"workspace":',
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText(
          '保存データが破損していたため自動削除して起動しました。',
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'dismiss notification',
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(
          '保存データが破損していたため自動削除して起動しました。',
        ),
      ).not.toBeInTheDocument();
    });
  });

  it('shows a notification when the previous linked file cannot be read during bootstrap', async () => {
    await primePersistedWorkspaceCandidate();

    vi.spyOn(
      workspaceFileLinkPersistence,
      'loadLinkedFileHandle',
    ).mockResolvedValue({
      handle: {
        kind: 'file',
        name: 'linked-workspace.json',
        getFile: vi.fn(() => Promise.reject(new Error('no access'))),
      } as unknown as FileSystemFileHandle,
      lastKnownModifiedAt: 1_762_000_000_000,
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: '前回の作業を復元しますか？',
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(
          '前回リンクしたファイル「linked-workspace.json」を読み込めませんでした。自動保存データのみ復元できます。',
        ),
      ).toBeInTheDocument();
    });
  });

  it('restores background image from file export/import', async () => {
    render(<App />);

    await loadBackgroundImageFromToolbar({
      width: 320,
      height: 180,
    });

    fireEvent.change(screen.getByLabelText('X (m)'), {
      target: { value: '1.25' },
    });
    fireEvent.change(screen.getByLabelText('Y (m)'), {
      target: { value: '-2.5' },
    });
    fireEvent.change(screen.getByLabelText('Scale'), {
      target: { value: '0.75' },
    });
    fireEvent.change(screen.getByLabelText('Opacity'), {
      target: { value: '0.35' },
    });

    const exportedJson = exportWorkspaceJsonFromToolbar();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    confirmDialog('破棄して新規作成');

    await waitFor(() => {
      expect(useWorkspaceStore.getState().ui.backgroundImage).toBeNull();
    });

    await importWorkspaceJsonFile(exportedJson);

    const restoredBackground = useWorkspaceStore.getState().ui.backgroundImage;
    expect(restoredBackground).toEqual({
      url: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
      x: 1.25,
      y: -2.5,
      scale: 0.75,
      alpha: 0.35,
    });
  });

  it('writes csv files into a user-selected directory in supported browsers', async () => {
    const directoryExport = createDirectoryExportMock('robot-csv');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 240, 230);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 230);

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(directoryExport.showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(directoryExport.getFileHandle).toHaveBeenCalledTimes(2);
    });

    expect(directoryExport.getFileHandle).toHaveBeenNthCalledWith(
      1,
      'Path 1.csv',
      { create: true },
    );
    expect(directoryExport.getFileHandle).toHaveBeenNthCalledWith(
      2,
      'Path 2.csv',
      { create: true },
    );
    const firstWrittenBlob = directoryExport.write.mock.calls[0]?.[0];

    expect(firstWrittenBlob).toBeInstanceOf(Blob);

    if (!(firstWrittenBlob instanceof Blob)) {
      throw new TypeError('expected csv blob');
    }

    expect(await firstWrittenBlob.text()).toContain('x,y,theta');
    expect(screen.getByText(/フォルダ「robot-csv」/)).toBeInTheDocument();
  });

  it('saves workspace json into a user-selected file and reuses the linked handle', async () => {
    const fileSave = createWorkspaceFileSaveMock('linked-workspace.json');

    render(<App />);

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

    await waitFor(() => {
      expect(fileSave.showSaveFilePicker).toHaveBeenCalledWith({
        excludeAcceptAllOption: true,
        suggestedName: 'workspace.json',
        types: [
          {
            accept: {
              'application/json': ['.json'],
            },
            description: 'Workspace JSON',
          },
        ],
      });
    });

    const writtenBlob = fileSave.write.mock.calls[0]?.[0];
    expect(writtenBlob).toBeInstanceOf(Blob);

    if (!(writtenBlob instanceof Blob)) {
      throw new TypeError('expected workspace json blob');
    }

    await expect(writtenBlob.text()).resolves.toContain('"document"');
    await expect(writtenBlob.text()).resolves.toContain('"backgroundImage"');
    await expect(writtenBlob.text()).resolves.not.toContain('"selection"');

    openFileMenu();
    expect(
      screen.getByText('linked: linked-workspace.json'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

    await waitFor(() => {
      expect(fileSave.showSaveFilePicker).toHaveBeenCalledTimes(1);
      expect(fileSave.createWritable).toHaveBeenCalledTimes(2);
      expect(fileSave.queryPermission).toHaveBeenCalledTimes(1);
    });
  });

  it(
    'shows a save conflict dialog and can load the latest linked file',
    async () => {
      const fileSave = createWorkspaceFileSaveMock('linked-workspace.json');

      render(<App />);

      openSettingsMenu();
      fireEvent.change(screen.getByLabelText('Robot Length (m)'), {
        target: { value: '1.25' },
      });

      openFileMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

      await waitFor(() => {
        expect(fileSave.showSaveFilePicker).toHaveBeenCalledTimes(1);
      });

      const document = workspaceCodec.deserializeWorkspace(
        fileSave.getCurrentText(),
      );
      const externalWorkspaceJson = workspaceCodec.serializeWorkspace({
        ...document,
        robotSettings: {
          ...document.robotSettings,
          length: 2.75,
        },
      });

      fileSave.setExternalFile({
        text: externalWorkspaceJson,
        lastModified: fileSave.getCurrentLastModified() + 200,
      });

      openFileMenu();
      fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

      expect(
        await screen.findByRole('heading', {
          name: 'ファイルの競合を解決しますか？',
        }),
      ).toBeInTheDocument();
      expect(fileSave.createWritable).toHaveBeenCalledTimes(1);

      fireEvent.click(
        screen.getByRole('button', { name: 'ファイルの最新版を読み込む' }),
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', {
            name: 'ファイルの競合を解決しますか？',
          }),
        ).not.toBeInTheDocument();
        expect(
          useWorkspaceStore.getState().ui.robotSettings.length,
        ).toBeCloseTo(2.75);
      });
    },
    SAVE_CONFLICT_TEST_TIMEOUT_MS,
  );

  it('falls back to download-based json export in unsupported browsers', async () => {
    setDirectoryPickerSupport(undefined, false);
    const downloadSpy = vi
      .spyOn(workspaceIO, 'downloadText')
      .mockImplementation(() => undefined);

    render(<App />);

    const expectedJson = exportWorkspaceJsonFromToolbar();
    downloadSpy.mockClear();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Save Workspace' }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        'workspace.json',
        expectedJson,
        'application/json',
      );
    });
  });

  it('falls back to download-based csv export in unsupported browsers', async () => {
    setDirectoryPickerSupport(undefined, false);
    const downloadSpy = vi
      .spyOn(workspaceIO, 'downloadText')
      .mockImplementation(() => undefined);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    const canvas = getCanvas();
    canvasClick(canvas, 240, 170);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 170);

    act(() => {
      useWorkspaceStore.getState().addPath();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 240, 230);
    fireEvent.click(screen.getByRole('button', { name: 'tool add point' }));
    canvasClick(canvas, 360, 230);

    openFileMenu();

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    expect(
      screen.queryByText(/対応ブラウザでのみ利用できます/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(2);
    });

    expect(downloadSpy).toHaveBeenNthCalledWith(
      1,
      'Path 1.csv',
      expect.stringContaining('x,y,theta'),
      'text/csv;charset=utf-8',
    );
    expect(downloadSpy).toHaveBeenNthCalledWith(
      2,
      'Path 2.csv',
      expect.stringContaining('x,y,theta'),
      'text/csv;charset=utf-8',
    );
  });

  it('does not show a csv error banner when directory picking is cancelled', async () => {
    const showDirectoryPicker = vi.fn(() =>
      Promise.reject(
        new DOMException('The user aborted a request.', 'AbortError'),
      ),
    );
    setDirectoryPickerSupport(showDirectoryPicker);

    render(<App />);

    setCsvTargetFromToolbar('active');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    expect(
      screen.queryByText(/CSVの書き込みに失敗しました/),
    ).not.toBeInTheDocument();
  });

  it('round-trips robot settings through App export and import', async () => {
    render(<App />);

    openSettingsMenu();
    fireEvent.change(screen.getByLabelText('Robot Length (m)'), {
      target: { value: '1.25' },
    });
    fireEvent.change(screen.getByLabelText('Robot Width (m)'), {
      target: { value: '0.92' },
    });
    fireEvent.change(screen.getByLabelText('Max Velocity (m/s)'), {
      target: { value: '3.4' },
    });
    fireEvent.click(screen.getByLabelText('Robot Preview'));

    const exportedJson = exportWorkspaceJsonFromToolbar();

    openFileMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new workspace' }));
    confirmDialog('破棄して新規作成');
    expect(useWorkspaceStore.getState().ui.robotSettings.length).not.toBe(1.25);

    await importWorkspaceJsonFile(exportedJson);

    expect(useWorkspaceStore.getState().ui.robotSettings.length).toBeCloseTo(
      1.25,
    );
    expect(useWorkspaceStore.getState().ui.robotSettings.width).toBeCloseTo(
      0.92,
    );
    expect(useWorkspaceStore.getState().ui.robotPreviewEnabled).toBe(true);
    expect(
      useWorkspaceStore.getState().ui.robotSettings.maxVelocity,
    ).toBeCloseTo(3.4);
  });

  it('shows a clear error when importing invalid workspace json', async () => {
    render(<App />);

    const invalidFile = new File(
      ['{"version":0,"workspace":{}}'],
      'old-workspace.json',
      {
        type: 'application/json',
      },
    );

    openFileMenu();
    fireEvent.change(screen.getByLabelText('load workspace file'), {
      target: { files: [invalidFile] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'JSONの読み込みに失敗しました。',
      );
    });
  });

  it('shows a clear error when the selected background image is too large', async () => {
    render(<App />);

    openSettingsMenu();

    fireEvent.change(getBackgroundImageLoadInput(), {
      target: {
        files: [
          new File(
            [new Uint8Array(MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES + 1)],
            'too-large.png',
            { type: 'image/png' },
          ),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '背景画像は 10 MB 以下のファイルを選択してください。',
      );
    });
  });
});
