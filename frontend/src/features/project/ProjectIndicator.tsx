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
  const { status } = project;

  if (!status.has_project) {
    return (
      <button
        type="button"
        onClick={onRequestStartModal}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px dashed var(--pulso-border)",
          background: "transparent",
          color: "var(--pulso-text-soft)",
          fontSize: 11,
          cursor: "pointer",
        }}
        title="Crear o abrir un proyecto .pulso"
      >
        <Circle size={11} /> Sin proyecto (efímero)
      </button>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${status.dirty ? "var(--pulso-warn-accent)" : "var(--pulso-success-border)"}`,
          background: status.dirty ? "var(--pulso-warn-bg)" : "var(--pulso-success-bg)",
          color: status.dirty ? "var(--pulso-warn-fg)" : "var(--pulso-success-fg)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Folder size={12} />
        <span>{status.name}</span>
        <span style={{ opacity: 0.7 }}>·</span>
        {status.dirty ? (
          <>
            <Circle size={9} fill="currentColor" />
            <span>sin guardar</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={11} />
            <span>{relTime(status.last_saved_at)}</span>
          </>
        )}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "white",
            border: "1px solid var(--pulso-border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            padding: 6,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{
            padding: "6px 10px",
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            color: "var(--pulso-text-soft)",
            borderBottom: "1px solid var(--pulso-border)",
            marginBottom: 4,
            wordBreak: "break-all",
          }}>
            {status.path}
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
          style={{
            position: "fixed", inset: 0,
            zIndex: 99,
          }}
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 4,
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 12,
        color: "var(--pulso-text)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--pulso-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          fontFamily: "ui-monospace, monospace",
        }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}
