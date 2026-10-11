// Cuándo se puede usar la pestaña «Estilo del cliente» y su vista previa. Puro: GraficosPage y la pestaña lo consultan.
//
// Hoy el estilo del cliente sólo lo aplica el Word (decisión 16: el PPT lo tomará por la plantilla en una rebanada
// posterior) y el informe compartido no exporta Word (`GraficosPage.onExport`). Por eso, en el compartido, la pestaña
// queda deshabilitada con su motivo en vez de ofrecer ajustes que no llegarían a ningún archivo.

import type { GraficosReportScope } from "../reportScope";

export const MOTIVO_ESTILO_EN_COMPARTIDO =
  "El informe compartido todavía no sale en Word, y el estilo del cliente hoy sólo se aplica al Word. Ajústalo desde cada base.";

export function motivoEstiloNoDisponible(scope: GraficosReportScope): string | null {
  return scope === "consolidated" ? MOTIVO_ESTILO_EN_COMPARTIDO : null;
}

type ItemRail = { key: string; description?: string; disabled?: boolean };

/** Las pestañas del rail con «Estilo del cliente» deshabilitada (y su motivo en el tooltip) donde no aplica. */
export function conDisponibilidadEstilo<T extends ItemRail>(items: readonly T[], scope: GraficosReportScope): T[] {
  const motivo = motivoEstiloNoDisponible(scope);
  return items.map((item) => (item.key === "estilo" && motivo ? { ...item, disabled: true, description: motivo } : item));
}

/** Motivo por el que todavía no se puede regenerar el Word para ver el estilo, o `null` si se puede. */
export function motivoSinVistaPrevia({ prepOk, laminas, ocupado }: { prepOk: boolean; laminas: number; ocupado: boolean }): string | null {
  if (!prepOk) return "Primero prepara la base en Analítica: el Word sale de la base preparada.";
  if (laminas === 0) return "El informe todavía no tiene láminas: agrega alguna para generar el Word.";
  if (ocupado) return "Se está generando el Word.";
  return null;
}
