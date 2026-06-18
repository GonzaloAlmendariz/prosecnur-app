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

export type HfSavedDestination = {
  id: string;
  namespace: string;
  space_name: string;
  repo_id: string;
  app_url: string;
  label: string;
  module: string;
  audience: string;
  private: boolean;
  created_at: string | null;
  last_used_at: string | null;
};

// API de window.prosecnurApi (expuesta vía desktop/preload.cjs). Si la app
// corre en navegador puro (sin Electron), `window.prosecnurApi` es
// `undefined` y la UI debe ofrecer fallbacks (input de texto para path).
export type ProsecnurApi = {
  openProjectDialog: (opts?: { defaultPath?: string }) => Promise<string | null>;
  saveProjectDialog: (defaultName: string, opts?: { defaultPath?: string }) => Promise<string | null>;
  saveEntregableDialog: (opts: {
    defaultName?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;
  getRecentProjects: () => Promise<RecentProject[]>;
  getLaunchProject: () => Promise<string | null>;
  pushRecentProject: (path: string) => Promise<RecentProject[]>;
  removeRecentProject: (path: string) => Promise<RecentProject[]>;
  getHfSettings: () => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  getHfToken: (id: string) => Promise<(HfSavedToken & {
    hf_token: string;
  }) | null>;
  rememberSuccessfulHfToken: (settings: {
    id?: string;
    token_id?: string;
    name: string;
    hf_username?: string;
    credential_username?: string;
    destination_namespace?: string;
    namespace?: string;
    repo_id?: string;
    app_url?: string;
    space_name?: string;
    module?: string;
    audience?: string;
    private?: boolean;
    hf_token: string;
  }) => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  checkHfToken: (settings: {
    id?: string;
    token_id?: string;
    hf_token?: string;
  }) => Promise<
    | {
        ok: true;
        status_code: number;
        name: string;
        org_count: number;
      }
    | {
        ok: false;
        status_code?: number;
        error: string;
      }
  >;
  forgetHfToken: (id?: string) => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  rememberHfDestination: (settings: {
    namespace?: string;
    destination_namespace?: string;
    hf_username?: string;
    space_name?: string;
    repo_id?: string;
    app_url?: string;
    label?: string;
    module?: string;
    audience?: string;
    private?: boolean;
  }) => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  saveHfDefaultNamespace: (namespace: string) => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  forgetHfDestination: (id?: string) => Promise<{
    hf_username: string;
    default_namespace: string;
    token_configured: boolean;
    encryption_available: boolean;
    saved_tokens: HfSavedToken[];
    recent_destinations: HfSavedDestination[];
  }>;
  onMenuCommand: (callback: (command: string) => void) => () => void;
};

declare global {
  interface Window {
    prosecnurApi?: ProsecnurApi;
  }
}

export {};
