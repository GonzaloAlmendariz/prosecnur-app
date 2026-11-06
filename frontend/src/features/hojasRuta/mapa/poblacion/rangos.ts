import type { HojasRutaAgeRange, HojasRutaAgeRangeMode } from "../../../../api/hojasRuta";

/**
 * Rangos de edad de Población (U6). El backend descarta en silencio un rango
 * que termina antes de empezar (`.hojas_ruta_normalize_age_ranges`), así que
 * el editor avisa antes: huecos, solapes, rangos al revés y edades que quedan
 * fuera. El id sigue la misma regla que R (`hojas_ruta_sanitize_filename` del
 * rótulo): «18-29» → «18_29», «60+» → «60».
 */

export const etiquetaRango = (min: number, max: number | null) => (max == null ? `${min}+` : `${min}-${max}`);
export const idRango = (min: number, max: number | null) => etiquetaRango(min, max).replace(/[^0-9a-z]+/gi, "_").replace(/^_+|_+$/g, "");
export const rango = (min: number, max: number | null): HojasRutaAgeRange => ({ id: idRango(min, max), label: etiquetaRango(min, max), min, max });

export const PRESETS_EDAD: ReadonlyArray<{ id: string; etiqueta: string; rangos: HojasRutaAgeRange[] }> = [
  { id: "clasico", etiqueta: "Clásico", rangos: [rango(18, 29), rango(30, 44), rango(45, 59), rango(60, null)] },
  { id: "decadas", etiqueta: "Décadas", rangos: [rango(18, 24), rango(25, 34), rango(35, 44), rango(45, 54), rango(55, 64), rango(65, null)] },
  { id: "tres", etiqueta: "Tres grupos", rangos: [rango(18, 34), rango(35, 54), rango(55, null)] },
];

export type ProblemaRango = { tipo: "al-reves" | "hueco" | "solape" | "abierto-en-medio" | "sin-cierre"; texto: string };

/** Problemas del juego de rangos, en el orden en que aparecen al recorrer las edades. */
export function problemasDeRangos(rangos: readonly HojasRutaAgeRange[]): ProblemaRango[] {
  const out: ProblemaRango[] = [];
  const orden = [...rangos].sort((a, b) => a.min - b.min);
  orden.forEach((r, k) => {
    if (r.max != null && r.max < r.min) out.push({ tipo: "al-reves", texto: `El rango ${r.label} termina antes de empezar` });
    const sig = orden[k + 1];
    if (!sig) return;
    if (r.max == null) out.push({ tipo: "abierto-en-medio", texto: `${r.label} está abierto pero hay rangos después` });
    else if (sig.min > r.max + 1) out.push({ tipo: "hueco", texto: `Faltan las edades ${r.max + 1}${sig.min - 1 > r.max + 1 ? `–${sig.min - 1}` : ""}` });
    else if (sig.min <= r.max) out.push({ tipo: "solape", texto: `${r.label} y ${sig.label} se solapan` });
  });
  const ultimo = orden[orden.length - 1];
  if (ultimo && ultimo.max != null) out.push({ tipo: "sin-cierre", texto: `Quedan fuera las edades desde ${ultimo.max + 1}` });
  return out;
}

/** Firma para saber si la matriz calculada corresponde a estos rangos. */
// R serializa el tope abierto como "NA" dentro de las salidas guardadas: todo
// tope que no sea un número cuenta como abierto.
export const firmaRangos = (rangos: readonly HojasRutaAgeRange[]) =>
  rangos.map((r) => `${Number(r.min)}-${typeof r.max === "number" && Number.isFinite(r.max) ? r.max : ""}`).join("|");

/** Cambia el borde de un rango y regenera su id y rótulo. */
export function editarRango(rangos: readonly HojasRutaAgeRange[], i: number, campo: "min" | "max", valor: number | null): HojasRutaAgeRange[] {
  return rangos.map((r, k) => (k === i ? rango(campo === "min" ? (valor ?? r.min) : r.min, campo === "max" ? valor : r.max) : r));
}

/** Agrega un rango a continuación del último; si el último estaba abierto, lo cierra en diez años. */
export function agregarRango(rangos: readonly HojasRutaAgeRange[]): HojasRutaAgeRange[] {
  const ultimo = rangos[rangos.length - 1];
  if (!ultimo) return [rango(18, null)];
  const cierre = ultimo.max ?? ultimo.min + 9;
  return [...rangos.slice(0, -1), rango(ultimo.min, cierre), rango(Math.min(110, cierre + 1), null)];
}

/** Rangos de R con el tope abierto ("NA") como null; conservan el id que puso el motor (las celdas se cruzan por él). */
export const conTopeAbierto = (rangos: readonly HojasRutaAgeRange[]): HojasRutaAgeRange[] =>
  rangos.map((r) => ({ ...r, min: Number(r.min), max: typeof r.max === "number" && Number.isFinite(r.max) ? r.max : null }));

/** Rangos que vienen de R, rehechos como manuales para editarlos a mano (id y rótulo nuevos). */
export const rangosLimpios = (rangos: readonly HojasRutaAgeRange[]): HojasRutaAgeRange[] =>
  rangos.map((r) => rango(Number(r.min), typeof r.max === "number" && Number.isFinite(r.max) ? r.max : null));

export const CORTES: ReadonlyArray<readonly [Exclude<HojasRutaAgeRangeMode, "manual">, string]> = [
  ["terciles", "Terciles"],
  ["cuartiles", "Cuartiles"],
  ["quintiles", "Quintiles"],
  ["deciles", "Deciles"],
];
