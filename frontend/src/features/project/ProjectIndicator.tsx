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
  AlertTriangle,
  CheckCircle2,
  Circle,
  Folder,
  Home,
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
  const refsPerdidas = project.refsPerdidas ?? [];
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
        {/* El último guardado dejó fuera una referencia que el proyecto declara:
            el `.pulso` sale completo a la vista y roto al reabrirlo en otra
            máquina. Se dice en el chip —que es donde el analista mira si
            guardó— y el detalle va en el tooltip, con la salida. */}
        {refsPerdidas.length > 0 && (
          <span
            className="pulso-project-chip-status is-dirty"
            title={`El .pulso se guardó sin ${refsPerdidas.join(", ")}. El archivo ya no estaba en la sesión, así que al abrirlo en otra máquina esa pieza faltará. Vuelve a subirla y guarda otra vez.`}
            aria-label={`Guardado sin ${refsPerdidas.join(", ")}`}
          >
            <AlertTriangle size={10} />
            <span>{refsPerdidas.length === 1 ? "falta 1 recurso" : `faltan ${refsPerdidas.length} recursos`}</span>
          </span>
        )}
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
        <Home size={13} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
