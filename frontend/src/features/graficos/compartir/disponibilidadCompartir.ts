// Qué se puede compartir según el alcance del informe (decisión 20, 2026-10-11).
//
// Plan portátil, exportar e importar secciones leen y escriben `/api/graficos/config` y `/api/graficos/share/*`, que
// son la config de la BASE ACTIVA (ADR 0040 §6.1; `configSnapshot.ts`). El informe compartido vive en otro borrador
// (`/api/graficos/consolidado/draft`). En ese alcance ninguna de las tres acciones haría lo que promete: exportar
// entregaría el plan de la base activa en lugar del que se ve, e importar escribiría donde este informe no lee. Por
// eso, aunque exportar no escribe nada, también se deshabilita: el archivo no sería el de este informe.
//
// Vaciar el plan (C14) es distinto: sólo reinicia el store del editor, y el autoguardado lo persiste donde ese store se
// hidrató — la config de la base activa en una base, el borrador `graficos_consolidado_draft/v1` en el informe
// compartido (`useGraficosAutosave`). En ningún alcance escribe donde el informe no lee, así que queda habilitado en los
// dos; lo que cambia es qué dice que vacía (`textoConfirmarVaciar`). Que el plan ya esté vacío lo resuelve `vaciarPlan.ts`.

import type { GraficosReportScope } from "../reportScope";

export type Disponibilidad = { habilitado: true } | { habilitado: false; motivo: string };

export const MOTIVO_PLAN_PORTATIL_CONSOLIDADO =
  "El informe compartido no se comparte por base: el plan portátil se exporta y se aplica base por base. Ábrelo desde una base para usarlo.";

export const MOTIVO_EXPORTAR_JSON_CONSOLIDADO =
  "El informe compartido no se comparte por base: el archivo saldría con el plan de la base activa, no con el de este informe.";

export const MOTIVO_IMPORTAR_JSON_CONSOLIDADO =
  "El informe compartido no se comparte por base: importar secciones escribe en el plan de la base activa, no en este informe.";

export const MOTIVO_SECCIONES_JSON_CONSOLIDADO =
  "El informe compartido no se comparte por base: exportar e importar secciones usan el plan de la base activa, no el de este informe.";

export type DisponibilidadCompartir = {
  planPortatil: Disponibilidad;
  /** El ítem del menú que abre exportar/importar secciones: se puede abrir si al menos una de las dos se puede usar. */
  seccionesJson: Disponibilidad;
  exportarJson: Disponibilidad;
  importarJson: Disponibilidad;
  /** Vaciar el plan que se ve (C14): escribe en el mismo borrador que se está editando, en cualquier alcance. */
  vaciarPlan: Disponibilidad;
};

const HABILITADO: Disponibilidad = { habilitado: true };

export function disponibilidadCompartir(scope: GraficosReportScope): DisponibilidadCompartir {
  if (scope === "consolidated") {
    return {
      planPortatil: { habilitado: false, motivo: MOTIVO_PLAN_PORTATIL_CONSOLIDADO },
      seccionesJson: { habilitado: false, motivo: MOTIVO_SECCIONES_JSON_CONSOLIDADO },
      exportarJson: { habilitado: false, motivo: MOTIVO_EXPORTAR_JSON_CONSOLIDADO },
      importarJson: { habilitado: false, motivo: MOTIVO_IMPORTAR_JSON_CONSOLIDADO },
      vaciarPlan: HABILITADO,
    };
  }
  return {
    planPortatil: HABILITADO, seccionesJson: HABILITADO, exportarJson: HABILITADO, importarJson: HABILITADO, vaciarPlan: HABILITADO,
  };
}
