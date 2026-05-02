// =============================================================================
// Tipos compartidos del feature project (.pulso)
// =============================================================================

export type RecentProject = {
  path: string;
  name: string;
  opened_at: string;
};

export type HfSavedToken = {
  id: string;
  name: string;
  hf_username: string;
  masked_token: string;
  created_at: string | null;
  last_used_at: string | null;
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
  removeRecentProject: (path: string) => Promise<RecentProject[]>;
  getHfSettings: () => Promise<{
    hf_username: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
  }>;
  getHfToken: (id: string) => Promise<(HfSavedToken & {
    hf_token: string;
  }) | null>;
  rememberSuccessfulHfToken: (settings: {
    name: string;
    hf_username: string;
    hf_token: string;
  }) => Promise<{
    hf_username: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
  }>;
  onMenuCommand: (callback: (command: string) => void) => () => void;
};

declare global {
  interface Window {
    prosecnurApi?: ProsecnurApi;
  }
}

export {};
