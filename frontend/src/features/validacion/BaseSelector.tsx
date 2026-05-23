import { Database, Layers } from "lucide-react";
import type { EstudioPayload } from "../../api/client";

// =============================================================================
// BaseSelector — selector de base arriba del todo en Fase 2
// =============================================================================
// Multi-base: grupo de chips tipo "tabs" con el nombre de cada base.
// Single-base (sin estudio o con 1 sola base): se oculta, no tiene sentido
// ofrecer un selector. El valor `null` significa "usa la primera base por
// defecto" y el backend lo resuelve.
//
// Cambiar de base dispara una invalidación masiva de caché en los tabs
// (vía `version` en el store) — el caller ya lo maneja.

type Props = {
  estudio: EstudioPayload | null;
  selected: string | null;
  onChange: (nombre: string) => void;
  disabled?: boolean;
  className?: string;
};

export default function BaseSelector({ estudio, selected, onChange, disabled, className }: Props) {
  if (!estudio || estudio.n_bases <= 1) return null;

  const bases = Object.values(estudio.bases);

  return (
    <div
      role="tablist"
      aria-label="Base activa para validar"
      className={["pulso-validacion-base-selector", className].filter(Boolean).join(" ")}
    >
      <span
        aria-hidden="true"
        className="pulso-validacion-base-label"
      >
        <Layers size={12} /> Validar
      </span>
      <div className="pulso-validacion-base-list">
        {bases.map((b) => {
          const active = b.nombre === selected;
          return (
            <button
              key={b.nombre}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(b.nombre)}
              disabled={disabled || active}
              title={
                b.n_filas != null
                  ? `${b.nombre} · ${b.n_filas} filas · ${b.n_columnas} cols`
                  : b.nombre
              }
              className={`pulso-validacion-base-chip${active ? " is-active" : ""}`}
            >
              <Database size={11} />
              {b.nombre}
              {b.n_filas != null && (
                <span>
                  · {b.n_filas}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
