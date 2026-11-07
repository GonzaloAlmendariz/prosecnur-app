// «¿Qué quieres contar?» (ADR 0135 §1; maqueta graficos-sintesis, Main y Conceptos): el selector de láminas se recorre
// por la pregunta del estudio. Cada tarjeta es una lámina con su gráfico de partida (el mecanismo de `PRESETS_LAMINA`,
// opcionesLamina.ts) y declara su clase: un gráfico de uso general, una lámina o una lámina de resumen. La clase es de la
// tarjeta y no del graficador: `p_dumbbell` es un gráfico en estilo recetario y una lámina de resumen en estilo resumen.
//
// Una tarjeta sólo aparece si el registro trae lo que pide (`requiere`), como `FUERA_DEL_CATALOGO`: Fortalezas y
// Cobertura entran solas cuando el backend las declare. El cierre con hallazgos es un tipo de lámina sin gráfico
// (`p_slide_cierre_hallazgos`): su tarjeta no trae `grafico` y entra cuando el registro trae el tipo. La tendencia entre
// mediciones queda fuera (ADR 0135 §9). Pura: el selector la usa y los tests la prueban sola.

import type { Slide } from "../../../../api/graficos";
import { esEntreGrupos } from "../brecha/modeloBrechaGrupos";
import { conPropuesta } from "../gruposPadron/modeloPadron";
import type { ClavePreset, EstudioDelSelector, PresetLamina } from "./opcionesLamina";

export type ClaseTarjeta = "grafico" | "lamina" | "resumen";

export const ROTULO_CLASE: Readonly<Record<ClaseTarjeta, string>> = {
  grafico: "Gráfico",
  lamina: "Lámina",
  resumen: "Lámina de resumen",
};

export type IntencionContarId = "resumir" | "comparar" | "dentro" | "escala";

export type IntencionContar = {
  id: IntencionContarId;
  nombre: string;
  /** Una línea bajo el nombre, con el ejemplo de la pregunta que responde. */
  ayuda: string;
  tarjetas: readonly ClavePreset[];
};

export type TarjetaContar = PresetLamina & Required<Pick<PresetLamina, "clase" | "pide">>;

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
 * El panorama toma todas las de escala de cada base del estudio; la escala, las de la base activa.
 */
export const REGLA_POR_DEFECTO = {
  panorama: { tipo: "todas" },
  contraste: { tipo: "mayor_diferencia", n: 13 },
  aperturas: { tipo: "mayor_diferencia", n: 10 },
  escala: { tipo: "bajo_umbral", umbral: 60 },
} as const;

