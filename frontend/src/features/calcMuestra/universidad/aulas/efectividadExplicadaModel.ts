/**
 * «De dónde sale el esperado de cada aula» — el modelo de la tarjeta didáctica.
 *
 * Mandato de Gonzalo (2026-08-20): «si tú sabes que en Prospección y
 * Exploración Minera de veinticuatro elegibles van a haber doce, ese es el
 * valor de validez, y ese valor tiene que estar claro». La tarjeta NO copia
 * las curvas del motor en prosa (sería un segundo dueño del mismo dato):
 * las DERIVA de las filas reales — agrupa por los valores de p_aplicada_ref
 * y rendimiento_ref que el motor efectivamente escribió en esta selección.
 */

type Fila = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type GrupoDocente = {
  /** Tasa medida (0-1) que el motor aplicó a este grupo. */
  tasa: number;
  /** Tipo de docente más frecuente dentro del grupo, tal cual viene. */
  etiqueta: string;
  nAulas: number;
};

export type GrupoTamano = {
  /** Rendimiento medido (0-1) que el motor aplicó a este grupo. */
  tasa: number;
  /** Rango de elegibles observado dentro del grupo. */
  minElegibles: number;
  maxElegibles: number;
  nAulas: number;
};

export type EjemploAula = {
  curso: string;
  elegibles: number;
  pAplicada: number;
  rendimiento: number;
  esperadas: number;
  /** Tipo de docente del aula, tal cual viene («DOCENTE ORDINARIO - PRINCIPAL»). */
  docente: string;
  /** Rango de elegibles del grupo de tamaño al que pertenece («16–25»). */
  rangoTamano: string;
};

export type EfectividadExplicada = {
  porDocente: GrupoDocente[];
  porTamano: GrupoTamano[];
  totalElegibles: number;
  totalEsperadas: number;
  /** Σesperadas / Σelegibles-por-aula. OJO: NO es el τ del diseño — es
   *  τ × P(aplicada); la diferencia es el riesgo de caída que la cadena de
   *  reemplazos recupera. Medido el 2026-08-20: 0,462 = 0,872 × 0,53. */
  tasaGlobal: number;
  /** P(aplicada) media ponderada por elegibles. */
  pAplicadaMedia: number;
  /** tasaGlobal / pAplicadaMedia — reconstruye el τ del dimensionamiento. */
  tauImplicito: number;
  ejemplo: EjemploAula | null;
};

export function efectividadExplicada(rows: Fila[] | null): EfectividadExplicada | null {
  const filas = (rows ?? []).filter(
    (f) =>
      num(f.eligible_n) != null &&
      num(f.p_aplicada_ref) != null &&
      num(f.rendimiento_ref) != null &&
      num(f.efectivas_esperadas) != null,
  );
  if (!filas.length) return null;

  const docentes = new Map<number, { conteos: Map<string, number>; n: number }>();
  const tamanos = new Map<number, { min: number; max: number; n: number }>();
  let totalElegibles = 0;
  let totalEsperadas = 0;
  let sumaPPonderada = 0;

  for (const f of filas) {
    const el = num(f.eligible_n) as number;
    const p = num(f.p_aplicada_ref) as number;
    const r = num(f.rendimiento_ref) as number;
    totalElegibles += el;
    totalEsperadas += num(f.efectivas_esperadas) as number;
    sumaPPonderada += el * p;

    const d = docentes.get(p) ?? { conteos: new Map<string, number>(), n: 0 };
    const tipo = String(f.teacher_type ?? "").trim() || "sin tipo declarado";
    d.conteos.set(tipo, (d.conteos.get(tipo) ?? 0) + 1);
    d.n += 1;
    docentes.set(p, d);

    const t = tamanos.get(r) ?? { min: el, max: el, n: 0 };
    t.min = Math.min(t.min, el);
    t.max = Math.max(t.max, el);
    t.n += 1;
    tamanos.set(r, t);
  }

  const porDocente: GrupoDocente[] = [...docentes.entries()]
    .map(([tasa, d]) => ({
      tasa,
      etiqueta:
        [...d.conteos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
      nAulas: d.n,
    }))
    .sort((a, b) => b.tasa - a.tasa);

  const porTamano: GrupoTamano[] = [...tamanos.entries()]
    .map(([tasa, t]) => ({ tasa, minElegibles: t.min, maxElegibles: t.max, nAulas: t.n }))
    .sort((a, b) => b.tasa - a.tasa);

  const primera = filas[0];
  const rEj = num(primera.rendimiento_ref) as number;
  const grupoEj = porTamano.find((g) => g.tasa === rEj) ?? null;
  const ejemplo: EjemploAula = {
    curso:
      String(primera.course_name ?? "").trim() ||
      String(primera.course_id ?? "").trim(),
    elegibles: num(primera.eligible_n) as number,
    pAplicada: num(primera.p_aplicada_ref) as number,
    rendimiento: rEj,
    esperadas: num(primera.efectivas_esperadas) as number,
    docente: String(primera.teacher_type ?? "").trim() || "sin tipo declarado",
    rangoTamano: grupoEj
      ? grupoEj.minElegibles === grupoEj.maxElegibles
        ? `${grupoEj.minElegibles}`
        : `${grupoEj.minElegibles}–${grupoEj.maxElegibles}`
      : "",
  };

  const tasaGlobal = totalElegibles > 0 ? totalEsperadas / totalElegibles : 0;
  const pAplicadaMedia = totalElegibles > 0 ? sumaPPonderada / totalElegibles : 0;
  return {
    porDocente,
    porTamano,
    totalElegibles,
    totalEsperadas,
    tasaGlobal,
    pAplicadaMedia,
    tauImplicito: pAplicadaMedia > 0 ? tasaGlobal / pAplicadaMedia : 0,
    ejemplo,
  };
}
