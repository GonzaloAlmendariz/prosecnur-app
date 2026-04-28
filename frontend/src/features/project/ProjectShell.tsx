// =============================================================================
// ProjectShell — wrapper que pega el feature project al árbol de la app
// =============================================================================
// Hace 4 cosas:
//   1. Instancia useProject + useAutosave una sola vez (raíz de la app).
//   2. Provee el state via ProjectContext para que el Layout (header) y
//      cualquier consumer profundo accedan sin prop-drilling.
//   3. Monta el StartModal al primer load (forzar decisión: nuevo / abrir
//      / reciente / efímero) y permite reabrirlo on-demand desde el
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

  // El modal aparece una vez al arranque cuando NO hay proyecto activo.
  // El usuario puede descartarlo eligiendo "Trabajar sin proyecto" o
  // creando/abriendo uno. Tras eso, queda cerrado hasta que el user
  // pida "Cambiar de proyecto".
  const [showStart, setShowStart] = useState(true);

  const openStartModal = useCallback(() => setShowStart(true), []);

  // Si el backend dice que ya hay proyecto activo (ej. la app reinició
  // pero el sid persistió en localStorage), cerrar el modal.
  useEffect(() => {
    if (project.status.has_project) setShowStart(false);
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
          onSkip={() => setShowStart(false)}
          onDone={() => setShowStart(false)}
        />
      )}
    </Ctx.Provider>
  );
}
