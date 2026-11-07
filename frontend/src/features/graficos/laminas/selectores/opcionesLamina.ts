// Tarjetas de «¿Qué lámina?» que no son un tipo del registro sino un tipo con su payload de partida (H7 del checklist
// de usabilidad, 2026-11-05): «Resumen ejecutivo» es `p_slide_hallazgos` con `modo: "resumen", seleccion: "auto"`, y
// estaba escondido como un modo de «Hallazgos clave». Pura: el selector la usa para armar sus tarjetas, insertar y
// cambiar; los tests la prueban sola.
//
// Una opción es el tipo (la tarjeta de siempre) o `tipo:preset`. Al elegir una, su `parche` se escribe sobre el payload
// (un `undefined` borra la clave). La tarjeta del tipo puede tener su propio parche: «Hallazgos clave» son las cifras
// (`modo: "cifras"`), así que elegirla desde un resumen ejecutivo deja de ser un resumen.

import type { GraficadorRef, Slide, SlideType } from "../../../../api/graficos";
import { esGraficadorRef, type CambioTipoLamina } from "./cambioTipoLamina";
import { TARJETAS_CONTAR, type ClaseTarjeta } from "./intencionesContar";
import type { Intencion, IntencionLamina } from "./tiposLamina";
import { SLIDE_GRAF_SLOTS } from "../../store";

export type ClavePreset = `${SlideType}:${string}`;
export type OpcionLamina = SlideType | ClavePreset;

type Parche = Readonly<Record<string, unknown>>;

/** Lo que el selector sabe del estudio al insertar: sus bases y la activa (useVariables). */
export type EstudioDelSelector = { bases: readonly string[]; baseActiva: string | null };

export const SIN_ESTUDIO: EstudioDelSelector = { bases: [], baseActiva: null };

/** El gráfico con que nace la tarjeta (ADR 0135 §1: la tarjeta, no el graficador, decide la clase). */
export type GraficoDePreset = {
  graficador: string;
  /** Args de partida; un `undefined` borra la clave al aplicarlos sobre un gráfico del mismo tipo. */
  args: Readonly<Record<string, unknown>>;
  /**
   * Args que sólo se escriben si el gráfico no los tiene (ADR 0135 §2): la regla de preguntas con que arranca la lámina
   * de resumen y, si dependen del estudio, sus `vars`. Lo ya configurado no se pisa.
   */
  porDefecto?: (estudio: EstudioDelSelector) => Readonly<Record<string, unknown>>;
  /** Ranura donde va (sin ella, la primera del tipo). */
  slot?: string;
};

export type PresetLamina = {
  clave: ClavePreset;
  tipo: SlideType;
  /** La familia de «Ver por tipo de gráfico» que la ofrece (las tarjetas por intención no tienen). */
  intencion?: IntencionLamina;
  nombre: string;
  /** Una línea de tarjeta (hasta 56 caracteres, como `usoDeTarjeta`). */
  uso: string;
  descripcion: string;
  parche: Parche;
  grafico?: GraficoDePreset;
  /** «Gráfico», «Lámina» o «Lámina de resumen» (ADR 0135 §1). Sin ella, «Lámina». */
  clase?: ClaseTarjeta;
  /** Lo que la tarjeta necesita del estudio, en una línea del detalle. */
  pide?: string;
  /** ¿La lámina ya es esta opción? (para marcarla «Actual» y no reescribirla). */
  coincide: (payload: Readonly<Record<string, unknown>>) => boolean;
};

const modoDe = (p: Readonly<Record<string, unknown>>) => (typeof p.modo === "string" ? p.modo : "");

export const PRESETS_LAMINA: readonly PresetLamina[] = [
  {
    clave: "p_slide_hallazgos:resumen",
    tipo: "p_slide_hallazgos",
    intencion: "resumen",
    // ADR 0135: el mazo «Resumen ejecutivo» viene después; esta tarjeta se nombra por lo que arma.
    nombre: "Hallazgos por capítulo",
    uso: "Por capítulo, lo que más difiere y la cifra más rotunda",
    descripcion: "Una tabla por capítulo con la diferencia más fuerte y la cifra más rotunda sin diferencia, propuestas por el motor. Se ajustan en la lámina.",
    parche: { modo: "resumen", seleccion: "auto" },
    // El titular por capítulo también es un resumen ejecutivo (comparten selección, topes y capítulos).
    coincide: (p) => modoDe(p) === "resumen" || modoDe(p) === "titulares",
  },
];

