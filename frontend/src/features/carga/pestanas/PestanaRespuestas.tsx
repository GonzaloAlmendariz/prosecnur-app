import type { ContextoDeCarga } from "./contextoDeCarga";
import { PestanaDatos } from "./PestanaDatos";

/**
 * Respuestas (ADR 0142, antes Datos): la hoja de la base cargada. Por ahora
 * envuelve la vista de Datos con el contexto de Carga.
 */
export function PestanaRespuestas({ contexto }: { contexto: ContextoDeCarga }) {
  return (
    <PestanaDatos
      varias={contexto.esVarias}
      todoListo={contexto.todoListo}
      ocupado={contexto.ocupado}
      error={contexto.error}
      bases={contexto.basesTodas}
      baseElegida={contexto.baseElegida}
      onCambiarBase={contexto.onCambiarBase}
    />
  );
}
