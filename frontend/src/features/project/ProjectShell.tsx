// =============================================================================
// ProjectShell — wrapper que pega el feature project al árbol de la app
// =============================================================================
// Hace 4 cosas:
//   1. Instancia useProject + useAutosave una sola vez (raíz de la app).
//   2. Provee el state via ProjectContext para que el Layout (header) y
//      cualquier consumer profundo accedan sin prop-drilling.
//   3. Monta el StartModal cuando NO hay proyecto activo (forzar decisión:
//      nuevo / abrir / reciente). Permite reabrirlo on-demand desde el
//      ProjectIndicator (acción "Cambiar de proyecto").
//   4. Conecta los comandos del menú nativo (Cmd+S/Cmd+O/Cmd+N/etc.) que
//      el main process envía vía window.prosecnurApi.onMenuCommand.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import StartModal from "./StartModal";
import { useAutosave } from "./useAutosave";
import { useProject, type UseProjectReturn } from "./useProject";
import { useSession } from "../../lib/SessionContext";
import { useStoreResetOnSessionChange } from "../../lib/useStoreResetOnSessionChange";

type ProjectShellCtx = {
  project: UseProjectReturn;
  openStartModal: () => void;
};

const Ctx = createContext<ProjectShellCtx | null>(null);

export function useProjectShell(): ProjectShellCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectShell debe usarse dentro de <ProjectShell>");
  return ctx;
}

export default function ProjectShell({ children }: { children: React.ReactNode }) {
  const { sessionId } = useSession();
  const project = useProject(sessionId);
  useAutosave(project);
  // Resetea stores Zustand globales al cambiar de proyecto (sid). Sin
  // esto, configuración del proyecto anterior persistía en dashboard /
  // analítica / gráficos / wizards mientras los autosaves re-hidrataban.
  useStoreResetOnSessionChange();

  // El modal aparece cuando NO hay proyecto activo. Sin modo efímero: el
  // usuario debe crear o abrir un .pulso para usar la app. Queda cerrado
  // mientras hay proyecto; reabre con "Cambiar de proyecto".
  const [showStart, setShowStart] = useState(true);

  const openStartModal = useCallback(() => setShowStart(true), []);

  // Sincronizar visibilidad del modal con el estado del proyecto. Si el
  // backend dice que hay proyecto, ocultar; si no, mostrar (ej. tras un
  // close, o al arranque mientras se rehidrata).
  useEffect(() => {
    setShowStart(!project.status.has_project);
  }, [project.status.has_project]);

  // Suscribir a comandos del menú nativo (Cmd+S, Cmd+O, etc.)
  useEffect(() => {
    if (!window.prosecnurApi) return undefined;
    const cleanup = window.prosecnurApi.onMenuCommand(async (command) => {
      if (command === "project:new") {
        const r = await project.newProject();
        if (r) setShowStart(false);
      } else if (command === "project:open") {
        const r = await project.open();
        if (r) setShowStart(false);
      } else if (command === "project:save") {
        await project.save();
      } else if (command === "project:saveAs") {
        await project.saveAs();
      } else if (command === "project:close") {
        await project.close();
        setShowStart(true);
      } else if (command.startsWith("project:openRecent:")) {
        const path = command.slice("project:openRecent:".length);
        const r = await project.open(path);
        if (r) setShowStart(false);
      }
    });
    return cleanup;
  }, [project]);

  const ctxValue = useMemo<ProjectShellCtx>(
    () => ({ project, openStartModal }),
    [project, openStartModal],
  );

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      {showStart && (
        <StartModal
          project={project}
          onDone={() => setShowStart(false)}
        />
      )}
    </Ctx.Provider>
  );
}
