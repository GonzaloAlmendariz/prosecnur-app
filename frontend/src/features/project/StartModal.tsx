// =============================================================================
// StartModal — modal inicial al abrir Prosecnur
// =============================================================================
// Aparece UNA vez al arranque (si no hay proyecto activo). 4 acciones:
//   - Nuevo proyecto.
//   - Abrir proyecto…
//   - Abrir reciente (submenú con hasta 5).
//   - Trabajar sin proyecto (modo efímero, downloads a ~/Downloads).
//
// Modal "soft": el user PUEDE descartarlo eligiendo "Trabajar sin proyecto",
// pero no se cierra con Escape ni clickeando fuera. Forzamos la decisión.

import { useState } from "react";
import {
  Clock,
  FilePlus2,
  FolderOpen,
  Loader2,
  PlayCircle,
} from "lucide-react";
import type { UseProjectReturn } from "./useProject";

type Props = {
  project: UseProjectReturn;
  onSkip: () => void;     // "Trabajar sin proyecto"
  onDone: () => void;     // tras crear/abrir exitosamente
};

export default function StartModal({ project, onSkip, onDone }: Props) {
  const [showRecent, setShowRecent] = useState(false);

  async function handleNew() {
    const r = await project.newProject();
    if (r) onDone();
  }

  async function handleOpen() {
    const r = await project.open();
    if (r) onDone();
  }

  async function handleOpenRecent(path: string) {
    const r = await project.open(path);
    if (r) onDone();
  }

  const hasElectron = typeof window !== "undefined" && !!window.prosecnurApi;

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
            Elige cómo quieres trabajar. Puedes guardar tu proyecto en un
            archivo <code style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              background: "var(--pulso-surface-2)",
              padding: "1px 5px",
              borderRadius: 3,
            }}>.pulso</code> para retomarlo después.
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
            <strong>Modo navegador:</strong> los diálogos para crear/abrir
            proyectos requieren la app de escritorio (Prosecnur.app). Por
            ahora puedes trabajar en modo efímero.
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
            hint="Crea un .pulso vacío en una carpeta"
            onClick={handleNew}
            disabled={!hasElectron || project.busy}
            primary
          />
          <ActionButton
            icon={<FolderOpen size={20} />}
            label="Abrir proyecto…"
            hint="Selecciona un .pulso existente"
            onClick={handleOpen}
            disabled={!hasElectron || project.busy}
          />
          <ActionButton
            icon={<Clock size={20} />}
            label="Abrir reciente"
            hint={
              project.recents.length > 0
                ? `${project.recents.length} ${project.recents.length === 1 ? "proyecto" : "proyectos"}`
                : "Sin recientes"
            }
            onClick={() => setShowRecent((v) => !v)}
            disabled={project.recents.length === 0 || project.busy}
          />
          <ActionButton
            icon={<PlayCircle size={20} />}
            label="Trabajar sin proyecto"
            hint="Sesión efímera, descargas al sistema"
            onClick={onSkip}
            disabled={project.busy}
          />
        </div>

        {showRecent && project.recents.length > 0 && (
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
            {project.recents.map((r) => (
              <button
                key={r.path}
                type="button"
                onClick={() => handleOpenRecent(r.path)}
                disabled={project.busy}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid transparent",
                  background: "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pulso-text)" }}>
                  {r.name}
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
                  {r.path}
                </span>
              </button>
            ))}
          </div>
        )}

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
