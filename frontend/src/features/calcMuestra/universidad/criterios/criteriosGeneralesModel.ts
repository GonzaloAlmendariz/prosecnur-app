/**
 * Las decisiones que rigen para TODAS las facultades, leídas de donde viven.
 *
 * La primera versión de esta tarjeta traía dos valores escritos a mano —«1.5» de
 * sobremuestra y «cube balanceado» de método— y Gonzalo los vio en su pantalla
 * mientras su estudio estaba configurado con **0,2**. Una tarjeta cuyo trabajo
 * es responder «¿coincide con el estudio anterior?» no puede inventar la mitad
 * de la columna de este estudio: afirmaba una decisión que nadie tomó.
 *
 * Todo sale ahora de los parámetros del componente que dimensiona POR FACULTAD
 * y del selector del config. Lo que no está declarado viaja vacío y la tabla lo
 * pinta «—»: un hueco se lee como «no declarado», un valor inventado no.
 */
import type { CriterioGeneralFila } from "./CriteriosGeneralesCard";

/**
 * Cifra con separador de miles, al estilo del resto de la app.
 *
 * `null`, `undefined` y `""` son AUSENCIA y devuelven vacío. Ojo: `Number(null)`
 * y `Number("")` valen 0, no NaN, asi que sin este filtro un dato que falta se
 * pintaria «0» — la misma confusion que el backend evita mandando NA.
 */
export function fmtCifra(valor: unknown, decimales = 0): string {
  if (valor == null || valor === "" || typeof valor === "boolean") return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Porcentaje declarado como fracción (0,2 → «20 %»). */
/** Ratio de sobremuestra en el idioma del histórico: 0.5 (extra) -> «×1,5». */
export function fmtRatioSobremuestra(valor: unknown): string {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < 0) return "";
  return `×${fmtCifra(1 + n, 1)}`;
}

export function fmtPorcentaje(valor: unknown): string {
  if (valor == null || valor === "" || typeof valor === "boolean") return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return `${fmtCifra(n * 100, n * 100 % 1 === 0 ? 0 : 1)} %`;
}

const ETIQUETA_ESTADISTICO: Record<string, string> = {
  media: "media",
  mediana: "mediana",
  p25: "primer cuartil (p25)",
  min_mediana_media: "mín(mediana, media)",
};

const ETIQUETA_SELECTOR: Record<string, string> = {
  cube_balanceado: "cubo balanceado",
  balanced_probability: "probabilidad balanceada",
  sistematico: "sistemático",
};

export type EntradaCriteriosGenerales = {
  /** `parametros` del componente que dimensiona por facultad. */
  parametros: Record<string, unknown> | null | undefined;
  /**
   * `alumnos_por_ch_decision` del config. MANDA sobre
   * `parametros.estadistico_conglomerado`: al sellar la decisión, el motor
   * resuelve el estadístico por estrato y deja el parámetro en «media» a
   * propósito, porque el valor ya viene calculado. Leer el parámetro hacía que
   * la tarjeta dijera «media» mientras el estudio dimensionaba con p25 — medido
   * en HSVG2026, con la decisión sellada en p25 y 193 aulas en pantalla.
   */
  decision?: Record<string, unknown> | null;
  /**
   * El config de aulas. El motor lo anida bajo `selector` y el workspace del
   * front lo trae plano —`selector_engine` al primer nivel, y `selector` como
   * un string—; se aceptan las dos formas porque una tarjeta que muestra «—»
   * teniendo el dato es exactamente lo que vinimos a arreglar.
   */
  selector: Record<string, unknown> | null | undefined;
  /** Aulas incluidas en el marco vigente. */
  aulasMarco: number | null;
  /** Filas por estrato, para la cuota total y las aulas dimensionadas. */
  filas: ReadonlyArray<{
    cuota?: number;
    aulas_base?: number;
    margen?: { aulas_requeridas?: number | null } | null;
  }> | null;
};