/** El parche de la tarjeta del tipo, cuando el tipo comparte registro con un preset. */
const PARCHE_DEL_TIPO: Readonly<Partial<Record<SlideType, Parche>>> = {
  p_slide_hallazgos: { modo: "cifras", seleccion: undefined },
};

export function presetDe(op: OpcionLamina | null | undefined): PresetLamina | null {
  return PRESETS_LAMINA.find((p) => p.clave === op) ?? TARJETAS_CONTAR.find((p) => p.clave === op) ?? null;
}

export function tipoDeOpcion(op: OpcionLamina): SlideType {
  return presetDe(op)?.tipo ?? (op as SlideType);
}

/** Las tarjetas de una intención: sus presets primero y luego sus tipos, en el orden de la intención. */
export function opcionesDe(intencion: Pick<Intencion, "id" | "tipos">): OpcionLamina[] {
  const presets = PRESETS_LAMINA.filter((p) => p.intencion === intencion.id && intencion.tipos.includes(p.tipo)).map((p) => p.clave);
  return [...presets, ...intencion.tipos];
}

/** La opción que la lámina ya es: el preset cuyo `coincide` acierta o, si no, su tipo. */
export function opcionDeLamina(slide: Pick<Slide, "tipo" | "payload">): OpcionLamina {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  return PRESETS_LAMINA.find((p) => p.tipo === slide.tipo && p.coincide(payload))?.clave ?? slide.tipo;
}

function conParche(base: Readonly<Record<string, unknown>>, parche: Parche): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(parche)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** La ranura donde va el gráfico de la tarjeta: la declarada o la primera del tipo. */
export function ranuraDePreset(preset: Pick<PresetLamina, "tipo" | "grafico">): string | null {
  return preset.grafico?.slot ?? SLIDE_GRAF_SLOTS[preset.tipo]?.[0] ?? null;
}

/**
 * El gráfico de la tarjeta sobre lo que ya hay en su ranura: si es el mismo graficador conserva sus args y sólo escribe
 * los de la tarjeta (el contraste pasa a ser aperturas sin perder sus preguntas); si es otro, lo reemplaza.
 */
export function graficoConPreset(previo: unknown, g: GraficoDePreset, estudio: EstudioDelSelector = SIN_ESTUDIO): GraficadorRef {
  const mismo = esGraficadorRef(previo) && previo.graficador === g.graficador;
  const args = conParche(mismo ? previo.args ?? {} : {}, g.args);
  for (const [k, v] of Object.entries(g.porDefecto?.(estudio) ?? {})) {
    if (v !== undefined && (args[k] === undefined || args[k] === null)) args[k] = v;
  }
  return { graficador: g.graficador, args };
}

/** El payload con la opción puesta (un `undefined` del parche borra la clave). */
export function conOpcion(op: OpcionLamina, payload: Readonly<Record<string, unknown>>, estudio: EstudioDelSelector = SIN_ESTUDIO): Record<string, unknown> {
  const preset = presetDe(op);
  const parche = preset?.parche ?? PARCHE_DEL_TIPO[op as SlideType];
  const out = parche ? conParche(payload, parche) : { ...payload };
  const slot = preset?.grafico ? ranuraDePreset(preset) : null;
  if (preset?.grafico && slot) out[slot] = graficoConPreset(payload[slot], preset.grafico, estudio);
  return out;
}

/**
 * El cambio de tipo con la tarjeta puesta. Cuando la tarjeta trae un gráfico distinto del que ocupa su ranura, el de
 * antes se pierde: entra en `sobrantes` para que el selector lo diga y pida confirmarlo antes de aplicar.
 */
export function cambioConOpcion(op: OpcionLamina, cambio: CambioTipoLamina, estudio: EstudioDelSelector = SIN_ESTUDIO): CambioTipoLamina {
  const preset = presetDe(op);
  const payload = conOpcion(op, cambio.payload, estudio);
  const slot = preset?.grafico ? ranuraDePreset(preset) : null;
  if (!preset?.grafico || !slot) return { ...cambio, payload, mismoTipo: false };
  const previo = cambio.payload[slot];
  const reemplaza = esGraficadorRef(previo) && previo.graficador !== preset.grafico.graficador;
  return {
    ...cambio,
    payload,
    mismoTipo: false,
    conservados: reemplaza ? cambio.conservados.filter((r) => r.hacia !== slot) : cambio.conservados,
    sobrantes: reemplaza && esGraficadorRef(previo) ? [...cambio.sobrantes, { slot, grafico: previo }] : cambio.sobrantes,
  };
}
