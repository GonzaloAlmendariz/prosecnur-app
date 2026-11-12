import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import type { FiltroDeRespuestas as Filtro } from "./modeloDeCodificar";
// El segmentado es el mismo del conmutador de vista.
import "../tabla/tablaCodificar.css";

const FILTROS = [
  { id: "sin-codigo", rotulo: "Por codificar" },
  { id: "todas", rotulo: "Todas" },
] as const satisfies readonly { id: Filtro; rotulo: string }[];

export type FiltroDeRespuestasProps = {
  filtro: Filtro;
  onElegir: (filtro: Filtro) => void;
};

/**
 * Las que faltan por codificar o todas, como en el prototipo. Cuántas se ven lo dice el conteo del
 * contenedor; cuántas faltan, la cabecera de la pestaña.
 */
export function FiltroDeRespuestas({ filtro, onElegir }: FiltroDeRespuestasProps) {
  return (
    <GlidingRadioGroup
      value={filtro}
      options={FILTROS}
      getOptionValue={(opcion) => opcion.id}
      onValueChange={onElegir}
      className="pulso-ct-vista pulso-cc-filtro"
      aria-label="Respuestas a la vista"
    >
      {(opcion) => <span>{opcion.rotulo}</span>}
    </GlidingRadioGroup>
  );
}
