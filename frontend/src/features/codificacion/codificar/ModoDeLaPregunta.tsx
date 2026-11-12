import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_AGRUPAR } from "../panelesCodificacion";

type Modo = "respuestas" | "agrupar";

const MODOS = [
  { id: "respuestas", rotulo: "Codificar respuestas" },
  { id: "agrupar", rotulo: "Agrupar categorías" },
] as const satisfies readonly { id: Modo; rotulo: string }[];

/**
 * Una pregunta de opción única se codifica de dos formas: sus respuestas "Otro" o agrupando sus
 * categorías. El modo es direccionable (`?panel=agrupar`): se enlaza y el QA lo abre sin clic. Va bajo la
 * pregunta, dentro de la mesa, como un segmentado (flechas del teclado).
 */
export function useModoDeLaPregunta(): { modo: Modo; elegir: (modo: Modo) => void } {
  const agrupar = usePanelDireccionable(PANEL_AGRUPAR);
  return {
    modo: agrupar.abierto ? "agrupar" : "respuestas",
    elegir: (modo) => (modo === "agrupar" ? agrupar.abrir() : agrupar.cerrar()),
  };
}

export function ModoDeLaPregunta({ modo, onElegir }: { modo: Modo; onElegir: (modo: Modo) => void }) {
  return (
    <GlidingRadioGroup
      value={modo}
      options={MODOS}
      getOptionValue={(opcion) => opcion.id}
      onValueChange={onElegir}
      className="pulso-ct-vista pulso-cc-modo"
      aria-label="Cómo codificar esta pregunta"
    >
      {(opcion) => <span>{opcion.rotulo}</span>}
    </GlidingRadioGroup>
  );
}
