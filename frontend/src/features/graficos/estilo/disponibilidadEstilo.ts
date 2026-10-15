// Qué piezas de Identidad se pueden ajustar y su vista previa. Puro: la pestaña y GraficosPage lo consultan.
//
// L2 del rediseño (2026-10-14): Identidad ya no se deshabilita entera en el informe compartido. Los colores de las
// respuestas y los íconos viven en el plan y el PPT compartido los usa; sólo logos y letra —que hoy aplica únicamente
// el Word, y el compartido no exporta Word (`GraficosPage.onExport`)— dicen por qué no se ajustan ahí. Cuando logos y
// letra lleguen al PPT (ID9, decisión D5) este motivo desaparece.

import type { GraficosReportScope } from "../reportScope";

export const MOTIVO_ESTILO_EN_COMPARTIDO =
  "Los logos y la letra hoy sólo se aplican al Word, y el informe compartido todavía no sale en Word. Ajústalos desde cada base.";

export type PiezaIdentidad = "linea" | "logos" | "letra" | "iconos" | "colores";

/** Motivo por el que una pieza no se ajusta en este informe, o `null` si se ajusta. */
export function motivoPiezaNoDisponible(scope: GraficosReportScope, pieza: PiezaIdentidad): string | null {
  return scope === "consolidated" && (pieza === "logos" || pieza === "letra") ? MOTIVO_ESTILO_EN_COMPARTIDO : null;
}

/** Motivo por el que todavía no se puede regenerar el Word para ver el estilo, o `null` si se puede. */
export function motivoSinVistaPrevia({ prepOk, laminas, ocupado }: { prepOk: boolean; laminas: number; ocupado: boolean }): string | null {
  if (!prepOk) return "Primero prepara la base en Analítica: el Word sale de la base preparada.";
  if (laminas === 0) return "El informe todavía no tiene láminas: agrega alguna para generar el Word.";
  if (ocupado) return "Se está generando el Word.";
  return null;
}
