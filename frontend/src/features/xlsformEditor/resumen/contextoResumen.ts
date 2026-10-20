// Arma el contexto de la pestaña «Resumen» desde el estado que la cabecera del editor ya anuncia
// (`deriveEditorHeaderStatus`): así el resumen y la banda dicen lo mismo sobre la lógica y
// cuentan los mismos errores, avisos y correcciones.

import type { ContextoResumen } from "../shell/FormSummaryView";
import type { EditorHeaderStatus } from "../shell/editorHeaderStatus";
import { rotuloLogicaExterna } from "../shell/logicaExternaModel";

export function contextoResumen(
  estado: EditorHeaderStatus,
  resto: Omit<ContextoResumen, "logica" | "conteos">,
): ContextoResumen {
  return {
    ...resto,
    logica: {
      pendiente: estado.logicStepPending,
      externa: estado.logicaExterna ? rotuloLogicaExterna(estado.logicaExterna) : null,
    },
    conteos: {
      errores: estado.errorCount,
      avisos: estado.avisoCount,
      correcciones: estado.publicationErrors.length,
    },
  };
}
