// Tarjetas de «¿Qué lámina?» que no son un tipo del registro sino un tipo con su payload de partida (H7 del checklist
// de usabilidad, 2026-11-05): «Resumen ejecutivo» es `p_slide_hallazgos` con `modo: "resumen", seleccion: "auto"`, y
// estaba escondido como un modo de «Hallazgos clave». Pura: el selector la usa para armar sus tarjetas, insertar y
// cambiar; los tests la prueban sola.
//
// Una opción es el tipo (la tarjeta de siempre) o `tipo:preset`. Al elegir una, su `parche` se escribe sobre el payload
// (un `undefined` borra la clave). La tarjeta del tipo puede tener su propio parche: «Hallazgos clave» son las cifras
// (`modo: "cifras"`), así que elegirla desde un resumen ejecutivo deja de ser un resumen.

import type { Slide, SlideType } from "../../../../api/graficos";
import type { Intencion, IntencionLamina } from "./tiposLamina";

export type ClavePreset = `${SlideType}:${string}`;
export type OpcionLamina = SlideType | ClavePreset;

type Parche = Readonly<Record<string, unknown>>;

export type PresetLamina = {
  clave: ClavePreset;
  tipo: SlideType;
  intencion: IntencionLamina;
  nombre: string;
  /** Una línea de tarjeta (hasta 56 caracteres, como `usoDeTarjeta`). */
  uso: string;
  descripcion: string;
  parche: Parche;
  /** ¿La lámina ya es esta opción? (para marcarla «Actual» y no reescribirla). */
  coincide: (payload: Readonly<Record<string, unknown>>) => boolean;
};

const modoDe = (p: Readonly<Record<string, unknown>>) => (typeof p.modo === "string" ? p.modo : "");

export const PRESETS_LAMINA: readonly PresetLamina[] = [
  {
    clave: "p_slide_hallazgos:resumen",
    tipo: "p_slide_hallazgos",
    intencion: "resumen",
    nombre: "Resumen ejecutivo",
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
  return PRESETS_LAMINA.find((p) => p.clave === op) ?? null;
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

/** El payload con la opción puesta (un `undefined` del parche borra la clave). */
export function conOpcion(op: OpcionLamina, payload: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const parche = presetDe(op)?.parche ?? PARCHE_DEL_TIPO[op as SlideType];
  if (!parche) return { ...payload };
  const out: Record<string, unknown> = { ...payload };
  for (const [k, v] of Object.entries(parche)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}
