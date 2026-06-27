import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Clipboard,
  FilePlus2,
  FolderOpen,
  Power,
  Save,
  X,
} from "lucide-react";

export type ProjectLifecycleIntent = "manage" | "selector" | "appExit";

export type ProjectLifecycleAction =
  | "save"
  | "saveAs"
  | "saveThenSelector"
  | "selector"
  | "saveThenExit"
  | "exit"
  | null;

export function projectRelTime(iso: string | null): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = (Date.now() - t) / 1000;
  if (diff < 30) return "hace un momento";
  if (diff < 90) return "hace un minuto";
  if (diff < 60 * 60) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 60 * 60 * 24) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectLifecycleDialog({
  intent,
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
  onSaveAndContinue,
  onContinueWithoutSave,
}: {
  intent: ProjectLifecycleIntent;
  projectName: string;
  projectPath: string;
  dirty: boolean;
  lastSavedAt: string | null;
  busy: boolean;
  action: ProjectLifecycleAction;
  error: string;
  notice: string;
  onCancel: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveAndContinue: () => void;
  onContinueWithoutSave: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const isAppExit = intent === "appExit";

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

  const title = isAppExit
    ? "Cerrar Prosecnur"
    : intent === "selector"
      ? "Volver al selector"
      : "Proyecto actual";
  const lead = isAppExit
    ? dirty
      ? "Hay cambios pendientes en el archivo del proyecto. Guarda antes de cerrar o continúa sin guardar."
      : "El proyecto está guardado. Puedes cerrar Prosecnur cuando quieras."
    : dirty
      ? "Hay cambios pendientes. Guarda el archivo antes de cambiar de proyecto o vuelve sin guardar."
      : "El archivo del proyecto está guardado y listo para abrir otro proyecto.";
  const primaryLabel = isAppExit
    ? dirty
      ? "Guardar y cerrar"
      : "Cerrar Prosecnur"
    : dirty
      ? "Guardar y volver"
      : "Volver al selector";
  const secondaryDangerLabel = isAppExit ? "Cerrar sin guardar" : "Volver sin guardar";
  const primaryAction = isAppExit
    ? dirty
      ? "saveThenExit"
      : "exit"
    : dirty
      ? "saveThenSelector"
      : "selector";

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
      <section
        className={`pulso-project-confirm ${dirty ? "is-dirty" : "is-saved"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pulso-project-confirm-head">
          <span className="pulso-project-confirm-icon" aria-hidden="true">
            {isAppExit ? <Power size={17} /> : <FolderOpen size={17} />}
          </span>
          <div className="pulso-project-confirm-titleblock">
            <div className="pulso-project-confirm-kicker">
              <span>{title}</span>
              <span className="pulso-project-confirm-filetype">.pulso</span>
            </div>
            <h2 id="pulso-project-confirm-title">{projectName}</h2>
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
          <div className="pulso-project-confirm-summary">
            <div className={`pulso-project-confirm-state ${dirty ? "is-dirty" : "is-saved"}`}>
              {dirty ? <Circle size={8} fill="currentColor" /> : <CheckCircle2 size={14} />}
              <span>{dirty ? "Cambios sin guardar" : `Guardado ${projectRelTime(lastSavedAt)}`}</span>
            </div>
            <p>{lead}</p>
          </div>

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
            {dirty && (
              <button
                type="button"
                className="pulso-project-confirm-button is-danger"
                onClick={onContinueWithoutSave}
                disabled={busy}
              >
                {isAppExit ? <Power size={14} /> : <FolderOpen size={14} />}
                {action === (isAppExit ? "exit" : "selector") ? "Saliendo..." : secondaryDangerLabel}
              </button>
            )}
            <button
              type="button"
              className="pulso-project-confirm-button is-primary"
              onClick={dirty ? onSaveAndContinue : onContinueWithoutSave}
              disabled={busy}
            >
              {isAppExit ? <Power size={14} /> : <FolderOpen size={14} />}
              {action === primaryAction ? "Procesando..." : primaryLabel}
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
