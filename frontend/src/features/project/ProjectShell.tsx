// =============================================================================
// ProjectShell — wrapper que pega el feature project al árbol de la app
// =============================================================================
// Hace 4 cosas:
//   1. Instancia useProject una sola vez (raíz de la app).
//   2. Provee el state via ProjectContext para que el Layout (header) y
//      cualquier consumer profundo accedan sin prop-drilling.
//   3. Delega el cambio de proyecto al BootGate: cerrar proyecto desmonta la
//      suite y vuelve a la selección inicial.
//   4. Conecta los comandos del menú nativo (Cmd+S/Cmd+O/Cmd+N/etc.) que
//      el main process envía vía window.prosecnurApi.onMenuCommand.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { apiShutdown } from "../../api/client";
import ProjectLifecycleDialog, {
  type ProjectLifecycleAction,
  type ProjectLifecycleIntent,
} from "./ProjectLifecycleDialog";
import { useProject, type UseProjectReturn } from "./useProject";
import { useSession } from "../../lib/SessionContext";
import { useStoreResetOnSessionChange } from "../../lib/useStoreResetOnSessionChange";

type ProjectShellCtx = {
  project: UseProjectReturn;
  openProjectViewer: () => void;
  requestProjectSelector: () => void;
  requestAppExit: () => void;
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
  const [dialogIntent, setDialogIntent] = useState<ProjectLifecycleIntent | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [dialogNotice, setDialogNotice] = useState("");
  const [dialogAction, setDialogAction] = useState<ProjectLifecycleAction>(null);
  const mountedRef = useRef(true);
  // Resetea stores Zustand globales al cambiar de proyecto (sid). Sin
  // esto, configuración del proyecto anterior persistía en dashboard /
  // analítica / gráficos / wizards mientras los stores re-hidrataban.
  useStoreResetOnSessionChange();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const closeDialog = useCallback(() => {
    if (project.busy || dialogAction) return;
    setDialogIntent(null);
    setDialogError("");
    setDialogNotice("");
  }, [dialogAction, project.busy]);

  const openDialog = useCallback((intent: ProjectLifecycleIntent) => {
    setDialogError("");
    setDialogNotice("");
    setDialogAction(null);
    setDialogIntent(intent);
  }, []);

  const finishAppExit = useCallback(async () => {
    if (window.prosecnurApi?.confirmAppClose) {
      await window.prosecnurApi.confirmAppClose();
      return;
    }
    await apiShutdown().catch(() => null);
    try {
      window.close();
    } catch {
      // Algunos navegadores ignoran window.close() si la ventana no fue abierta por script.
    }
  }, []);

  const closeProjectToSelector = useCallback(async () => {
    const closed = await project.close();
    if (!closed) {
      setDialogError("No pudimos volver al selector. Inténtalo otra vez.");
      return false;
    }
    setDialogIntent(null);
    return true;
  }, [project]);

  const runDialogAction = useCallback(async (
    action: Exclude<ProjectLifecycleAction, null>,
    runner: () => Promise<boolean | void>,
  ) => {
    if (dialogAction || project.busy) return;
    setDialogError("");
    setDialogNotice("");
    setDialogAction(action);
    try {
      await runner();
    } finally {
      if (mountedRef.current) setDialogAction(null);
    }
  }, [dialogAction, project.busy]);

  const handleDialogSave = useCallback(() => {
    void runDialogAction("save", async () => {
      const saved = await project.save();
      if (!saved) {
        setDialogError("No pudimos guardar el proyecto. Revisa el archivo e inténtalo otra vez.");
        return;
      }
      setDialogNotice("Proyecto guardado.");
    });
  }, [project, runDialogAction]);

  const handleDialogSaveAs = useCallback(() => {
    void runDialogAction("saveAs", async () => {
      const saved = await project.saveAs();
      if (saved) setDialogNotice("Copia guardada como nuevo archivo .pulso.");
    });
  }, [project, runDialogAction]);

  const handleSaveAndContinue = useCallback(() => {
    const target = dialogIntent;
    if (!target) return;
    void runDialogAction(target === "appExit" ? "saveThenExit" : "saveThenSelector", async () => {
      const saved = await project.save();
      if (!saved) {
        setDialogError("No pudimos guardar el proyecto. Revisa el archivo e inténtalo otra vez.");
        return;
      }
      if (target === "appExit") {
        await finishAppExit();
      } else {
        await closeProjectToSelector();
      }
    });
  }, [closeProjectToSelector, dialogIntent, finishAppExit, project, runDialogAction]);

  const handleContinueWithoutSave = useCallback(() => {
    const target = dialogIntent;
    if (!target) return;
    void runDialogAction(target === "appExit" ? "exit" : "selector", async () => {
      if (target === "appExit") {
        await finishAppExit();
      } else {
        await closeProjectToSelector();
      }
    });
  }, [closeProjectToSelector, dialogIntent, finishAppExit, runDialogAction]);

  const openProjectViewer = useCallback(() => {
    openDialog("manage");
  }, [openDialog]);

  const requestProjectSelector = useCallback(() => {
    if (!project.status.has_project) {
      void project.close();
      return;
    }
    openDialog("selector");
  }, [openDialog, project]);

  const requestAppExit = useCallback(() => {
    void (async () => {
      const latest = await project.refresh();
      const status = latest ?? project.status;
      if (status.has_project) {
        openDialog("appExit");
        return;
      }
      await finishAppExit();
    })();
  }, [finishAppExit, openDialog, project]);

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
        requestProjectSelector();
      } else if (command.startsWith("project:openRecent:")) {
        const path = command.slice("project:openRecent:".length);
        await project.open(path);
      }
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [project, requestProjectSelector]);

  useEffect(() => {
    const electronApi = window.prosecnurApi;
    if (!electronApi) return undefined;
    electronApi.setAppCloseGuardReady?.(true);
    const cleanup = electronApi.onAppCloseRequest?.(() => {
      requestAppExit();
    });
    return () => {
      cleanup?.();
      electronApi.setAppCloseGuardReady?.(false);
    };
  }, [requestAppExit]);

  const ctxValue = useMemo<ProjectShellCtx>(
    () => ({
      project,
      openProjectViewer,
      requestProjectSelector,
      requestAppExit,
    }),
    [openProjectViewer, project, requestAppExit, requestProjectSelector],
  );

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      {dialogIntent && typeof document !== "undefined" && createPortal(
        <ProjectLifecycleDialog
          intent={dialogIntent}
          projectName={project.status.name ?? "Proyecto"}
          projectPath={project.status.path ?? ""}
          dirty={project.status.dirty}
          lastSavedAt={project.status.last_saved_at}
          busy={project.busy || !!dialogAction}
          action={dialogAction}
          error={dialogError || project.error}
          notice={dialogNotice}
          onCancel={closeDialog}
          onSave={handleDialogSave}
          onSaveAs={handleDialogSaveAs}
          onSaveAndContinue={handleSaveAndContinue}
          onContinueWithoutSave={handleContinueWithoutSave}
        />,
        document.body,
      )}
    </Ctx.Provider>
  );
}
