// =============================================================================
// useProject — hook central de gestión del proyecto .pulso activo
// =============================================================================
// Consolida todas las operaciones que el usuario puede hacer sobre el
// proyecto (nuevo, abrir, guardar, save-as, cerrar, recientes) y mantiene
// el status sincronizado con el backend (poll cada 30s + on-demand).
//
// Usa window.prosecnurApi (desktop/preload.cjs) para los dialogs nativos.
// En navegador puro la API no existe → los métodos lanzan un error claro
// que la UI puede atrapar para ofrecer fallback.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCreateSession,
  apiProjectClose,
  apiProjectDuplicate,
  apiProjectOpen,
  apiProjectSave,
  apiProjectStatus,
  ProjectStatus,
} from "../../api/client";
import { flushGraficosConfigIfHydrated } from "../graficos/configSnapshot";
import { flushPendingSyncs } from "../../lib/pendingFlushRegistry";
import { flushHojasRutaWorkspaceIfHydrated } from "../hojasRuta/configSnapshot";
import type { RecentProject } from "./types";

const POLL_INTERVAL_MS = 30_000;
const BOOT_PROJECT_STATUS_KEY = "pulso.bootProject";

function dirname(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return undefined;
  return path.slice(0, idx);
}

const EMPTY_STATUS: ProjectStatus = {
  has_project: false,
  path: null,
  name: null,
  dirty: false,
  last_saved_at: null,
};

function projectNameFromPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.split("/").filter(Boolean).pop() ?? path;
  return base.replace(/\.pulso$/i, "");
}

function duplicateDefaultName(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (/acnur/i.test(clean)) return "copia prueba ACNUR";
  return `copia prueba ${clean || "Proyecto"}`;
}

function readBootProjectStatus(): ProjectStatus {
  if (typeof window === "undefined") return EMPTY_STATUS;
  try {
    const raw = window.sessionStorage.getItem(BOOT_PROJECT_STATUS_KEY);
    if (!raw) return EMPTY_STATUS;
    const parsed = JSON.parse(raw) as { path?: unknown; name?: unknown };
    if (typeof parsed.path !== "string" || !parsed.path.trim()) return EMPTY_STATUS;
    return {
      has_project: true,
      path: parsed.path,
      name: typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name
        : projectNameFromPath(parsed.path),
      dirty: false,
      last_saved_at: null,
    };
  } catch {
    return EMPTY_STATUS;
  }
}

function rememberProjectStatus(status: ProjectStatus) {
  if (typeof window === "undefined") return;
  try {
    if (!status.has_project || !status.path) {
      window.sessionStorage.removeItem(BOOT_PROJECT_STATUS_KEY);
      return;
    }
    window.sessionStorage.setItem(
      BOOT_PROJECT_STATUS_KEY,
      JSON.stringify({
        path: status.path,
        name: status.name ?? projectNameFromPath(status.path),
      }),
    );
  } catch {
    // La sesión en memoria del backend sigue siendo la fuente de verdad.
  }
}

