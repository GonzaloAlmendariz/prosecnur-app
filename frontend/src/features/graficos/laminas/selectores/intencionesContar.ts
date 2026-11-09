// Recomendaciones del selector de láminas (ADR 0135 §1, revisado por el ADR 0139): por la pregunta del estudio, una
// lista corta que apunta a entradas del catálogo de gráficos (un graficador o una variante, `entrada`) y, al aceptarla,
// pone ese gráfico en la ranura de `p_slide_1_grafico` (el mecanismo de `PRESETS_LAMINA`, opcionesLamina.ts). Una
// tarjeta que inserta un gráfico es de clase «Gráfico» y se llama como su entrada del catálogo; «Lámina» queda para
// las composiciones (el cierre con hallazgos). `deResumen` marca los gráficos de resumen de los que el cierre toma cifras.
// El catálogo vende los gráficos; la recomendación sólo los señala (Gonzalo, 2026-11-08: «el resumen te diga puedes
// usar este catálogo de gráficos, y no viceversa»).
//
// Una tarjeta sólo aparece si el registro trae lo que pide (`requiere`), como `FUERA_DEL_CATALOGO`: Fortalezas y
// Cobertura entran solas cuando el backend las declare. El cierre con hallazgos es un tipo de lámina sin gráfico
// (`p_slide_cierre_hallazgos`): su tarjeta no trae `grafico` y entra cuando el registro trae el tipo. La tendencia entre
// mediciones queda fuera (ADR 0135 §9). Pura: el selector la usa y los tests la prueban sola.

import type { Slide } from "../../../../api/graficos";
import { esEntreGrupos } from "../brecha/modeloBrechaGrupos";
import { argsDeEntrada, graficadorDeEntrada, nombreDeEntrada, varianteDeGrafico } from "../../catalogoGraficos";
import { conPropuesta } from "../gruposPadron/modeloPadron";
import { usoDeTarjeta } from "./detalleLamina";
import type { ClavePreset, EstudioDelSelector, GraficoDePreset, PresetLamina } from "./opcionesLamina";
import { TIPOS_RETIRADOS_0137 } from "../../retirados";

/** Lo que la tarjeta inserta: un tipo de gráfico o un tipo de lámina (ADR 0139, decisión 1). */
export type ClaseTarjeta = "grafico" | "lamina";

export const ROTULO_CLASE: Readonly<Record<ClaseTarjeta, string>> = {
  grafico: "Gráfico",
  lamina: "Lámina",
};

export type IntencionContarId = "resumir" | "comparar" | "dentro" | "escala";

export type IntencionContar = {
  id: IntencionContarId;
  nombre: string;
  /** Una línea bajo el nombre, con el ejemplo de la pregunta que responde. */
  ayuda: string;
  tarjetas: readonly ClavePreset[];
};

export type TarjetaContar = PresetLamina & Required<Pick<PresetLamina, "clase" | "pide">> & {
  /**
   * La entrada del catálogo que la recomendación señala: un graficador o una variante de graficos_tipos.json (o, en la
   * tarjeta sin gráfico, el tipo de lámina). intencionesContar.test.ts falla si no existe.
   */
  entrada: string;
  /** Un gráfico de resumen: el cierre con hallazgos toma sus cifras de las láminas que lo llevan. */
  deResumen?: boolean;
};

/**
 * El gráfico de partida de una entrada del catálogo: su graficador con los args de la variante (un `null` queda nulo y
 * cada argumento que la variante quita va como `undefined`, que el parche borra), más los propios de la tarjeta.
 */
const graficoDeCatalogo = (
  entrada: string,
  extra: Readonly<Record<string, unknown>> = {},
  porDefecto?: GraficoDePreset["porDefecto"],
): GraficoDePreset => ({
  graficador: graficadorDeEntrada(entrada), args: { ...argsDeEntrada(entrada), ...extra }, ...(porDefecto ? { porDefecto } : {}),
});

/** Nombre, clase y entrada de una tarjeta que inserta un gráfico: los del catálogo. */
const deCatalogo = (entrada: string) => ({ entrada, nombre: nombreDeEntrada(entrada), clase: "grafico" as const });

/** Una tarjeta que nace con su gráfico (todas menos el cierre con hallazgos). */
export type TarjetaConGrafico = TarjetaContar & Required<Pick<PresetLamina, "grafico">>;

export const conGraficoDePartida = (t: TarjetaContar): t is TarjetaConGrafico => !!t.grafico;

type Args = Readonly<Record<string, unknown>>;

const graficoDe = (payload: Args, slot = "grafico"): { graficador: string; args: Args } | null => {
  const g = payload[slot];
  if (!g || typeof g !== "object" || Array.isArray(g)) return null;
  const r = g as Record<string, unknown>;
  if (typeof r.graficador !== "string") return null;
  const args = r.args && typeof r.args === "object" && !Array.isArray(r.args) ? (r.args as Args) : {};
  return { graficador: r.graficador, args };
};

