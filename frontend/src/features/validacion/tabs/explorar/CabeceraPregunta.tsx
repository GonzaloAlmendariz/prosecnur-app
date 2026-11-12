import type { ExploradorVariable } from "../../types";
import ChipTipo from "./ChipTipo";
import { fmtN } from "./explorarModelo";

/**
 * E2, la pregunta en una línea (prototipo `pp-preg-cab`): el código, el texto
 * como título y, debajo, el chip de tipo, cuántas opciones tiene y cuándo se
 * responde, o con qué se cruza. Va como título del contenedor central.
 */
export default function CabeceraPregunta({
  variable,
  titulo,
  nOpciones,
  condicion,
  cruce,
  repeatLabel,
  repeatInstances,
}: {
  variable: Pick<ExploradorVariable, "name" | "tipo">;
  titulo: string;
  nOpciones: number | null;
  /** Cuándo se responde, en palabras; `null` si no hay condición o no se puede escribir. */
  condicion: string | null;
  cruce: Pick<ExploradorVariable, "name" | "label"> | null;
  repeatLabel: string | null;
  repeatInstances: number | null;
}) {
  const detalle = cruce
    ? `cruzada por ${cruce.name}${cruce.label && cruce.label !== cruce.name ? ` ${cruce.label}` : ""}`
    : [
        nOpciones !== null && nOpciones > 0 ? `${fmtN(nOpciones)} ${nOpciones === 1 ? "opción" : "opciones"}` : null,
        condicion ? `se responde cuando ${condicion}` : null,
      ].filter(Boolean).join(", ");
  return (
    <span className="vx-preg-cab">
      <code>{variable.name}</code>
      <span className="vx-preg-cab-texto">
        <span className="vx-preg-cab-titulo">{titulo}</span>
        <span className="vx-preg-cab-detalle">
          <ChipTipo tipo={variable.tipo} />
          {detalle && <span>{detalle}</span>}
          {repeatLabel && (
            <span className="pulso-repeat-variable-context">
              Servicio: {repeatLabel}
              {repeatInstances != null && ` (${fmtN(repeatInstances)} instancias)`}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
