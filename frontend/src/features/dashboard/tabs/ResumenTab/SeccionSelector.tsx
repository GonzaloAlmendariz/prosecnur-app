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
      className="dash-section-select"
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
