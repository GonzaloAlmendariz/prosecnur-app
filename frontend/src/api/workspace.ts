// workspace.ts — proyecto .pulso — workspace persistente.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";
import type { JobStart } from "./jobs";

// ===========================================================================
// Proyecto .pulso — workspace persistente (Sprint Project)
// ===========================================================================
// El backend serializa el estado de la sesión a un archivo binario .pulso
// (zip con manifest.json + state.rds + files/). Estos endpoints exponen
// las operaciones save / open / close / status. Los path absolutos vienen
// del file picker nativo (window.prosecnurApi en Electron) o son tipeados
// por el user en navegador.

export type ProjectStatus = {
  has_project: boolean;
  path: string | null;
  name: string | null;
  dirty: boolean;
  last_saved_at: string | null;
};

export async function apiProjectStatus(): Promise<ProjectStatus> {
  return handle<ProjectStatus>(
    await apiFetch("/api/project/status", { headers: headers() })
  );
}

// Guarda el estado actual al .pulso. Si `path` es null, usa el project_path
// activo (save in place). Si no hay activo y no se pasa path → 400.
export async function apiProjectSave(path: string | null = null, projectName?: string) {
  const body: Record<string, unknown> = {};
  if (path) body.path = path;
  if (projectName) body.project_name = projectName;
  return handle<{
    ok: true; path: string; size: number; saved_at: string;
    /** Referencias que el proyecto declara y cuyo archivo ya no estaba, así que
     *  no viajan dentro del `.pulso`. Guardar sigue siendo posible —bloquearlo
     *  sería peor— pero el analista se entera antes de entregar el archivo.
     *  Ausente en backends viejos. */
    refs_perdidas?: string[];
  }>(
    await apiFetch("/api/project/save", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiProjectDuplicate(payload: {
  source_path?: string | null;
  target_path: string;
  project_name?: string;
  open_copy?: boolean;
  overwrite?: boolean;
}) {
  return handle<{
    ok: true;
    duplicated: true;
    path: string;
    source_path: string;
    target_path: string;
    project_name: string;
    opened: boolean;
    session_id: string;
    size: number;
    saved_at: string;
  }>(
    await apiFetch("/api/project/duplicate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    })
  );
}

// Abre un .pulso. El backend devuelve el sid nuevo en el header
// X-Pulso-Session, que `handle()` captura y dispara `pulso:session-changed`
// para que SessionContext re-hidrate todo.
export async function apiProjectOpen(path: string) {
  return handle<{
    ok: true;
    session_id: string;
    project_path: string;
    manifest: Record<string, unknown>;
  }>(
    await apiFetch("/api/project/open", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ path }),
    })
  );
}

export async function apiProjectWarmup(options: { mode?: "full"; budget_ms?: number; modules?: string[] } = {}) {
  return handle<JobStart>(
    await apiFetch("/api/project/warmup", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        mode: options.mode ?? "full",
        budget_ms: options.budget_ms ?? 60000,
        ...(options.modules?.length ? { modules: options.modules } : {}),
      }),
    })
  );
}

// Cierra el proyecto activo. BootGate escucha el evento del hook de proyecto
// y desmonta la suite para que no haya rutas principales sin .pulso.
export async function apiProjectClose() {
  return handle<{ ok: true }>(
    await apiFetch("/api/project/close", {
      method: "POST",
      headers: headers(),
    })
  );
}

// Copia un archivo del file store del backend al directorio del .pulso
// activo, con un nombre limpio elegido por el analista.
export async function apiSaveEntregable(
  fileId: string,
  filename: string,
  options: { subdir?: string; overwrite?: boolean } = {}
) {
  return handle<{ ok: true; path: string; filename: string; size: number }>(
    await apiFetch("/api/fs/save-to-project", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: fileId,
        filename,
        subdir: options.subdir ?? null,
        overwrite: options.overwrite ?? false,
      }),
    })
  );
}

export async function apiSaveFileAs(
  fileId: string,
  path: string,
  options: { overwrite?: boolean } = {}
) {
  return handle<{ ok: true; path: string; filename: string; size: number }>(
    await apiFetch("/api/fs/save-file-as", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: fileId,
        path,
        overwrite: options.overwrite ?? true,
      }),
    })
  );
}

// Lista los archivos en el directorio del .pulso activo. Útil para que el
// FilenameInput detecte colisiones antes de pedir confirmación.
export async function apiListProjectDir() {
  return handle<{ ok: true; project_dir: string | null; files: string[] }>(
    await apiFetch("/api/fs/list-project-dir", { headers: headers() })
  );
}
