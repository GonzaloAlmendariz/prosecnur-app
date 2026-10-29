// Qué piezas de Identidad se pueden ajustar y su vista previa. Puro: la pestaña y GraficosPage lo consultan.
//
// L2 del rediseño (2026-10-14): Identidad ya no se deshabilita entera en el informe compartido. Los colores de las
// respuestas y los íconos viven en el plan y el PPT compartido los usa; sólo logos y letra dicen por qué no se ajustan
// ahí. Ya llegan al PPT de cada base (D5: `.graficos_estilo_cliente_arg(sid, cfg, "ppt")` en /api/graficos/ppt), pero el
// PPT del compartido (`graficos_consolidado_start`, graficos_consolidado.R) todavía no los recibe y sale con los de la
// plantilla; el compartido tampoco exporta Word. Cuando el compartido los pase a su job, este motivo desaparece.

import type { GraficosReportScope } from "../reportScope";

export const MOTIVO_ESTILO_EN_COMPARTIDO =
  "El PowerPoint del informe compartido todavía sale con los logos y la letra de la plantilla. Ajústalos desde cada base.";

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
