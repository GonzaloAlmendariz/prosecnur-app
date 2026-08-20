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

/** «DOCENTE ORDINARIO - PRINCIPAL» → «Ordinario - Principal»; un aula con dos
 *  docentes viene compuesta con « | » y manda el más restrictivo. */
export function etiquetaDocente(raw: string): string {
  const cap = (t: string) =>
    t.toLowerCase().replace(/\p{L}+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  const partes = String(raw ?? "")
    .split("|")
    .map((x) => cap(x.trim().replace(/^docente\s+/i, "")))
    .filter(Boolean);
  if (!partes.length) return "Sin tipo declarado";
  if (partes.length === 1) return partes[0];
  return `${partes.join(" y ")} (manda el más restrictivo)`;
}

export type RadiografiaAula = {
  curso: string;
  codigo: string;
  horario: string;
  facultad: string;
  /** «Titular», «Reemplazo 3», «Bolsa extra». */
  rol: string;
  elegibles: number;
  pAplicada: number;
  rendimiento: number;
  /** Lo que el motor guardó (1 decimal). */
  esperadas: number;
  /** elegibles × p × r sin redondear, para mostrar la cuenta completa. */
  productoExacto: number;
  docente: string;
  /** Tramo de tamaño observado en el plan para este rendimiento («16–25»). */
  tramo: string;
};

/** La redacción del cálculo de UN curso-horario — Gonzalo (2026-08-20): «yo
 *  puedo marcar cualquier curso horario o cualquier reemplazo, y el validador
 *  me debería decir cómo llegamos a este valor». */
export function radiografiaAula(
  fila: Fila,
  porTamano: GrupoTamano[],
): RadiografiaAula | null {
  const el = num(fila.eligible_n);
  const p = num(fila.p_aplicada_ref);
  const r = num(fila.rendimiento_ref);
  const esperadas = num(fila.efectivas_esperadas);
  if (el == null || p == null || r == null || esperadas == null) return null;
  const grupo = porTamano.find((g) => g.tasa === r) ?? null;
  const role = String(fila.sample_role ?? "").trim();
  const orden = num(fila.replacement_order);
  const rol =
    role === "titular"
      ? "Titular"
      : role === "chain_reserve"
        ? `Reemplazo${orden != null ? ` ${orden}` : ""}`
        : role === "extra_reserve_pool"
          ? "Bolsa extra"
          : role || "—";
  return {
    curso: String(fila.course_name ?? "").trim() || String(fila.course_id ?? "").trim(),
    codigo: String(fila.course_id ?? "").trim(),
    horario: String(fila.schedule ?? "").trim(),
    facultad: String(fila.faculty_aula ?? fila.faculty ?? "").trim(),
    rol,
    elegibles: el,
    pAplicada: p,
    rendimiento: r,
    esperadas,
    productoExacto: el * p * r,
    docente: etiquetaDocente(String(fila.teacher_type ?? "")),
    tramo: grupo
      ? grupo.minElegibles === grupo.maxElegibles
        ? `${grupo.minElegibles}`
        : `${grupo.minElegibles}–${grupo.maxElegibles}`
      : `${el}`,
  };
}

export type FuenteEfectividad = {
  tipo: "historico" | "calibracion_embebida" | "tau_global";
  periodo: string;
  tau: number | null;
};

/** La procedencia de la calibración, leída de las filas del motor — nunca
 *  asumida por la UI (Gonzalo, 2026-08-20: «la idea es que no sea un
 *  hardcore… el histórico pudo haber sido de hace seis meses»). Filas viejas
 *  sin la columna se declaran como lo que son: calibración embebida. */
export function fuenteEfectividad(rows: Fila[] | null): FuenteEfectividad {
  const fila = (rows ?? []).find((f) => String(f.efectividad_fuente ?? "").trim());
  const tipoRaw = String(fila?.efectividad_fuente ?? "").trim();
  const tipo =
    tipoRaw === "historico" || tipoRaw === "tau_global" ? tipoRaw : "calibracion_embebida";
  const tau = num(fila?.efectividad_tau);
  return {
    tipo,
    periodo: String(fila?.efectividad_periodo ?? "").trim(),
    tau: tipo === "tau_global" ? tau : null,
  };
}

export type RadiografiaTau = {
  curso: string;
  codigo: string;
  horario: string;
  facultad: string;
  rol: string;
  elegibles: number;
  tau: number;
  esperadas: number;
  productoExacto: number;
};

/** La redacción del cálculo cuando el estudio se rige por τ global (sin
 *  histórico): dos pasos en vez de cuatro. */
export function radiografiaAulaTau(fila: Fila): RadiografiaTau | null {
  const el = num(fila.eligible_n);
  const esperadas = num(fila.efectivas_esperadas);
  const tau = num(fila.efectividad_tau);
  if (el == null || esperadas == null || tau == null) return null;
  const base = radiografiaConIdentidad(fila);
  return { ...base, elegibles: el, tau, esperadas, productoExacto: el * tau };
}

function radiografiaConIdentidad(fila: Fila) {
  const role = String(fila.sample_role ?? "").trim();
  const orden = num(fila.replacement_order);
  return {
    curso: String(fila.course_name ?? "").trim() || String(fila.course_id ?? "").trim(),
    codigo: String(fila.course_id ?? "").trim(),
    horario: String(fila.schedule ?? "").trim(),
    facultad: String(fila.faculty_aula ?? fila.faculty ?? "").trim(),
    rol:
      role === "titular"
        ? "Titular"
        : role === "chain_reserve"
          ? `Reemplazo${orden != null ? ` ${orden}` : ""}`
          : role === "extra_reserve_pool"
            ? "Bolsa extra"
            : role || "—",
  };
}

