// =============================================================================
// ProjectIndicator — pill del header que muestra el proyecto activo
// =============================================================================
// Estados:
//   - Sin proyecto: "Seleccionar proyecto"
//   - Con proyecto, guardado: "📁 NombreProyecto · ✓ guardado hace 2 min"
//   - Con proyecto, dirty: "📁 NombreProyecto · ● cambios sin guardar"
//
// Click abre una hoja neutral de proyecto: guardar, guardar como, copiar ruta
// o volver al selector inicial.

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Folder,
  Repeat,
} from "lucide-react";
import { projectRelTime } from "./ProjectLifecycleDialog";
import type { UseProjectReturn } from "./useProject";

type Props = {
  project: UseProjectReturn;
  onOpenProjectViewer: () => void;
  onRequestSelector: () => void;
};

export default function ProjectIndicator({ project, onOpenProjectViewer, onRequestSelector }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { status } = project;
  const projectPath = status.path ?? "";

  if (!status.has_project) {
    return (
      <div className="pulso-project-indicator is-empty">
        <button
          type="button"
          onClick={onRequestSelector}
          className="pulso-project-chip pulso-project-chip--empty"
          title="Volver a la selección de proyecto"
        >
          <span className="pulso-project-chip-icon" aria-hidden="true">
            <Circle size={10} />
          </span>
          <span className="pulso-project-chip-name">Seleccionar proyecto</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`pulso-project-indicator ${viewerOpen ? "is-open" : ""}`}>
      <button
        type="button"
        onClick={() => {
          setViewerOpen(true);
          onOpenProjectViewer();
        }}
        title={projectPath ? `Gestionar proyecto · ${projectPath}` : "Gestionar proyecto"}
        className={`pulso-project-chip ${status.dirty ? "is-dirty" : "is-saved"}`}
        disabled={project.busy}
        onBlur={() => setViewerOpen(false)}
      >
        <span className="pulso-project-chip-icon" aria-hidden="true">
          <Folder size={13} />
        </span>
        <span className="pulso-project-chip-copy">
          <span className="pulso-project-chip-name">{status.name}</span>
        </span>
        <span className={`pulso-project-chip-status ${status.dirty ? "is-dirty" : "is-saved"}`}>
          {status.dirty ? (
            <>
              <Circle size={7} fill="currentColor" />
              <span>sin guardar</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={10} />
              <span>{projectRelTime(status.last_saved_at)}</span>
            </>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onRequestSelector}
        title="Cambiar de proyecto"
        aria-label="Cambiar de proyecto"
        className="pulso-project-switch"
        disabled={project.busy}
      >
        <Repeat size={13} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
