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

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Clipboard,
  FilePlus2,
  Folder,
  FolderOpen,
  Save,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { UseProjectReturn } from "./useProject";

type Props = {
  project: UseProjectReturn;
};

type ProjectDialogAction = "save" | "saveAs" | "selector" | null;

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

export default function ProjectIndicator({ project }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [confirmNotice, setConfirmNotice] = useState("");
  const [submittingAction, setSubmittingAction] = useState<ProjectDialogAction>(null);
  const mountedRef = useRef(true);
  const { status } = project;
  const projectPath = status.path ?? "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSave = async () => {
    if (submittingAction || project.busy) return;
    setConfirmError("");
    setConfirmNotice("");
    setSubmittingAction("save");
    try {
      const saved = await project.save();
      if (!saved) {
        setConfirmError("No pudimos guardar el proyecto. Revisa el archivo e inténtalo otra vez.");
        return;
      }
      setConfirmNotice("Proyecto guardado.");
    } finally {
      if (mountedRef.current) setSubmittingAction(null);
    }
  };

  const handleSaveAs = async () => {
    if (submittingAction || project.busy) return;
    setConfirmError("");
    setConfirmNotice("");
    setSubmittingAction("saveAs");
    try {
      const saved = await project.saveAs();
      if (saved) setConfirmNotice("Copia guardada como nuevo archivo .pulso.");
    } finally {
      if (mountedRef.current) setSubmittingAction(null);
    }
  };

  const handleReturnToSelector = async () => {
    if (submittingAction || project.busy) return;
    setConfirmError("");
    setConfirmNotice("");
    setSubmittingAction("selector");
    try {
      const closed = await project.close();
      if (!closed) {
        setConfirmError("No pudimos volver al selector. Inténtalo otra vez.");
      }
    } finally {
      if (mountedRef.current) setSubmittingAction(null);
    }
  };

  if (!status.has_project) {
    return (
      <div className="pulso-project-indicator is-empty">
        <button
          type="button"
          onClick={() => void project.close()}
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
    <div className={`pulso-project-indicator ${confirmOpen ? "is-open" : ""}`}>
      <button
        type="button"
        onClick={() => {
          setConfirmError("");
          setConfirmNotice("");
          setConfirmOpen(true);
        }}
        title={projectPath ? `Cambiar proyecto · ${projectPath}` : "Cambiar proyecto"}
        className={`pulso-project-chip ${status.dirty ? "is-dirty" : "is-saved"}`}
        disabled={project.busy || !!submittingAction}
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
      </button>

      {confirmOpen && typeof document !== "undefined" && createPortal(
        <ProjectSelectionConfirmDialog
          projectName={status.name ?? "Proyecto"}
          projectPath={projectPath}
          dirty={status.dirty}
          lastSavedAt={status.last_saved_at}
          busy={project.busy || !!submittingAction}
          action={submittingAction}
          error={confirmError}
          notice={confirmNotice}
          onCancel={() => setConfirmOpen(false)}
          onSave={() => void handleSave()}
          onSaveAs={() => void handleSaveAs()}
          onReturnToSelector={() => void handleReturnToSelector()}
        />,
        document.body,
      )}
    </div>
  );
}

function ProjectSelectionConfirmDialog({
  projectName,
  projectPath,
  dirty,
  lastSavedAt,
  busy,
  action,
  error,
  notice,
  onCancel,
  onSave,
  onSaveAs,
  onReturnToSelector,
}: {
  projectName: string;
  projectPath: string;
  dirty: boolean;
  lastSavedAt: string | null;
  busy: boolean;
  action: ProjectDialogAction;
  error: string;
  notice: string;
  onCancel: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onReturnToSelector: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    if (!copiedPath) return;
    const timeout = window.setTimeout(() => setCopiedPath(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedPath]);

  async function copyProjectPath() {
    if (!projectPath) return;
    try {
      await writeClipboardText(projectPath);
      setCopiedPath(true);
    } catch {
      setCopiedPath(false);
    }
  }

  return (
    <div
      className="pulso-project-confirm-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulso-project-confirm-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <section className="pulso-project-confirm" onClick={(event) => event.stopPropagation()}>
        <header className="pulso-project-confirm-head">
          <span className="pulso-project-confirm-icon" aria-hidden="true">
            <FolderOpen size={16} />
          </span>
          <div>
            <h2 id="pulso-project-confirm-title">Proyecto actual</h2>
            <p>{projectName}</p>
          </div>
          <button
            type="button"
            className="pulso-icon"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancelar"
          >
            <X size={13} />
          </button>
        </header>

        <div className="pulso-project-confirm-body">
          <div className={`pulso-project-confirm-state ${dirty ? "is-dirty" : "is-saved"}`}>
            {dirty ? <Circle size={8} fill="currentColor" /> : <CheckCircle2 size={14} />}
            <span>{dirty ? "Cambios sin guardar" : `Guardado ${relTime(lastSavedAt)}`}</span>
          </div>
          <p>
            Puedes guardar el archivo actual, crear una copia o volver al selector para abrir otro proyecto.
          </p>
          {projectPath && (
            <div className="pulso-project-confirm-path">
              <span>Ruta del proyecto</span>
              <code>{projectPath}</code>
              <button
                type="button"
                className="pulso-project-confirm-copy"
                onClick={() => void copyProjectPath()}
                disabled={busy}
              >
                {copiedPath ? <Check size={12} /> : <Clipboard size={12} />}
                {copiedPath ? "Copiada" : "Copiar ruta"}
              </button>
            </div>
          )}
          {notice && (
            <p className="pulso-project-confirm-notice" role="status">{notice}</p>
          )}
          {error && (
            <p className="pulso-project-confirm-error" role="alert">{error}</p>
          )}
        </div>

        <footer className="pulso-project-confirm-actions">
          <button
            type="button"
            className="pulso-project-confirm-button"
            onClick={onCancel}
            disabled={busy}
            ref={cancelRef}
          >
            Cancelar
          </button>
          <div className="pulso-project-confirm-action-set">
            <button
              type="button"
              className="pulso-project-confirm-button"
              onClick={onSave}
              disabled={busy}
            >
              <Save size={14} />
              {action === "save" ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              className="pulso-project-confirm-button"
              onClick={onSaveAs}
              disabled={busy}
            >
              <FilePlus2 size={14} />
              {action === "saveAs" ? "Guardando..." : "Guardar como..."}
            </button>
            <button
              type="button"
              className="pulso-project-confirm-button is-primary"
              onClick={onReturnToSelector}
              disabled={busy}
            >
              <FolderOpen size={14} />
              {action === "selector" ? "Abriendo selector..." : "Volver al selector"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