export function useProject(sessionId?: string) {
  const [status, setStatus] = useState<ProjectStatus>(() => readBootProjectStatus());
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async (): Promise<ProjectStatus | null> => {
    if (!sessionId) return null;
    try {
      const s = await apiProjectStatus();
      rememberProjectStatus(s);
      setStatus(s);
      return s;
    } catch (e) {
      // Falla silenciosa — el polling reintenta.
      // No spamear UI cuando el backend está reiniciando.
      return null;
    }
  }, [sessionId]);

  const refreshRecents = useCallback(async () => {
    if (!window.prosecnurApi) {
      setRecents([]);
      return;
    }
    try {
      const list = await window.prosecnurApi.getRecentProjects();
      setRecents(list ?? []);
    } catch (_e) {
      setRecents([]);
    }
  }, []);

  // Polling regular del status para mantener el header actualizado (last
  // saved hace X min, dirty cuando los modulos marcan cambios pendientes).
  useEffect(() => {
    void refresh();
    void refreshRecents();
    const id = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    window.addEventListener("pulso:project-status-changed", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("pulso:project-status-changed", refresh);
    };
  }, [status.path, refresh, refreshRecents]);

  // ----- Acciones --------------------------------------------------------

  const open = useCallback(async (pathOpt?: string) => {
    const electronApi = window.prosecnurApi;
    setError("");
    setBusy(true);
    try {
      let chosenPath: string | null = pathOpt ?? null;
      if (!chosenPath) {
        if (!electronApi) {
          throw new Error("File picker no disponible (necesitas la app de escritorio).");
        }
        chosenPath = await electronApi.openProjectDialog({ defaultPath: dirname(status.path) });
      }
      if (!chosenPath) return null;
      const r = await apiProjectOpen(chosenPath);
      if (electronApi) await electronApi.pushRecentProject(chosenPath);
      await refresh();
      await refreshRecents();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [status.path, refresh, refreshRecents]);

  // En modo Electron usa el save dialog nativo. En modo navegador (sin
  // Electron) acepta `pathOpt` con el path absoluto directamente — útil
  // para entornos como Vite preview o herramientas externas (incluido
  // Claude) que necesitan crear un proyecto sin file picker.
  const newProject = useCallback(async (defaultName = "MiProyecto", pathOpt?: string) => {
    const electronApi = window.prosecnurApi;
    setError("");
    setBusy(true);
    try {
      let path: string | null = pathOpt ?? null;
      if (!path) {
        if (!electronApi) {
          throw new Error("Pasa un path al .pulso o usa la app de escritorio.");
        }
        path = await electronApi.saveProjectDialog(defaultName, { defaultPath: dirname(status.path) });
      }
      if (!path) return null;
      // Proyecto nuevo = sesión nueva. Sin `fresh`, /api/session reutiliza
      // la sesión vigente y termina guardando el avance del proyecto anterior.
      await apiCreateSession({ fresh: true });
      const r = await apiProjectSave(path);
      if (electronApi) await electronApi.pushRecentProject(r.path);
      await refresh();
      await refreshRecents();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, refreshRecents]);

  const save = useCallback(async () => {
    setError("");
    if (!status.has_project) {
      setError("No hay proyecto abierto.");
      return null;
    }
    setBusy(true);
    try {
      await flushPendingSyncs();
      await flushGraficosConfigIfHydrated();
      await flushHojasRutaWorkspaceIfHydrated();
      const r = await apiProjectSave(null);
      await refresh();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [status.has_project, refresh]);

  const saveAs = useCallback(async () => {
    const electronApi = window.prosecnurApi;
    setError("");
    setBusy(true);
    try {
      if (!electronApi) {
        throw new Error("File picker no disponible (necesitas la app de escritorio).");
      }
      const defaultName = status.name ?? "MiProyecto";
      const path = await electronApi.saveProjectDialog(defaultName, { defaultPath: dirname(status.path) });
      if (!path) return null;
      await flushPendingSyncs();
      await flushGraficosConfigIfHydrated();
      await flushHojasRutaWorkspaceIfHydrated();
      const r = await apiProjectSave(path);
      if (electronApi) await electronApi.pushRecentProject(r.path);
      await refresh();
      await refreshRecents();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [status.name, status.path, refresh, refreshRecents]);

  const duplicate = useCallback(async (defaultName?: string, pathOpt?: string) => {
    const electronApi = window.prosecnurApi;
    setError("");
    if (!status.has_project) {
      setError("No hay proyecto abierto para duplicar.");
      return null;
    }
    setBusy(true);
    try {
      let path: string | null = pathOpt ?? null;
      if (!path) {
        if (!electronApi) {
          throw new Error("Pasa un path al .pulso o usa la app de escritorio.");
        }
        path = await electronApi.saveProjectDialog(
          defaultName ?? duplicateDefaultName(status.name),
          { defaultPath: dirname(status.path) },
        );
      }
      if (!path) return null;
      await flushPendingSyncs();
      await flushGraficosConfigIfHydrated();
      await flushHojasRutaWorkspaceIfHydrated();
      const r = await apiProjectDuplicate({
        target_path: path,
        project_name: projectNameFromPath(path),
        open_copy: true,
        overwrite: false,
      });
      if (electronApi) await electronApi.pushRecentProject(r.path);
      await refresh();
      await refreshRecents();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [status.has_project, status.name, status.path, refresh, refreshRecents]);

  const removeRecent = useCallback(async (path: string) => {
    const electronApi = window.prosecnurApi;
    if (!electronApi) {
      // En modo navegador no hay persistencia de recientes — no-op.
      return;
    }
    try {
      const list = await electronApi.removeRecentProject(path);
      setRecents(list ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const close = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      await apiProjectClose();
      rememberProjectStatus(EMPTY_STATUS);
      await refresh();
      window.dispatchEvent(new CustomEvent("pulso:project-closed"));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return useMemo(
    () => ({
      status,
      recents,
      busy,
      error,
      open,
      newProject,
      save,
      saveAs,
      duplicate,
      close,
      removeRecent,
      refresh,
      refreshRecents,
    }),
    [status, recents, busy, error, open, newProject, save, saveAs, duplicate, close, removeRecent, refresh, refreshRecents],
  );
}

export type UseProjectReturn = ReturnType<typeof useProject>;
