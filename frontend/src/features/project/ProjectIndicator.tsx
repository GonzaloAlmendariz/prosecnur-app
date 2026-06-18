// =============================================================================
// ProjectIndicator — pill del header que muestra el proyecto activo
// =============================================================================
// Estados:
//   - Sin proyecto: "Sin proyecto · efímero"
//   - Con proyecto, guardado: "📁 NombreProyecto · ✓ guardado hace 2 min"
//   - Con proyecto, dirty: "📁 NombreProyecto · ● cambios sin guardar"
//
// Click expande un menú con: Guardar / Guardar como / Cerrar / Cambiar.

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  Folder,
  Save,
  X,
  ChevronDown,
} from "lucide-react";
import type { UseProjectReturn } from "./useProject";

type Props = {
  project: UseProjectReturn;
  onRequestStartModal: () => void;  // para "Cambiar de proyecto" → reabrir modal
};

function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 30) return "hace un momento";
  if (diff < 90) return "hace un minuto";
  if (diff < 60 * 60) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 60 * 60 * 24) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectIndicator({ project, onRequestStartModal }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { status } = project;
  const projectPath = status.path ?? "";

  if (!status.has_project) {
    return (
      <div className="pulso-project-indicator is-empty">
        <button
          type="button"
          onClick={onRequestStartModal}
          className="pulso-project-chip pulso-project-chip--empty"
          title="Crear o abrir un proyecto .pulso"
        >
          <span className="pulso-project-chip-icon" aria-hidden="true">
            <Circle size={10} />
          </span>
          <span className="pulso-project-chip-name">Sin proyecto</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`pulso-project-indicator ${open ? "is-open" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={projectPath ? `Ruta .pulso: ${projectPath}` : undefined}
        className={`pulso-project-chip ${status.dirty ? "is-dirty" : "is-saved"}`}
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
              <span>{relTime(status.last_saved_at)}</span>
            </>
          )}
        </span>
        <ChevronDown className="pulso-project-chip-chevron" size={11} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="pulso-project-menu"
        >
          <div className="pulso-project-menu-head">
            <div className="pulso-project-menu-head-row">
              <span className="pulso-project-menu-label">
                Ruta .pulso
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!projectPath) return;
                  try {
                    await navigator.clipboard?.writeText(projectPath);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  } catch {
                    setCopied(false);
                  }
                }}
                disabled={!projectPath}
                title="Copiar ruta .pulso"
                className="pulso-project-menu-copy"
              >
                <Copy size={10} />
                {copied ? "Copiada" : "Copiar"}
              </button>
            </div>
            <div className="pulso-project-menu-path">
              {projectPath}
            </div>
          </div>
          <MenuItem
            icon={<Save size={13} />}
            label="Guardar"
            shortcut="⌘S"
            onClick={() => { setOpen(false); void project.save(); }}
            disabled={!status.dirty || project.busy}
          />
          <MenuItem
            icon={<Save size={13} />}
            label="Guardar como…"
            shortcut="⌘⇧S"
            onClick={() => { setOpen(false); void project.saveAs(); }}
            disabled={project.busy}
          />
          <MenuItem
            icon={<Folder size={13} />}
            label="Cambiar de proyecto…"
            onClick={() => { setOpen(false); onRequestStartModal(); }}
            disabled={project.busy}
          />
          <MenuItem
            icon={<X size={13} />}
            label="Cerrar proyecto"
            onClick={() => { setOpen(false); void project.close(); }}
            disabled={project.busy}
          />
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="pulso-project-menu-scrim"
        />
      )}
    </div>
  );
}

function MenuItem({
  icon, label, shortcut, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="pulso-project-menu-item"
    >
      {icon}
      <span className="pulso-project-menu-item-label">{label}</span>
      {shortcut && (
        <span className="pulso-project-menu-shortcut">
          {shortcut}
        </span>
      )}
    </button>
  );
}
