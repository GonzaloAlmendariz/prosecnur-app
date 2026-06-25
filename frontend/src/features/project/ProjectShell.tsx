// =============================================================================
// ProjectShell — wrapper que pega el feature project al árbol de la app
// =============================================================================
// Hace 4 cosas:
//   1. Instancia useProject + useAutosave una sola vez (raíz de la app).
//   2. Provee el state via ProjectContext para que el Layout (header) y
//      cualquier consumer profundo accedan sin prop-drilling.
//   3. Delega el cambio de proyecto al BootGate: cerrar proyecto desmonta la
//      suite y vuelve a la selección inicial.
//   4. Conecta los comandos del menú nativo (Cmd+S/Cmd+O/Cmd+N/etc.) que
//      el main process envía vía window.prosecnurApi.onMenuCommand.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAutosave } from "./useAutosave";
import { useProject, type UseProjectReturn } from "./useProject";
import { useSession } from "../../lib/SessionContext";
import { useStoreResetOnSessionChange } from "../../lib/useStoreResetOnSessionChange";

type ProjectShellCtx = {
  project: UseProjectReturn;
};

const Ctx = createContext<ProjectShellCtx | null>(null);

export function useProjectShell(): ProjectShellCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectShell debe usarse dentro de <ProjectShell>");
  return ctx;
}

export function useOptionalProjectShell(): ProjectShellCtx | null {
  return useContext(Ctx);
}

export default function ProjectShell({ children }: { children: React.ReactNode }) {
  const { sessionId } = useSession();
  const project = useProject(sessionId);
  const devOpenAttemptRef = useRef("");
  useAutosave(project);
  // Resetea stores Zustand globales al cambiar de proyecto (sid). Sin
  // esto, configuración del proyecto anterior persistía en dashboard /
  // analítica / gráficos / wizards mientras los autosaves re-hidrataban.
  useStoreResetOnSessionChange();

  // Dev-only: permite validar una pantalla web con un .pulso abierto sin
  // depender del modal de path manual ni del clipboard del navegador embebido.
  // Ejemplo: /monitoreo?devPulso=/Users/.../Proyecto.pulso
  useEffect(() => {
    if (!import.meta.env.DEV || !sessionId || project.busy) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const rawPath =
      url.searchParams.get("devPulso") ??
      url.searchParams.get("devProject") ??
      url.searchParams.get("pulso");
    const projectPath = rawPath?.trim() ?? "";
    if (!projectPath) return;
    url.searchParams.delete("devPulso");
    url.searchParams.delete("devProject");
    url.searchParams.delete("pulso");
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    const activePath = project.status.path?.trim() ?? "";
    if (project.status.has_project && activePath === projectPath) {
      window.history.replaceState(window.history.state, "", nextUrl);
      return;
    }
    const attemptKey = `${activePath}->${projectPath}`;
    if (devOpenAttemptRef.current === attemptKey) return;
    devOpenAttemptRef.current = attemptKey;

    let cancelled = false;
    void (async () => {
      const r = await project.open(projectPath);
      if (cancelled || !r) return;
      window.history.replaceState(window.history.state, "", nextUrl);
      window.location.replace(nextUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, project.status.has_project, project.status.path, project.busy, project.open]);

  // Suscribir a comandos del menú nativo (Cmd+S, Cmd+O, etc.)
  useEffect(() => {
    if (!window.prosecnurApi) return undefined;
    let disposed = false;

    window.prosecnurApi.getLaunchProject?.().then(async (path) => {
      if (disposed || !path) return;
      await project.open(path);
    }).catch(() => {
      // Compatibilidad con builds antiguos del bridge Electron.
    });

    const cleanup = window.prosecnurApi.onMenuCommand(async (command) => {
      if (command === "project:new") {
        await project.newProject();
      } else if (command === "project:open") {
        await project.open();
      } else if (command === "project:save") {
        await project.save();
      } else if (command === "project:saveAs") {
        await project.saveAs();
      } else if (command === "project:close") {
        await project.close();
      } else if (command.startsWith("project:openRecent:")) {
        const path = command.slice("project:openRecent:".length);
        await project.open(path);
      }
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [project]);

  const ctxValue = useMemo<ProjectShellCtx>(
    () => ({ project }),
    [project],
  );

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
    </Ctx.Provider>
  );
}
