// Formas de alambre de `courseLevelRanges` (criterio de nivel del curso por
// facultad). El contrato tiene DOS emisores con shapes distintos:
//   - el motor R emite Array<{min, max}> y el centinela de exención
//     [{exenta: true}] (`.cm_criterios_normalize_rangos`,
//     api/R/calc_muestra_aulas_criterios.R);
//   - la UI emite pares posicionales Array<[number, number]>
//     (CriteriosSeleccionMarco.courseLevelRanges).
// El motor acepta ambos desde el fix del formato; este módulo hace lo propio
// del lado de LECTURA, para que la UI muestre lo que el motor tiene aplicado
// venga de donde venga. Antes la lectura hacía `r[0]` sobre `{min, max}` y
// devolvía pares de undefined: los rangos aplicados por API eran invisibles
// en la UI y cualquier re-post los borraba (medido en HSVG2026, S2).
//
// Las claves del mapa pueden ser etiquetas del marco («EE.GG. LETRAS», como
// exige el motor) o slugs de la UI; se comparan canonicalizadas.

/** Par [min, max] u objeto {min, max} del motor; exenta es el centinela R. */
export type RangoNivelWire =
  | [number, number]
  | { min?: number | string; max?: number | string; exenta?: boolean };

/** Espejo de `.cm_criterios_fac_key` (R): text_key con ñ→n. Se mantiene local
 *  para no ciclar imports con criteriosImpacto (que importa criteriosMarco). */
export function claveFacultad(nombre: unknown): string {
  return String(nombre ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ñ]/g, "n")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'´’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

/** ¿La entrada de una facultad es el centinela de exención del motor?
 *  R lo emite como [{exenta: true}]; también se aceptan las formas de input
 *  "exenta" / ["exenta"] que el normalizador R reconoce. */
export function esExencionNivel(entradas: unknown): boolean {
  if (typeof entradas === "string") return claveFacultad(entradas) === "exenta";
  if (!Array.isArray(entradas) || entradas.length !== 1) return false;
  const e = entradas[0];
  if (typeof e === "string") return claveFacultad(e) === "exenta";
  return typeof e === "object" && e !== null && (e as { exenta?: unknown }).exenta === true;
}

/** Normaliza UNA entrada de rango a par [min, max]; null si no es un rango. */
export function rangoComoPar(r: unknown): [number, number] | null {
  if (Array.isArray(r) && r.length === 2) {
    const lo = num(r[0]);
    const hi = num(r[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return lo <= hi ? [lo, hi] : [hi, lo];
    return null;
  }
  if (typeof r === "object" && r !== null && !Array.isArray(r)) {
    const o = r as { min?: unknown; max?: unknown };
    const lo = num(o.min);
    const hi = num(o.max);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return lo <= hi ? [lo, hi] : [hi, lo];
  }
  return null;
}

/** Rangos de una facultad: busca por clave canónica (etiqueta del marco o
 *  slug) y acepta ambos shapes de rango. Una exención devuelve [] — para la
 *  UI equivale a «sin filtro de nivel en esta facultad». */
export function rangosDesdeMapa(
  mapa: Record<string, unknown> | null | undefined,
  facultad: string,
): Array<[number, number]> {
  if (!mapa) return [];
  const objetivo = claveFacultad(facultad);
  if (!objetivo) return [];
  for (const [clave, entradas] of Object.entries(mapa)) {
    if (claveFacultad(clave) !== objetivo) continue;
    if (esExencionNivel(entradas)) return [];
    const lista = Array.isArray(entradas) ? entradas : [entradas];
    return lista
      .map(rangoComoPar)
      .filter((par): par is [number, number] => par != null);
  }
  return [];
}

/** Borra del mapa toda entrada cuya clave canónica coincida con `facultad`.
 *  Muta una copia que el caller ya hizo (setRangosFacultad). */
export function borrarClaveCanonica(
  mapa: Record<string, unknown>,
  facultad: string,
): void {
  const objetivo = claveFacultad(facultad);
  for (const clave of Object.keys(mapa)) {
    if (claveFacultad(clave) === objetivo) delete mapa[clave];
  }
}
