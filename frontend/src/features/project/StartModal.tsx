// =============================================================================
// StartModal — modal inicial al abrir Prosecnur
// =============================================================================
// Forza la decisión: dos acciones (Nuevo / Abrir) + lista de proyectos
// recientes con click-para-abrir y papelera-para-quitar-de-la-lista (NO borra
// el archivo en disco). El modo efímero ya no existe — todo flujo necesita
// un .pulso.
//
// En modo navegador (sin Electron, ej. Vite preview) los botones abren un
// input de path manual en vez del file picker nativo.

import { useState } from "react";
import { FilePlus2, FolderOpen, Loader2, Trash2 } from "lucide-react";
import type { UseProjectReturn } from "./useProject";

type Props = {
  project: UseProjectReturn;
  onDone: () => void;     // tras crear/abrir exitosamente
};

export default function StartModal({ project, onDone }: Props) {
  // Modo navegador: input de path manual para abrir un .pulso existente o
  // crear uno nuevo sin el file picker nativo de Electron.
  const [pathMode, setPathMode] = useState<null | "open" | "new">(null);
  const [manualPath, setManualPath] = useState("");
  // Path del reciente que el usuario quiere quitar — controla el modal de
  // confirmación. null = no hay confirmación pendiente.
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);
  const hasElectron = typeof window !== "undefined" && !!window.prosecnurApi;

  async function handleNew() {
    if (!hasElectron) {
      setPathMode("new");
      setManualPath("");
      return;
    }
    const r = await project.newProject();
    if (r) onDone();
  }

  async function handleOpen() {
    if (!hasElectron) {
      setPathMode("open");
      setManualPath("");
      return;
    }
    const r = await project.open();
    if (r) onDone();
  }

  async function handleOpenRecent(path: string) {
    const r = await project.open(path);
    if (r) onDone();
  }

  async function handleSubmitManualPath() {
    const p = manualPath.trim();
    if (!p) return;
    if (pathMode === "open") {
      const r = await project.open(p);
      if (r) {
        setPathMode(null);
        onDone();
      }
    } else if (pathMode === "new") {
      const r = await project.newProject("MiProyecto", p);
      if (r) {
        setPathMode(null);
        onDone();
      }
    }
  }

  async function handleConfirmRemove() {
    if (!confirmRemovePath) return;
    await project.removeRecent(confirmRemovePath);
    setConfirmRemovePath(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24, 33, 31, 0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div style={{
        width: "min(640px, 100%)",
        background: "white",
        borderRadius: 12,
        padding: 28,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <header style={{ marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--pulso-text)" }}>
            Bienvenido a Prosecnur
          </h1>
          <p style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
          }}>
            Crea un proyecto nuevo o abre uno existente. Los proyectos se
            guardan como archivos <code style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              background: "var(--pulso-surface-2)",
              padding: "1px 5px",
              borderRadius: 3,
            }}>.pulso</code>.
          </p>
        </header>

        {project.error && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--pulso-danger-bg)",
            border: "1px solid var(--pulso-danger-border)",
            color: "var(--pulso-danger-fg)",
            fontSize: 12,
          }}>
            {project.error}
          </div>
        )}

        {!hasElectron && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--pulso-warn-bg)",
            border: "1px solid var(--pulso-warn-border)",
            color: "var(--pulso-warn-fg)",
            fontSize: 12,
            lineHeight: 1.4,
          }}>
            <strong>Modo navegador:</strong> sin diálogo nativo de archivos.
            Crea o abre un proyecto ingresando el path absoluto al
            <code style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              padding: "0 4px",
              background: "rgba(0,0,0,0.05)",
              borderRadius: 3,
              margin: "0 2px",
            }}>.pulso</code>
            cuando se te pida.
          </div>
        )}

        {pathMode && (
          <div style={{
            padding: 10,
            borderRadius: 8,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {pathMode === "open" ? "Path absoluto al .pulso a abrir" : "Path absoluto donde guardar el .pulso nuevo"}
            </label>
            <input
              type="text"
              value={manualPath}
              autoFocus
              placeholder="/Users/.../MiProyecto.pulso"
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmitManualPath();
                else if (e.key === "Escape") setPathMode(null);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--pulso-border)",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPathMode(null)}
                disabled={project.busy}
                style={{
                  padding: "6px 12px", borderRadius: 6,
                  border: "1px solid var(--pulso-border)",
                  background: "white", fontSize: 12, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { void handleSubmitManualPath(); }}
                disabled={project.busy || !manualPath.trim()}
                className="pulso-primary"
                style={{
                  padding: "6px 12px", borderRadius: 6, fontSize: 12,
                  cursor: project.busy ? "not-allowed" : "pointer",
                }}
              >
                {pathMode === "open" ? "Abrir" : "Crear"}
              </button>
            </div>
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 4,
        }}>
          <ActionButton
            icon={<FilePlus2 size={20} />}
            label="Nuevo proyecto"
            hint={hasElectron ? "Crea un .pulso vacío en una carpeta" : "Ingresa el path al .pulso a crear"}
            onClick={handleNew}
            disabled={project.busy}
            primary
          />
          <ActionButton
            icon={<FolderOpen size={20} />}
            label="Abrir proyecto…"
            hint={hasElectron ? "Selecciona un .pulso existente" : "Ingresa el path al .pulso a abrir"}
            onClick={handleOpen}
            disabled={project.busy}
          />
        </div>

        <div style={{
          marginTop: 8,
          padding: 10,
          borderRadius: 8,
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--pulso-text-soft)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
          }}>
            Recientes
          </div>
          {project.recents.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: "var(--pulso-text-soft)",
              padding: "8px 4px",
              fontStyle: "italic",
            }}>
              Sin proyectos recientes.
            </div>
          ) : (
            project.recents.map((r) => (
              <RecentRow
                key={r.path}
                name={r.name}
                path={r.path}
                disabled={project.busy}
                onOpen={() => handleOpenRecent(r.path)}
                onRemove={() => setConfirmRemovePath(r.path)}
              />
            ))
          )}
        </div>

        {project.busy && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--pulso-text-soft)",
            fontSize: 12,
          }}>
            <Loader2 size={14} className="pulso-spin" /> Trabajando…
          </div>
        )}

        <p style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--pulso-text-soft)",
          lineHeight: 1.4,
        }}>
          Tip: si guardas el .pulso fuera de <code>~/Documents</code> evitas
          problemas de permisos de macOS.
        </p>
      </div>

      {confirmRemovePath && (
        <ConfirmRemoveDialog
          path={confirmRemovePath}
          onCancel={() => setConfirmRemovePath(null)}
          onConfirm={handleConfirmRemove}
          busy={project.busy}
        />
      )}
    </div>
  );
}

