import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { FiltroDeRespuestas as Filtro } from "./modeloDeCodificar";
// El segmentado es el mismo del conmutador de vista.
import "../tabla/tablaCodificar.css";

const FILTROS = [
  { id: "todas", rotulo: "Todas" },
  { id: "sin-codigo", rotulo: "Por codificar" },
] as const satisfies readonly { id: Filtro; rotulo: string }[];

export type FiltroDeRespuestasProps = {
  filtro: Filtro;
  /** Respuestas de la pregunta sin código: la única aparición de esa cifra en la pantalla. */
  pendientes: number;
  onElegir: (filtro: Filtro) => void;
};

/** Todas las respuestas o solo las que faltan por codificar, con cuántas faltan. */
export function FiltroDeRespuestas({ filtro, pendientes, onElegir }: FiltroDeRespuestasProps) {
  return (
    <GlidingRadioGroup
      value={filtro}
      options={FILTROS}
      getOptionValue={(opcion) => opcion.id}
      onValueChange={onElegir}
      className="pulso-ct-vista pulso-cc-filtro"
      aria-label="Respuestas a la vista"
    >
      {(opcion) => (
        <>
          <span>{opcion.rotulo}</span>
          {opcion.id === "sin-codigo" ? (
            <span className="pulso-cc-cuenta" data-aviso={pendientes > 0 ? "" : undefined}>
              {formatoConteo(pendientes)}
            </span>
          ) : null}
        </>
      )}
    </GlidingRadioGroup>
  );
}