/** `base$*` de cada base: todas sus preguntas de escala (graficos_panorama_plan.R). */
export const todasDeLasBases = (bases: readonly string[]): string[] => bases.map((b) => `${b}$*`);

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
    nombre: "Panorama de públicos",
    clase: "resumen",
    uso: "Quién valora más y quién concentra las preguntas bajas",
    descripcion: "Cada pregunta es un punto por público, con la mediana y la referencia.",
    pide: "Las preguntas de escala de cada público",
    parche: {},
    grafico: {
      graficador: "p_panorama", args: {},
      porDefecto: (e) => ({ regla: { ...REGLA_POR_DEFECTO.panorama }, ...(e.bases.length ? { vars: todasDeLasBases(e.bases) } : {}) }),
    },
    coincide: conGrafico("p_panorama"),
  },
  {
    clave: "p_slide_1_grafico:fortalezas",
    tipo: "p_slide_1_grafico",
    nombre: "Fortalezas y alertas",
    clase: "resumen",
    uso: "Las preguntas mejor y peor valoradas de un público",
    descripcion: "Las más altas y las más bajas de un público, lado a lado.",
    pide: "Un público y su batería de escala",
    parche: {},
    grafico: {
      graficador: "p_fortalezas", args: {},
      porDefecto: (e) => {
        const base = basePrincipal(e);
        return base ? { vars: todasDeLasBases([base]) } : {};
      },
    },
    coincide: conGrafico("p_fortalezas"),
  },
  {
    clave: "p_slide_1_grafico:cobertura",
    tipo: "p_slide_1_grafico",
    nombre: "Cobertura y participación",
    clase: "resumen",
    uso: "Cuántos respondieron por público y contra qué meta",
    descripcion: "Por público, los casos, el padrón, la cobertura y la meta.",
    pide: "El padrón y la meta de cada público",
    parche: {},
    // U3: nace con todas las bases del estudio y, si Cálculo de muestra o Monitoreo los declaran, con su padrón y su
    // meta ya escritos (la propuesta; en la tarjeta se ven con su origen y se cambian).
    grafico: { graficador: "p_cobertura", args: {}, porDefecto: (e) => coberturaPorDefecto(e) },
    coincide: conGrafico("p_cobertura"),
  },
  {
    clave: "p_slide_1_grafico:contraste",
    tipo: "p_slide_1_grafico",
    nombre: "Contraste de públicos",
    clase: "resumen",
    uso: "La misma pregunta en dos públicos y su diferencia",
    descripcion: "Pares de puntos por pregunta, ordenados por diferencia.",
    pide: "Las preguntas comunes de la matriz de equivalencias",
    parche: {},
    grafico: { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null }, porDefecto: () => ({ regla: { ...REGLA_POR_DEFECTO.contraste } }) },
    coincide: conGrafico("p_dumbbell", (a) => resumen(a) && !esEntreGrupos(a)),
  },
  {
    clave: "p_slide_1_grafico:significancia",
    tipo: "p_slide_1_grafico",
    nombre: "Diferencias significativas",
    clase: "grafico",
    uso: "Qué diferencias entre públicos no son azar",
    descripcion: "Tabla de porcentajes con letras de significancia.",
    pide: "Una batería y sus públicos",
    parche: {},
    grafico: { graficador: "p_significancia_publicos", args: {} },
    coincide: conGrafico("p_significancia_publicos"),
  },
  {
    clave: "p_slide_1_grafico:dimensiones",
    tipo: "p_slide_1_grafico",
    nombre: "Mapa por dimensión",
    clase: "grafico",
    uso: "Cada dimensión del modelo por público, en tonos",
    descripcion: "Matriz de dimensiones por público.",
    pide: "Las dimensiones calculadas en Analítica",
    parche: {},
    grafico: { graficador: "p_dim_heatmap_criterios", args: {} },
    coincide: conGrafico("p_dim_heatmap_criterios"),
  },
  {
    clave: "p_slide_1_grafico:aperturas",
    tipo: "p_slide_1_grafico",
    nombre: "Aperturas internas",
    clase: "resumen",
    uso: "Un público abierto por grupos, cada uno con su forma",
    descripcion: "Una fila por grupo en cada pregunta, hasta cuatro grupos.",
    pide: "La pregunta que define los grupos",
    parche: {},
    // Sin `cruce: null`: la brecha arranca en «dos grupos» y el cruce se elige en Datos.
    grafico: { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: undefined }, porDefecto: () => ({ regla: { ...REGLA_POR_DEFECTO.aperturas } }) },
    coincide: conGrafico("p_dumbbell", (a) => resumen(a) && esEntreGrupos(a)),
  },
  {
    clave: "p_slide_1_grafico:escala",
    tipo: "p_slide_1_grafico",
    nombre: "Escala con Sin información aparte",
    clase: "resumen",
    uso: "Desacuerdo, acuerdo y Sin información en su columna",
    descripcion: "Barras divergentes con lo que se desconoce en una columna gris.",
    pide: "Una batería de acuerdo",
    parche: {},
    grafico: {
      graficador: "p_barras_divergentes", args: { estilo: "resumen" },
      porDefecto: (e) => {
        const base = basePrincipal(e);
        return { regla: { ...REGLA_POR_DEFECTO.escala }, ...(base ? { vars: todasDeLasBases([base]) } : {}) };
      },
    },
    coincide: conGrafico("p_barras_divergentes", resumen),
  },
  {
    clave: "p_slide_1_grafico:divergentes",
    tipo: "p_slide_1_grafico",
    nombre: "Barras divergentes del recetario",
    clase: "grafico",
    uso: "Totales de desacuerdo y acuerdo a cada lado",
    descripcion: "La lámina 71 del recetario.",
    pide: "Una batería de acuerdo",
    parche: {},
    // La regla es del estilo resumen: el constructor la rechaza con «recetario», así que la tarjeta la borra.
    grafico: { graficador: "p_barras_divergentes", args: { estilo: "recetario", regla: undefined } },
    coincide: conGrafico("p_barras_divergentes", (a) => !resumen(a)),
  },
  {
    // ADR 0135 §6: tres a cinco hallazgos, cada uno con una cifra tomada de otra lámina y la frase del analista.
    clave: "p_slide_cierre_hallazgos:cierre",
    tipo: "p_slide_cierre_hallazgos",
    nombre: "Cierre con hallazgos",
    clase: "resumen",
    uso: "Las cifras clave del estudio con tu frase",
    descripcion: "De tres a cinco hallazgos, cada uno con una cifra de otra lámina de resumen.",
    pide: "Láminas de resumen ya puestas en el informe",
    parche: {},
    coincide: () => true,
  },
];

export const INTENCIONES_CONTAR: readonly IntencionContar[] = [
  {
    id: "resumir",
    nombre: "Resumir el estudio",
    ayuda: "Cómo valora cada público, en una lámina.",
    tarjetas: ["p_slide_1_grafico:panorama", "p_slide_1_grafico:fortalezas", "p_slide_1_grafico:cobertura", "p_slide_cierre_hallazgos:cierre"],
  },
  {
    id: "comparar",
    nombre: "Comparar públicos",
    ayuda: "Dónde difieren docentes y estudiantes.",
    tarjetas: ["p_slide_1_grafico:contraste", "p_slide_1_grafico:significancia", "p_slide_1_grafico:dimensiones"],
  },
  {
    id: "dentro",
    nombre: "Ver dentro de un público",
    ayuda: "Qué grupo interno es más crítico.",
    tarjetas: ["p_slide_1_grafico:aperturas", "p_slide_1_grafico:contraste"],
  },
  {
    id: "escala",
    nombre: "Leer una escala",
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
 * La clase y el nombre con que el inspector presenta un gráfico ya puesto: el de la tarjeta por intención que lo
 * describe (el contraste es «Contraste de públicos», no «Brecha entre dos grupos») o, si ninguna, un gráfico.
 */
export function presentacionDeGrafico(graficador: string, args: Args): { nombre: string | null; clase: ClaseTarjeta } {
  const t = TARJETAS_CONTAR.find((x) => !!x.grafico && x.coincide({ grafico: { graficador, args } }));
  return t ? { nombre: t.nombre, clase: t.clase } : { nombre: null, clase: "grafico" };
}
