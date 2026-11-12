import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import type { ExplorarFuente } from "../../../../api/validacion";
import { fechaCorta } from "../../pestanas/cabeceraDeValidacion";

const OPCIONES: readonly { valor: ExplorarFuente; etiqueta: string }[] = [
  { valor: "raw", etiqueta: "Cargada" },
  { valor: "final", etiqueta: "Limpia" },
];

/**
 * Versión de la base que se explora, en la cabecera de la pestaña (prototipo,
 * D-F9): la cargada o la limpia. "Limpia" queda deshabilitada hasta que se
 * cierre la base; cerrada, su título dice cuándo.
 */
export default function FuenteToggle({
  fuente,
  onChange,
  finalizedAt,
}: {
  fuente: ExplorarFuente;
  onChange: (f: ExplorarFuente) => void;
  /** Cuándo se cerró la base; `null` si no está cerrada. */
  finalizedAt: string | null;
}) {
  const cerrada = !!finalizedAt;
  const cerradaEl = fechaCorta(finalizedAt);
  return (
    <GlidingRadioGroup
      value={fuente}
      options={OPCIONES}
      getOptionValue={(o) => o.valor}
      onValueChange={(v) => {
        if (v === "final" && !cerrada) return;
        onChange(v);
      }}
      className="vx-seg"
      aria-label="Versión de la base"
      getOptionProps={(o) => ({
        disabled: o.valor === "final" && !cerrada,
        title:
          o.valor === "raw"
            ? "Respuestas tal como se cargaron"
            : cerrada
              ? cerradaEl ? `Base cerrada el ${cerradaEl}, con las decisiones de Hallazgos` : "Base cerrada, con las decisiones de Hallazgos"
              : "Disponible al cerrar la base",
      })}
    >
      {(o) => <span>{o.etiqueta}</span>}
    </GlidingRadioGroup>
  );
}
