import { AlertTriangle, Info, X } from "lucide-react";
import type { Hallazgo } from "../../../api/client";

// Panel de hallazgos del validador empírico. Aparece como sidebar colapsable
// cuando el import-with-logic devuelve hallazgos (preguntas con coverage o
// tasa_respuesta sospechosa). Click en un hallazgo navega al inspector de
// esa pregunta para que el usuario revise/edite el `relevant`.
//
// NO se exporta al .xlsx — es feedback puro al usuario.

export function HallazgosPanel({
  hallazgos,
  onSelectTarget,
  onClose,
}: {
  hallazgos: Hallazgo[];
  onSelectTarget: (target: string) => void;
  onClose: () => void;
}) {
  if (hallazgos.length === 0) return null;

  const warns = hallazgos.filter((h) => h.severity === "warn");
  const infos = hallazgos.filter((h) => h.severity === "info");

  return (
    <aside
      style={{
        position: "fixed",
        right: 16,
        top: 80,
        bottom: 16,
        width: 340,
        zIndex: 100,
        background: "white",
        border: "1px solid var(--pulso-border, #e5e7eb)",
        borderRadius: 10,
        boxShadow: "var(--pulso-shadow-medium, 0 8px 24px rgba(0,0,0,0.08))",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--pulso-border, #e5e7eb)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Hallazgos del validador</h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
            {warns.length > 0 ? `${warns.length} alerta(s) · ` : ""}
            {infos.length} {infos.length === 1 ? "sugerencia" : "sugerencias"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
        >
          <X size={16} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {hallazgos.map((h, i) => (
          <HallazgoItem key={`${h.target}-${i}`} hallazgo={h} onClick={() => onSelectTarget(h.target)} />
        ))}
      </div>
    </aside>
  );
}

function HallazgoItem({
  hallazgo,
  onClick,
}: {
  hallazgo: Hallazgo;
  onClick: () => void;
}) {
  const isWarn = hallazgo.severity === "warn";
  const Icon = isWarn ? AlertTriangle : Info;
  const accent = isWarn ? "#d97706" : "#2563eb";
  const accentSoft = isWarn ? "#fef3c7" : "#dbeafe";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderLeft: `3px solid ${accent}`,
        padding: "10px 14px",
        cursor: "pointer",
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        fontSize: 12,
        color: "inherit",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = accentSoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={14} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          {hallazgo.target}
        </div>
        <div style={{ marginTop: 4, lineHeight: 1.4, color: "var(--pulso-muted, #4b5563)" }}>
          {hallazgo.mensaje}
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--pulso-muted, #6b7280)" }}>
          {hallazgo.coverage_oculta != null ? (
            <span>cobertura oculta: <strong>{(hallazgo.coverage_oculta * 100).toFixed(0)}%</strong></span>
          ) : null}
          {hallazgo.tasa_respuesta != null ? (
            <span>tasa respuesta: <strong>{(hallazgo.tasa_respuesta * 100).toFixed(0)}%</strong></span>
          ) : null}
          {hallazgo.inconsistencias.length > 0 ? (
            <span>{hallazgo.inconsistencias.length} fila(s)</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
