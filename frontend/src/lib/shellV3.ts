import type { ProsecnurModuleSlug } from "./modules";

export const SHELL_V3_QUERY_KEY = "shell";
export const SHELL_V3_QUERY_VALUE = "v3";
export const SHELL_V3_SIDEBAR_STORAGE_KEY =
  "pulso.shellV3.sidebarCollapsed";

type ShellV3RuntimeOptions = {
  dev?: boolean;
  envEnabled?: boolean;
};

export function isShellV3Enabled(
  search: string,
  options: ShellV3RuntimeOptions = {},
): boolean {
  const dev = options.dev ?? import.meta.env.DEV;
  if (!dev) return false;
  const envEnabled =
    options.envEnabled ??
    import.meta.env.VITE_PULSO_SHELL_V3 === "true";
  if (envEnabled) return true;
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return params.get(SHELL_V3_QUERY_KEY) === SHELL_V3_QUERY_VALUE;
}

export function withShellV3Query(
  href: string,
  currentSearch: string,
): string {
  const current = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  if (current.get(SHELL_V3_QUERY_KEY) !== SHELL_V3_QUERY_VALUE) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(
    queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "",
  );
  params.set(SHELL_V3_QUERY_KEY, SHELL_V3_QUERY_VALUE);
  const serialized = params.toString();
  return `${pathname}${serialized ? `?${serialized}` : ""}${hash}`;
}

export function defaultSidebarCollapsed(
  slug: ProsecnurModuleSlug | undefined,
  pathname: string,
): boolean {
  if (pathname === "/") return true;
  return slug === "editor-xlsform" || slug === "dashboard";
}

export function readSidebarCollapsed(
  storage: Pick<Storage, "getItem"> | undefined,
): boolean | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(SHELL_V3_SIDEBAR_STORAGE_KEY);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    return null;
  }
  return null;
}

export function writeSidebarCollapsed(
  storage: Pick<Storage, "setItem"> | undefined,
  collapsed: boolean,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      SHELL_V3_SIDEBAR_STORAGE_KEY,
      collapsed ? "true" : "false",
    );
  } catch {
    // La preferencia es oportunista: el shell sigue funcionando sin storage.
  }
}