const conGrafico = (graficador: string, cumple: (args: Args) => boolean = () => true) => (payload: Args): boolean => {
  const g = graficoDe(payload);
  return !!g && g.graficador === graficador && cumple(g.args);
};

const resumen = (args: Args) => args.estilo === "resumen";

/**
 * Las reglas con que arrancan las láminas de resumen (ADR 0135 §2): el analista nunca agrega las preguntas una por una.
 * El panorama toma todas las de escala de cada base del estudio; la escala también con 2+ bases (con una, la suya).
 */
export const REGLA_POR_DEFECTO = {
  panorama: { tipo: "todas" },
  contraste: { tipo: "mayor_diferencia", n: 13 },
  aperturas: { tipo: "mayor_diferencia", n: 10 },
  escala: { tipo: "bajo_umbral", umbral: 60 },
} as const;

/** `base$*` de cada base: todas sus preguntas de escala (graficos_panorama_plan.R). */
export const todasDeLasBases = (bases: readonly string[]): string[] => bases.map((b) => `${b}$*`);

/** El par con que nace el contraste entre públicos: las dos primeras bases, en su orden; con menos de dos, ninguno. */
export const parDelContraste = (bases: readonly string[]): string[] | null => (bases.length >= 2 ? bases.slice(0, 2) : null);

/**
 * El `corte` y su nombre con que nacen las láminas que suman un indicador (R5-2): el del estudio, si lo hay. `enCadena`
 * para `p_dumbbell`, que lo guarda como «4,5» (CORTE_EN_CADENA de argsDatosGrafico.ts).
 */
export function indicadorPorDefecto(e: EstudioDelSelector, enCadena = false): Record<string, unknown> {
  const codigos = e.indicador?.codigos ?? [];
  if (!codigos.length) return {};
  return { corte: enCadena ? codigos.join(",") : [...codigos], corte_etiqueta: e.indicador?.etiqueta ?? "" };
}

const basePrincipal = (e: EstudioDelSelector): string | null =>
  e.baseActiva && e.bases.includes(e.baseActiva) ? e.baseActiva : e.bases[0] ?? null;

