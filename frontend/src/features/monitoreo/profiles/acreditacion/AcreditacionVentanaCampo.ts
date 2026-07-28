/**
 * Ventana de campo realmente ejecutada, derivada de las respuestas fechadas.
 *
 * El periodo de campo va en la ficha técnica de un expediente de acreditación:
 * no es un dato opcional. El cronograma lo pedía como "Fechas opcionales" y
 * nadie lo llenaba, así que la app mostraba `CAMPO: Semana 1 · 1 semana`
 * mientras el estudio llevaba nueve semanas de campo (acrconta: 25/05 a 22/07).
 * Sin confrontar plan contra ejecutado, el cronograma es decorativo.
 */

export type AcreditacionVentanaCampo = {
  /** Primera fecha con respuesta, en formato ISO corto. */
  inicio: string;
  /** Última fecha con respuesta. */
  fin: string;
  /** Días de calendario cubiertos, extremos incluidos. */
  diasCalendario: number;
  /** Días que efectivamente trajeron respuestas. */
  diasConRespuesta: number;
  /** Semanas de campo, redondeadas hacia arriba. */
  semanas: number;
};

const MS_DIA = 86_400_000;

function fechaDeFila(row: Record<string, unknown>): string | null {
  for (const key of ["Fecha", "fecha", "Dia", "Día", "Date"]) {
    const raw = row[key];
    if (raw == null) continue;
    const texto = String(raw).trim();
    // Solo ISO (YYYY-MM-DD): el bloque canónico publica así, y adivinar otros
    // formatos es justo como se cuelan fechas inventadas en la ficha técnica.
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  }
  return null;
}

function totalDeFila(row: Record<string, unknown>): number {
  for (const key of ["Total respuestas", "Total", "Respuestas", "Efectivas"]) {
    const raw = row[key];
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function acreditacionVentanaCampoObservada(
  rows: Array<Record<string, unknown>> = [],
): AcreditacionVentanaCampo | null {
  const conRespuesta = rows
    .map((row) => ({ fecha: fechaDeFila(row), total: totalDeFila(row) }))
    .filter((item): item is { fecha: string; total: number } => item.fecha != null && item.total > 0);

  if (!conRespuesta.length) return null;

  const fechas = [...new Set(conRespuesta.map((item) => item.fecha))].sort();
  const inicio = fechas[0];
  const fin = fechas[fechas.length - 1];

  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const finMs = Date.parse(`${fin}T00:00:00Z`);
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs)) return null;

  const diasCalendario = Math.max(1, Math.round((finMs - inicioMs) / MS_DIA) + 1);

  return {
    inicio,
    fin,
    diasCalendario,
    diasConRespuesta: fechas.length,
    semanas: Math.max(1, Math.ceil(diasCalendario / 7)),
  };
}