function RecentRow({
  name, path, disabled, onOpen, onRemove,
}: {
  name: string;
  path: string;
  disabled?: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 6,
    }}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 2,
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid transparent",
          background: "white",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pulso-text)" }}>
          {name}
        </span>
        <span style={{
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          fontFamily: "ui-monospace, monospace",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}>
          {path}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title="Quitar de recientes (no borra el archivo)"
        aria-label={`Quitar ${name} de recientes`}
        style={{
          padding: 8,
          borderRadius: 6,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--pulso-text-soft)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = "var(--pulso-danger-bg, rgba(220, 38, 38, 0.08))";
            e.currentTarget.style.color = "var(--pulso-danger-fg, #b91c1c)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--pulso-text-soft)";
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ConfirmRemoveDialog({
  path, onCancel, onConfirm, busy,
}: {
  path: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          background: "white",
          borderRadius: 12,
          padding: 22,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--pulso-text)" }}>
          ¿Quitar de recientes?
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          Solo se quitará de la lista de proyectos recientes.
          <br />
          <strong>El archivo .pulso no se borra del disco.</strong>
        </p>
        <code style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          padding: "6px 10px",
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 6,
          wordBreak: "break-all",
          color: "var(--pulso-text-soft)",
        }}>
          {path}
        </code>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "8px 14px", borderRadius: 6,
              border: "1px solid var(--pulso-border)",
              background: "white", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "8px 14px", borderRadius: 6,
              border: "none",
              background: "var(--pulso-danger-fg, #b91c1c)",
              color: "white",
              fontSize: 13, fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Quitar
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon, label, hint, onClick, disabled, primary,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={primary ? "pulso-primary" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 8,
        border: primary ? "none" : "1px solid var(--pulso-border)",
        background: primary ? undefined : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        textAlign: "left",
        minHeight: 90,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      </div>
      <span style={{
        fontSize: 11,
        color: primary ? "rgba(255,255,255,0.85)" : "var(--pulso-text-soft)",
        lineHeight: 1.4,
      }}>
        {hint}
      </span>
    </button>
  );
}