export function criteriosGeneralesDeEstudio({
  parametros,
  decision,
  selector,
  aulasMarco,
  filas,
}: EntradaCriteriosGenerales): CriterioGeneralFila[] {
  const p = (parametros ?? {}) as Record<string, unknown>;
  const s = (selector ?? {}) as Record<string, unknown>;
  const fs = filas ?? [];

  const cuotaTotal = fs.reduce(
    (acc, f) => acc + (Number.isFinite(f.cuota) ? (f.cuota as number) : 0),
    0,
  );
  // Las aulas a visitar salen del margen cuando R lo publicó; si no, de
  // `aulas_base`, que es la misma cifra antes de descontar reservas. Dejarlo en
  // «—» teniendo `aulas_base` escondia el numero que la tarjeta existe para dar.
  const aVisitar = fs.reduce((acc, f) => {
    const v = f.margen?.aulas_requeridas ?? f.aulas_base;
    return acc + (Number.isFinite(v) ? (v as number) : 0);
  }, 0);

  const sellado = String((decision ?? {}).estadistico_default ?? "");
  const estadistico = sellado || String(p.estadistico_conglomerado ?? "");
  const anidado = (s.selector ?? {}) as Record<string, unknown> | string;
  const desdeAnidado =
    typeof anidado === "object" && anidado !== null
      ? (anidado as Record<string, unknown>).selector_engine ??
        (anidado as Record<string, unknown>).method_family
      : anidado;
  const motor = String(s.selector_engine ?? desdeAnidado ?? s.method_family ?? "");

  return [
    { concepto: "Muestra de diseño", hoy: fmtCifra(cuotaTotal || null), claveHistorica: "muestra" },
    {
      // El estadístico decide cuántas aulas hacen falta: es la decisión más
      // consecuente de la tabla y faltaba.
      concepto: "Estadístico por curso-horario",
      hoy: estadistico ? ETIQUETA_ESTADISTICO[estadistico] ?? estadistico : "",
      claveHistorica: "estadistico",
    },
    {
      concepto: "Sobremuestra",
      // En el idioma del historico: RATIO (x1,5), no porcentaje. La referencia
      // guarda ratio_sobremuestra=1.5 y la comparacion es textual: mostrar
      // «50 %» aqui declaraba «no coincide» contra la MISMA cantidad.
      hoy: fmtRatioSobremuestra(p.oversample_pct),
      claveHistorica: "ratio_sobremuestra",
    },
    {
      // El mismo numero aparecia en la app con TRES nombres —«tasa de
      // efectividad» en Propuestas, «rinde alrededor del N%» en Objetivo y
      // «Factor de asistencia (τ)» aqui—, y la letra griega quedo enterrada en
      // las superficies desde la serie 1b. Un solo nombre para una sola cosa.
      concepto: "Tasa de efectividad",
      hoy: fmtCifra(p.tau, 2),
      claveHistorica: "tasa_respuesta_asumida",
    },
    {
      concepto: "Efecto de diseño",
      hoy: fmtCifra(p.deff, 1),
      claveHistorica: "deff",
    },
    {
      concepto: "Método de selección",
      hoy: motor ? ETIQUETA_SELECTOR[motor] ?? motor : "",
      claveHistorica: "metodo_seleccion",
    },
    { concepto: "Aulas del marco", hoy: fmtCifra(aulasMarco || null), claveHistorica: "aulas_marco" },
    {
      concepto: "Aulas a visitar",
      hoy: fmtCifra(aVisitar || null),
      claveHistorica: "aulas_dimensionadas",
      /* R4 (checklist 2026-08-18): el 170 histórico NO es lo que su diseño
         dimensionó — es la ola de agenda fijada tras ajuste manual (tres olas
         idénticas sobre el pool). Sin la nota, el «no» de esta fila se lee
         como si los dos diseños difirieran, que es lo contrario de lo medido. */
      notaHistorica: "ejecutado tras ajuste manual de agenda; no es el dimensionamiento de su diseño",
    },
    // Lo que el estudio anterior HIZO. Su columna «este estudio» queda vacía a
    // propósito: son resultados de campo, y este estudio todavía no salió. Están
    // aquí porque son la única parte del histórico que el proyecto guarda, y sin
    // ellas la comparación no tiene con qué llenarse.
    // Las que el estudio anterior APLICÓ, que no son las que su diseño mandaba
    // visitar: 194 contra 170, y la diferencia son los reemplazos.
    { concepto: "Aulas efectivamente aplicadas", hoy: "", claveHistorica: "aulas_aplicadas" },
    { concepto: "Aulas agendadas con reemplazos", hoy: "", claveHistorica: "aulas_agendadas" },
    { concepto: "Encuestas válidas logradas", hoy: "", claveHistorica: "efectivas_logradas" },
    { concepto: "Asistencia observada", hoy: "", claveHistorica: "tasa_asistencia" },
  ];
}