/** Los args con que nace la cobertura: todas las bases y la propuesta de padrón y meta que haya. */
export function coberturaPorDefecto(e: EstudioDelSelector): Record<string, unknown> {
  if (!e.bases.length) return {};
  const propuesta = conPropuesta({}, e.padron ?? [], e.bases, true, false);
  const out: Record<string, unknown> = { bases: [...e.bases] };
  for (const [k, v] of Object.entries(propuesta)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

export const TARJETAS_CONTAR: readonly TarjetaContar[] = [
  {
    clave: "p_slide_1_grafico:panorama",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_panorama"),
    deResumen: true,
    uso: "Quién valora más y quién concentra las preguntas bajas",
    descripcion: "Cada pregunta es un punto por público, con la mediana y la referencia.",
    pide: "Las preguntas de escala de cada público",
    parche: {},
    grafico: graficoDeCatalogo("p_panorama", {}, (e) => ({
      regla: { ...REGLA_POR_DEFECTO.panorama }, ...(e.bases.length ? { vars: todasDeLasBases(e.bases) } : {}), ...indicadorPorDefecto(e),
    })),
    coincide: conGrafico("p_panorama"),
  },
  {
    clave: "p_slide_1_grafico:fortalezas",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_fortalezas"),
    deResumen: true,
    uso: "Las preguntas mejor y peor valoradas de un público",
    descripcion: "Las más altas y las más bajas de un público, lado a lado.",
    pide: "Un público y su batería de escala",
    parche: {},
    grafico: graficoDeCatalogo("p_fortalezas", {}, (e) => {
      const base = basePrincipal(e);
      return { ...(base ? { vars: todasDeLasBases([base]) } : {}), ...indicadorPorDefecto(e) };
    }),
    coincide: conGrafico("p_fortalezas"),
  },
  {
    clave: "p_slide_1_grafico:cobertura",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_cobertura"),
    deResumen: true,
    uso: "Cuántos respondieron por público y contra qué meta",
    descripcion: "Por público, los casos, el padrón, la cobertura y la meta.",
    pide: "El padrón y la meta de cada público",
    parche: {},
    // U3: nace con todas las bases del estudio y, si Cálculo de muestra o Monitoreo los declaran, con su padrón y su
    // meta ya escritos (la propuesta; en la tarjeta se ven con su origen y se cambian).
    grafico: graficoDeCatalogo("p_cobertura", {}, (e) => coberturaPorDefecto(e)),
    coincide: conGrafico("p_cobertura"),
  },
  {
    clave: "p_slide_1_grafico:contraste",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_dumbbell:contraste"),
    deResumen: true,
    uso: "La misma pregunta en dos públicos y su diferencia",
    descripcion: "Pares de puntos por pregunta, ordenados por diferencia.",
    pide: "Las preguntas comunes de la matriz de equivalencias",
    parche: {},
    // `p_dumbbell` es de uno o varios públicos; en estilo resumen compara dos (S1).
    usa: { publicos: "varios" },
    // El par que compara (`bases`, graficos_dumbbell_auto.R): las dos primeras bases del estudio, en su orden. Con tres
    // o más el motor pide elegirlo; así nace elegido y se cambia en «Públicos que se comparan».
    grafico: graficoDeCatalogo("p_dumbbell:contraste", {}, (e) => {
      const par = parDelContraste(e.bases);
      return { regla: { ...REGLA_POR_DEFECTO.contraste }, ...(par ? { bases: par } : {}), ...indicadorPorDefecto(e, true) };
    }),
    coincide: conGrafico("p_dumbbell", (a) => resumen(a) && !esEntreGrupos(a)),
  },
  {
    // ADR 0137 (decisión 1): la variante pregunta × cruce del mapa de calor de dimensiones, como tipo propio.
    clave: "p_slide_1_grafico:mapa_calor",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_heatmap_cruce"),
    uso: "Una pregunta por los grupos de otra, en tonos",
    descripcion: "El Total y cada grupo en las filas, las opciones en las columnas; cada fila suma 100 %.",
    pide: "Una pregunta de respuesta única y el cruce",
    parche: {},
    grafico: graficoDeCatalogo("p_heatmap_cruce"),
    coincide: conGrafico("p_heatmap_cruce"),
  },
  {
    clave: "p_slide_1_grafico:aperturas",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_dumbbell:aperturas"),
    deResumen: true,
    uso: "Un público abierto por grupos, cada uno con su forma",
    descripcion: "Una fila por grupo en cada pregunta, hasta cuatro grupos.",
    pide: "La variable que divide a los grupos",
    parche: {},
    // La variante quita `cruce` y `bases` (args_quitar): la brecha arranca en «dos grupos», el cruce se elige en Datos y
    // dentro de un público no hay par.
    grafico: graficoDeCatalogo("p_dumbbell:aperturas", {}, (e) => ({ regla: { ...REGLA_POR_DEFECTO.aperturas }, ...indicadorPorDefecto(e, true) })),
    coincide: conGrafico("p_dumbbell", (a) => resumen(a) && esEntreGrupos(a)),
  },
  {
    clave: "p_slide_1_grafico:escala",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_barras_divergentes:escala_sin_informacion"),
    deResumen: true,
    uso: "Desacuerdo, acuerdo y Sin información en su columna",
    descripcion: "Barras divergentes con lo que se desconoce en una columna gris.",
    pide: "Una batería de acuerdo",
    parche: {},
    grafico: graficoDeCatalogo("p_barras_divergentes:escala_sin_informacion", {}, (e) => {
      // Con 2+ bases, una lámina sobre todas (el motor rotula cada fila con su público); con una, la suya.
      const base = basePrincipal(e);
      const bases = e.bases.length > 1 ? e.bases : base ? [base] : [];
      return { regla: { ...REGLA_POR_DEFECTO.escala }, ...(bases.length ? { vars: todasDeLasBases(bases) } : {}) };
    }),
    coincide: conGrafico("p_barras_divergentes", resumen),
  },
  {
    clave: "p_slide_1_grafico:divergentes",
    tipo: "p_slide_1_grafico",
    ...deCatalogo("p_barras_divergentes"),
    uso: "Totales de desacuerdo y acuerdo a cada lado",
    descripcion: "Desacuerdo a la izquierda y acuerdo a la derecha de una línea central, con el total de cada lado.",
    pide: "Una batería de acuerdo",
    parche: {},
    // La regla es del estilo resumen: el constructor la rechaza con «recetario», así que la tarjeta la borra.
    grafico: graficoDeCatalogo("p_barras_divergentes", { estilo: "recetario", regla: undefined }),
    coincide: conGrafico("p_barras_divergentes", (a) => !resumen(a)),
  },
  {
    // ADR 0135 §6: tres a cinco hallazgos, cada uno con una cifra tomada de otra lámina y la frase del analista.
    clave: "p_slide_cierre_hallazgos:cierre",
    tipo: "p_slide_cierre_hallazgos",
    entrada: "p_slide_cierre_hallazgos",
    nombre: "Cierre con hallazgos",
    clase: "lamina",
    // R13-7: la misma entrada del catálogo que la familia «Hallazgos» (USO_ESTRUCTURA, detalleLamina.ts); una sola
    // descripción, no una segunda redactada aquí.
    uso: usoDeTarjeta("p_slide_cierre_hallazgos", undefined, undefined),
    descripcion: usoDeTarjeta("p_slide_cierre_hallazgos", undefined, undefined),
    pide: "Láminas de resumen ya puestas en el informe",
    parche: {},
    usaSinGrafico: "Cifras de otras láminas de resumen del informe",
    coincide: () => true,
  },
];

export const INTENCIONES_CONTAR: readonly IntencionContar[] = [
  {
    id: "resumir",
    nombre: "Resumen del estudio",
    ayuda: "Cómo valora cada público.",
    tarjetas: ["p_slide_1_grafico:panorama", "p_slide_1_grafico:fortalezas", "p_slide_1_grafico:cobertura", "p_slide_cierre_hallazgos:cierre"],
  },
  {
    id: "comparar",
    nombre: "Comparación de públicos",
    ayuda: "Dónde difieren los públicos.",
    tarjetas: ["p_slide_1_grafico:contraste"],
  },
  {
    id: "dentro",
    nombre: "Grupos de un público",
    ayuda: "Qué grupo interno es más crítico.",
    tarjetas: ["p_slide_1_grafico:aperturas", "p_slide_1_grafico:mapa_calor", "p_slide_1_grafico:contraste"],
  },
  {
    id: "escala",
    nombre: "Escalas de acuerdo",
    ayuda: "Acuerdo, desacuerdo y lo que se desconoce.",
    tarjetas: ["p_slide_1_grafico:escala", "p_slide_1_grafico:divergentes"],
  },
];

export function tarjetaContar(clave: string | null | undefined): TarjetaContar | null {
  return TARJETAS_CONTAR.find((t) => t.clave === clave) ?? null;
}

/**
 * ¿El registro de esta sesión trae lo que la tarjeta pide? `graficadores` son los nombres que el registro conoce (o, sin
 * registro cargado, los del catálogo generado) y `laminas`, los tipos de lámina.
 */
export function tarjetaDisponible(t: Pick<TarjetaContar, "tipo" | "grafico">, graficadores: ReadonlySet<string>, laminas: ReadonlySet<string>): boolean {
  if (t.grafico && TIPOS_RETIRADOS_0137.has(t.grafico.graficador)) return false;   // ADR 0137
  return laminas.has(t.tipo) && (!t.grafico || graficadores.has(t.grafico.graficador));
}

/** Las tarjetas de una intención que el registro ofrece, en su orden. */
export function tarjetasDe(i: Pick<IntencionContar, "tarjetas">, graficadores: ReadonlySet<string>, laminas: ReadonlySet<string>): TarjetaContar[] {
  return i.tarjetas.flatMap((k) => {
    const t = tarjetaContar(k);
    return t && tarjetaDisponible(t, graficadores, laminas) ? [t] : [];
  });
}

/** La tarjeta por intención que la lámina ya es (para marcarla «Actual»), o `null`. */
export function tarjetaContarDeLamina(slide: Pick<Slide, "tipo" | "payload">): TarjetaContar | null {
  const payload = (slide.payload ?? {}) as Args;
  return TARJETAS_CONTAR.find((t) => t.tipo === slide.tipo && t.coincide(payload)) ?? null;
}

/** La primera intención que ofrece la tarjeta. */
export function intencionDeTarjeta(clave: string): IntencionContarId | null {
  return INTENCIONES_CONTAR.find((i) => i.tarjetas.includes(clave as ClavePreset))?.id ?? null;
}

/** Sin tildes ni mayúsculas: «gráfico» casa con «grafico». */
export function normalizarBusqueda(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** ¿Todas las palabras de la búsqueda están en alguno de los textos? Vacía, todo casa. */
export function casaBusqueda(busqueda: string, textos: readonly (string | null | undefined)[]): boolean {
  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const pajar = normalizarBusqueda(textos.filter(Boolean).join(" "));
  return palabras.every((p) => pajar.includes(p));
}

/**
 * Cómo el inspector y la Estructura presentan un gráfico ya puesto (ADR 0139): con el nombre de su variante del catálogo
 * si la es (el contraste es «Contraste de públicos», no «Brecha entre dos grupos»; mismo criterio que
 * `.graficos_variante_de`) o el de la recomendación que lo describe; siempre de clase «Gráfico». `deResumen` dice si es
 * un gráfico de resumen (el cierre con hallazgos toma sus cifras de ahí).
 */
export function presentacionDeGrafico(graficador: string, args: Args): { nombre: string | null; clase: ClaseTarjeta; deResumen: boolean } {
  const variante = varianteDeGrafico(graficador, args);
  const t = TARJETAS_CONTAR.find((x) => !!x.grafico && x.coincide({ grafico: { graficador, args } }));
  return { nombre: variante?.nombre ?? t?.nombre ?? null, clase: "grafico", deResumen: !!t?.deResumen };
}
