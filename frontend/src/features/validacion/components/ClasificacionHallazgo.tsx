import { CheckCircle2 } from "lucide-react";
import type { ReglaCustomHallazgoKind, ReglaCustomSeveridad } from "../types";

// =============================================================================
// ClasificacionHallazgo — qué es lo que el criterio detecta.
// =============================================================================
// Un pliego de revisión separa dos cosas: la INCONSISTENCIA (dos respuestas que
// no pueden ser ciertas a la vez) y el CASO A REVISAR (improbable, pero el
// instrumento lo permite). El backend ya distingue ambas (`hallazgo_kind`) y
// Limpieza las rotula distinto; este control es el que deja elegirlo.

export const CLASIFICACIONES: Array<{
  value: ReglaCustomHallazgoKind;
  label: string;
  description: string;
  severidad: ReglaCustomSeveridad;
}> = [
  {
    value: "inconsistencia_usuario",
    label: "Inconsistencia",
    description: "Las respuestas no pueden ser ciertas a la vez. Hay que corregir o anular.",
    severidad: "error",
  },
  {
    value: "caso_validar",
    label: "Caso a revisar",
    description: "Es improbable pero posible. Se decide caso por caso.",
    severidad: "advertencia",
  },
];

export function severidadDeClasificacion(kind: ReglaCustomHallazgoKind): ReglaCustomSeveridad {
  return CLASIFICACIONES.find((c) => c.value === kind)?.severidad ?? "advertencia";
}

/**
 * La severidad que se guarda. Si la regla ya existía y nadie cambió su clase
 * en esta edición, conserva la que traía: hay reglas con severidad "error"
 * cuya clase llega como "caso a revisar" por defecto, y abrirlas y guardarlas
 * no debe bajarlas a advertencia. Si se eligió una clase, manda la clase.
 */
export function severidadAlGuardar(
  kind: ReglaCustomHallazgoKind,
  severidadPrevia: ReglaCustomSeveridad | null | undefined,
  claseCambiada: boolean,
): ReglaCustomSeveridad {
  if (!claseCambiada && severidadPrevia) return severidadPrevia;
  return severidadDeClasificacion(kind);
}

export default function ClasificacionHallazgo({
  value,
  onChange,
}: {
  value: ReglaCustomHallazgoKind;
  onChange: (value: ReglaCustomHallazgoKind) => void;
}) {
  return (
    <section className="pulso-treatment-planner pulso-clasificacion-hallazgo">
      <header className="pulso-treatment-planner-head">
        <div>
          <span className="pulso-section-eyebrow">Clasificación</span>
          <strong>¿Qué encuentra este criterio?</strong>
        </div>
      </header>
      <div className="pulso-treatment-grid" role="radiogroup" aria-label="Clasificación del hallazgo">
        {CLASIFICACIONES.map((item) => {
          const active = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`pulso-treatment-card${active ? " is-active" : ""}`}
              onClick={() => onChange(item.value)}
            >
              <span className="pulso-treatment-card-check" aria-hidden="true">
                {active && <CheckCircle2 size={14} />}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
