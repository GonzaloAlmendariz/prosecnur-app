/**
 * Cómo trabaja cada equipo, con el ruido incluido.
 *
 * El jefe de campo necesita saber qué está rindiendo cada aplicador, y ese dato
 * existía sólo como el cuarto de nueve paneles en Avance —«Quién consigue
 * más»— midiendo encuestas por aula y nada más.
 *
 * **Aquí se juzga el trabajo de personas, así que la banda no es un adorno.**
 * Medido sobre el corte: el mejor equipo hace 25,5 encuestas por aula y el peor
 * 20,5, pero con ~25 aulas cada uno y una dispersión de 8,8, **ninguno se
 * separa de la media del estudio más de dos errores estándar**. Publicar «25,5
 * contra 20,5» sin decir eso invita a una conclusión sobre personas que el dato
 * no sostiene.
 *
 * Los rechazos y duplicados van **por cada cien encuestas**, no en bruto: quien
 * hace más aulas tiene más de todo, y en bruto el equipo más productivo parece
 * el más problemático.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type TrabajoDeUnEquipo = {
  aplicador: string;
  aulas: number;
  efectivas: number;
  /** Encuestas por aula. */
  porAula: number;
  /** Error estándar de esa media, en encuestas. */
  ee: number;
  /**
   * Si su media se separa de la del estudio más de dos errores estándar.
   * `false` no quiere decir «igual»: quiere decir que con estas aulas no se
   * puede distinguir.
   */
  seDistingue: boolean;
  /** Rechazos por cada cien encuestas conseguidas. */
  rechazosPorCien: number | null;
  duplicadosPorCien: number | null;
};

export type ProduccionPorAplicador = {
  equipos: TrabajoDeUnEquipo[];
  /** Media del estudio, contra la que se comparan. */
  mediaDelEstudio: number;
  aulas: number;
  /** Cuántos equipos se distinguen de la media. */
  distinguibles: number;
};

export function produccionPorAplicador(partes: ReadonlyArray<Fila>): ProduccionPorAplicador | null {
  const porQuien = new Map<string, { efectivas: number[]; rechazos: number; duplicados: number }>();
  const todas: number[] = [];

  for (const p of partes) {
    const quien = txt(p.applied_by);
    if (!quien) continue;
    const efec = num(p.effective_surveys);
    if (efec === null) continue;
    const g = porQuien.get(quien) ?? { efectivas: [], rechazos: 0, duplicados: 0 };
    g.efectivas.push(efec);
    g.rechazos += num(p.refusals) ?? 0;
    g.duplicados += num(p.duplicates) ?? 0;
    porQuien.set(quien, g);
    todas.push(efec);
  }
  if (!todas.length) return null;

  const media = todas.reduce((s, x) => s + x, 0) / todas.length;
  // Dispersión ENTRE aulas del estudio entero: es la que dice cuánto puede
  // variar la media de un equipo por puro reparto de aulas.
  const sd = todas.length > 1
    ? Math.sqrt(todas.reduce((s, x) => s + (x - media) ** 2, 0) / (todas.length - 1))
    : 0;

  const equipos = [...porQuien.entries()].map(([aplicador, g]) => {
    const n = g.efectivas.length;
    const suma = g.efectivas.reduce((s, x) => s + x, 0);
    const porAula = suma / n;
    const ee = n > 0 ? sd / Math.sqrt(n) : 0;
    return {
      aplicador,
      aulas: n,
      efectivas: suma,
      porAula,
      ee,
      seDistingue: ee > 0 && Math.abs(porAula - media) > 2 * ee,
      rechazosPorCien: suma > 0 ? (100 * g.rechazos) / suma : null,
      duplicadosPorCien: suma > 0 ? (100 * g.duplicados) / suma : null,
    };
  }).sort((a, b) => b.porAula - a.porAula || a.aplicador.localeCompare(b.aplicador, "es"));

  return {
    equipos,
    mediaDelEstudio: media,
    aulas: todas.length,
    distinguibles: equipos.filter((e) => e.seDistingue).length,
  };
}
