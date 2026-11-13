import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import type { ReglaCustomHallazgoKind, ReglaCustomSeveridad } from "../types";

// =============================================================================
// ClasificacionHallazgo — qué es lo que el criterio detecta.
// =============================================================================
// Un pliego de revisión separa dos cosas: la INCONSISTENCIA (dos respuestas que
// no pueden ser ciertas a la vez) y el CASO A REVISAR (improbable, pero el
// instrumento lo permite). El backend ya distingue ambas (`hallazgo_kind`) y
// Limpieza las rotula distinto; este control es el que deja elegirlo. Desde la
// rebanada V2 del plan de fidelidad va en la caja "Resultado" del panel de
// regla, como el par de opciones del prototipo (`pp-rg-prod`): un grupo de
// radio del kit, con flechas del teclado.

export const CLASIFICACIONES: Array<{
  value: ReglaCustomHallazgoKind;
  label: string;
  description: string;
  severidad: ReglaCustomSeveridad;
}> = [
  {
    value: "inconsistencia_usuario",
    label: "Inconsistencia",
    description: "Las respuestas no pueden ser ciertas a la vez. Se corrige o se anula.",
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
    <GlidingRadioGroup
      className="pulso-clasificacion-hallazgo"
      aria-label="Tipo de hallazgo"
      value={value}
      options={CLASIFICACIONES}
      getOptionValue={(item) => item.value}
      onValueChange={onChange}
      getOptionProps={(item) => ({
        // La piel de la tarjeta es la de siempre (`validacion-v2.css`); el panel
        // de regla la ajusta a la del prototipo. `is-active` lo pone el grupo.
        className: ["pulso-treatment-card", item.value === "inconsistencia_usuario" ? "is-inconsistencia" : "is-revisar"].join(" "),
        // Cada radio se anuncia por su clase; la descripción queda como ayuda.
        "aria-label": item.label,
      })}
    >
      {(item) => (
        <>
          <span className="pulso-treatment-card-check" aria-hidden="true" />
          <span className="pulso-clasificacion-texto">
            <strong className="pulso-clasificacion-clase">{item.label}</strong>
            <small>{item.description}</small>
          </span>
        </>
      )}
    </GlidingRadioGroup>
  );
}
