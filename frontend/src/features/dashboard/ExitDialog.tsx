import { useEffect, useRef } from "react";
import { AlertTriangle, Power, X } from "lucide-react";

// Modal de confirmación al cerrar la app. Aparece al clickear el botón
// "Cerrar aplicación" del Home.
//
// El progreso del estudio ya se guarda automáticamente en la sesión
// vía autosave, por lo que cerrar no borra datos — pero queremos que
// el analista tome la decisión de forma consciente, y dejar la
// puerta abierta para guardar un archivo `.pulso` binario con el
// snapshot completo del estudio (roadmap).
//
// Diseño: overlay estándar (`rgba(15, 23, 42, 0.4)`), shadow-high,
// focus inicial en "Cancelar" para que Enter no cierre por accidente,
// Escape cierra el modal.

export function ExitDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus "Cancelar" por seguridad — Enter no ejecuta "Cerrar".
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape → cancelar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="exit-dialog-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--pulso-border)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: "var(--pulso-warn-bg)",
              color: "var(--pulso-warn-fg)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--pulso-warn-border)",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={16} />
          </span>
          <h2
            id="exit-dialog-title"
            style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}
          >
            ¿Cerrar Prosecnur?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="pulso-icon"
            aria-label="Cancelar"
          >
            <X size={13} />
          </button>
        </header>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--pulso-text)" }}>
            Tu progreso se guardó automáticamente en la sesión actual. Al volver a abrir
            Prosecnur, podrás retomar el estudio donde lo dejaste.
          </p>
          <div
            role="note"
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 6,
              background: "var(--pulso-info-bg)",
              border: "1px solid var(--pulso-info-border)",
              fontSize: 11, lineHeight: 1.5,
              color: "var(--pulso-info-fg)",
            }}
          >
            <span>
              <strong>Próximamente:</strong> guardar el estudio como archivo <code style={{ fontFamily: "ui-monospace, monospace" }}>.pulso</code>
              {" "}para respaldar o compartir fuera de esta computadora.
            </span>
          </div>
        </div>

        <footer
          style={{
            display: "flex", gap: 8, justifyContent: "flex-end",
            padding: "12px 18px",
            borderTop: "1px solid var(--pulso-border)",
            background: "var(--pulso-surface-2)",
          }}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Seguir trabajando
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              fontSize: 12, padding: "7px 14px",
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--pulso-danger-fg)",
              color: "white",
              border: "1px solid var(--pulso-danger-fg)",
              borderRadius: 6, cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <Power size={12} /> Cerrar Prosecnur
          </button>
        </footer>
      </div>
    </div>
  );
}
