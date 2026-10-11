// Composición de una lámina en su tamaño real (F6.2; dirección F6 §4.3 y §6 `ComposicionLamina`). Pura: se prueba sin
// DOM. Las ranuras salen del estándar (`estandar_pulso.json` → ranurasEstandar.generated.ts) en pulgadas de la lámina
// 13,333 × 7,5, y a cada ranura de gráfico o de cifra se le asigna el slot del payload que la llena, para dibujar los
// gráficos de la lámina actual acomodados en una composición candidata («así quedaría»).
//
// El estándar no nombra slots: declara las ranuras en orden. El orden de los slots de gráfico (`SLIDE_GRAF_SLOTS`) es
// el de las ranuras de gráfico salvo donde se declara aquí (`ORDEN_SLOTS`). Una ranura de cifras del estándar es una
// sola caja que el compositor reparte entre los slots `cifra_*`.

import { RANURAS_ESTANDAR, type TipoRanuraEstandar } from "./ranurasEstandar.generated";

export const LAMINA_PULGADAS = { w: 13.333, h: 7.5 } as const;

/** Medianil entre cifras de una misma banda (pulgadas, `cifras.calle` del estándar para la banda superior). */
const CALLE_CIFRAS = 0.4;

export type RanuraComposicion = {
  tipo: TipoRanuraEstandar;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Slot del payload que la llena (gráfico o cifra); `null` en las de texto. */
  slot: string | null;
};

export type Composicion = {
  /** `estandar`: el tipo está en el estándar; `derivada`: lámina antigua dibujada con la de su reparto; `estructura`: sin ranuras. */
  fuente: "estandar" | "derivada" | "estructura";
  /** Tipo del estándar cuyas ranuras se usan. */
  base: string | null;
  ranuras: RanuraComposicion[];
  /** Lleva el ícono del público en la cabecera. */
  poblacion: boolean;
};

/** Láminas de población antiguas (fuera del selector): se dibujan con las ranuras de su mismo reparto del estándar. */
export const BASE_DERIVADA: Readonly<Record<string, string>> = {
  p_slide_2_graficos_poblacion: "p_slide_2_graficos",
  // «Dos paneles apilados a la izquierda y uno alto a la derecha» (graficos_metadata.R): el reparto de la 2 + 1.
  p_slide_3_graficos_poblacion: "p_slide_3_graficos_2mas1",
  p_slide_4_graficos_poblacion: "p_slide_4_graficos",
};

/** Tipos con el ícono del público en la cabecera (el recetario moderno lo pone ahí). */
const CON_POBLACION: ReadonlySet<string> = new Set([
  "p_slide_3_graficos_poblacion_tira",
  "p_slide_3_graficos_poblacion_corona",
  "p_slide_3_graficos_poblacion_cifras",
  "p_slide_5_graficos_poblacion",
  "p_slide_6_graficos_poblacion",
  ...Object.keys(BASE_DERIVADA),
]);

/**
 * Orden en que los slots de gráfico llenan las ranuras de gráfico del estándar, cuando no es el de `SLIDE_GRAF_SLOTS`.
 * En la de cifras el estándar declara arriba-centro, abajo-centro y la alta de la derecha.
 */
const ORDEN_SLOTS: Readonly<Record<string, readonly string[]>> = {
  p_slide_3_graficos_poblacion_cifras: ["superior_izquierda", "inferior_izquierda", "derecha"],
};

export const esSlotCifra = (slot: string): boolean => slot.startsWith("cifra_");

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Reparte una ranura de cifras entre sus slots: en fila si es ancha, apiladas si es alta. */
function repartirCifras(r: { x: number; y: number; w: number; h: number }, slots: readonly string[]): RanuraComposicion[] {
  if (slots.length === 0) return [{ tipo: "cifras", ...r, slot: null }];
  const n = slots.length;
  const enFila = r.w >= r.h;
  const total = enFila ? r.w : r.h;
  const paso = (total - CALLE_CIFRAS * (n - 1)) / n;
  return slots.map((slot, i) => {
    const desde = i * (paso + CALLE_CIFRAS);
    return enFila
      ? { tipo: "cifras", x: r3(r.x + desde), y: r.y, w: r3(paso), h: r.h, slot }
      : { tipo: "cifras", x: r.x, y: r3(r.y + desde), w: r.w, h: r3(paso), slot };
  });
}

/**
 * La composición de `tipo` con sus slots asignados. `slots` son los slots de gráfico del tipo (`SLIDE_GRAF_SLOTS`), en
 * el orden que numera las ranuras (`foco=<slide.id>:gK`).
 */
export function composicionDe(tipo: string, slots: readonly string[]): Composicion {
  const base = RANURAS_ESTANDAR[tipo] ? tipo : BASE_DERIVADA[tipo] ?? null;
  const poblacion = CON_POBLACION.has(tipo);
  if (!base) return { fuente: "estructura", base: null, ranuras: [], poblacion };
  const graficos = [...(ORDEN_SLOTS[tipo] ?? slots.filter((s) => !esSlotCifra(s)))];
  const cifras = slots.filter(esSlotCifra);
  const ranuras: RanuraComposicion[] = [];
  for (const r of RANURAS_ESTANDAR[base].ranuras) {
    if (r.tipo === "grafico") ranuras.push({ ...r, slot: graficos.shift() ?? null });
    else if (r.tipo === "cifras") ranuras.push(...repartirCifras(r, cifras));
    else ranuras.push({ ...r, slot: null });
  }
  return { fuente: base === tipo ? "estandar" : "derivada", base, ranuras, poblacion };
}

/** Número de la ranura de `slot` (1-based, el de `foco=<slide.id>:gK`), o `null` si no es un slot del tipo. */
export function numeroDeRanura(slots: readonly string[], slot: string | null): number | null {
  if (!slot) return null;
  const i = slots.indexOf(slot);
  return i < 0 ? null : i + 1;
}
