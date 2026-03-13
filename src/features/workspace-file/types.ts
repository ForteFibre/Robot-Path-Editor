import type { CsvTarget } from '../../io/csv';

export type CsvExportState = {
  step: number;
  target: CsvTarget;
  setStep: (step: number) => void;
  setTarget: (target: CsvTarget) => void;
};

export type CsvExportCommands = {
  csvExport: CsvExportState;
  exportCsv: () => Promise<void>;
};

export type WorkspaceFileCommands = {
  isFileSystemAccessSupported: boolean;
  linkedFileName: string | null;
  importJson: (file: File) => Promise<void>;
  newWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
};

export type WorkspaceToolbarCommands = WorkspaceFileCommands &
  CsvExportCommands;
