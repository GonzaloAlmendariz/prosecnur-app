// Qué piezas de Identidad se pueden ajustar y su vista previa. Puro: la pestaña y GraficosPage lo consultan.
//
// En el informe compartido todas las piezas de Identidad se ajustan: logos y letra también llegan a su PowerPoint
// (graficos_consolidado_start pasa el estilo del cliente a su job, como el /ppt de cada base; Gonzalo, 2026-10-29).

/** Motivo por el que todavía no se puede regenerar el Word para ver el estilo, o `null` si se puede. */
export function motivoSinVistaPrevia({ prepOk, laminas, ocupado }: { prepOk: boolean; laminas: number; ocupado: boolean }): string | null {
  if (!prepOk) return "Primero prepara la base en Analítica: el Word sale de la base preparada.";
  if (laminas === 0) return "El informe todavía no tiene láminas: agrega alguna para generar el Word.";
  if (ocupado) return "Se está generando el Word.";
  return null;
}
