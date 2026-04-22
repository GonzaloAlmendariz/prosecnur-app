// =============================================================================
// Tipos compartidos del feature project (.pulso)
// =============================================================================

export type RecentProject = {
  path: string;
  name: string;
  opened_at: string;
};

// API de window.prosecnurApi (expuesta vía desktop/preload.cjs). Si la app
// corre en navegador puro (sin Electron), `window.prosecnurApi` es
// `undefined` y la UI debe ofrecer fallbacks (input de texto para path).
export type ProsecnurApi = {
  openProjectDialog: () => Promise<string | null>;
  saveProjectDialog: (defaultName: string) => Promise<string | null>;
  saveEntregableDialog: (opts: {
    defaultName?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;
  getRecentProjects: () => Promise<RecentProject[]>;
  pushRecentProject: (path: string) => Promise<RecentProject[]>;
  onMenuCommand: (callback: (command: string) => void) => () => void;
};

declare global {
  interface Window {
    prosecnurApi?: ProsecnurApi;
  }
}

export {};
