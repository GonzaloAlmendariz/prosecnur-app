import type { DashboardSeccion } from "../../../../api/client";

// Selector de sección del cuestionario. Equivalente al `selectizeInput`
// del legacy en interactivo_resumen.R:86-93.

export function SeccionSelector({
  secciones,
  active,
  onSelect,
}: {
  secciones: DashboardSeccion[];
  active: string | null;
  onSelect: (nombre: string) => void;
}) {
  return (
    <select
      id="dash-seccion"
      aria-label="Sección del cuestionario"
      value={active ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      style={{
        appearance: "none",
        border: "1px solid var(--dash-borde)",
        background: "var(--dash-superficie)",
        color: "var(--dash-texto)",
        padding: "6px 28px 6px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        minWidth: 220,
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, var(--dash-texto-suave) 50%), linear-gradient(135deg, var(--dash-texto-suave) 50%, transparent 50%)",
        backgroundPosition:
          "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)",
        backgroundSize: "5px 5px",
        backgroundRepeat: "no-repeat",
      }}
    >
      {secciones.length === 0 && <option value="">— Sin secciones —</option>}
      {secciones.map((s) => (
        <option key={s.nombre} value={s.nombre}>
          {s.nombre}
        </option>
      ))}
    </select>
  );
}
