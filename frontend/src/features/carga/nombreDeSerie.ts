/**
 * Cómo se nombran las mediciones de una serie en la UI (ronda de claridad, U3).
 *
 * Una serie puede ser de años («2024», «2025»), de públicos («docentes»,
 * «egresados»), de sedes o de cualquier otra cosa. Los textos no pueden suponer
 * cuál: una sola función mira los rótulos que vienen de los datos y decide si
 * se habla de «años» o de «mediciones». Toda la UI de Equivalencias y
 * Comparativos usa esta función, así no hay un texto que diga «año» a una serie
 * de públicos.
 */

/** El año que trae el nombre de una base, o el nombre entero si no trae ninguno. */
export function rotuloPorDefecto(base: string): string {
  return base.match(/(19|20)[0-9]{2}/)?.[0] ?? base;
}

export function pareceAnio(rotulo: string): boolean {
  return /^(19|20)[0-9]{2}$/.test(rotulo.trim());
}

export type NombreDeSerie = {
  /** «año» o «medición». */
  singular: string;
  /** «años» o «mediciones». */
  plural: string;
  /** «todos los años» o «todas las mediciones». */
  todas: string;
  /** «ningún año» o «ninguna medición». */
  ninguna: string;
  /** «los» o «las», para «los rótulos de los años». */
  articulo: string;
};

const ANIOS: NombreDeSerie = {
  singular: "año",
  plural: "años",
  todas: "todos los años",
  ninguna: "ningún año",
  articulo: "los",
};

const MEDICIONES: NombreDeSerie = {
  singular: "medición",
  plural: "mediciones",
  todas: "todas las mediciones",
  ninguna: "ninguna medición",
  articulo: "las",
};

/** «Años» sólo si TODOS los rótulos son años. Con uno que no lo es, «mediciones». */
export function nombreDeSerie(rotulos: readonly string[]): NombreDeSerie {
  const llenos = rotulos.map((r) => r.trim()).filter(Boolean);
  return llenos.length > 0 && llenos.every(pareceAnio) ? ANIOS : MEDICIONES;
}

/** Igual que `nombreDeSerie`, a partir de los nombres de las bases. */
export function nombreDeSerieDeBases(bases: readonly string[]): NombreDeSerie {
  return nombreDeSerie(bases.map(rotuloPorDefecto));
}

export function mayuscula(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---- Orden por defecto de la serie (F6, matriz HSyVbG 2026-10-15) -------------
//
// Mientras la persona no declara el orden, la serie se leía en el orden de alta
// de las bases: 2026 → 2024 → 2025 cuando la base de este año se cargó primero.
// Si TODAS las bases nombran un año (en el nombre o en su rótulo), el orden por
// defecto es cronológico; si una sola no lo nombra, no hay un criterio que
// valga para todas y se conserva el de alta. Los empates de año (dos públicos
// de 2024) quedan en su orden de alta.

const ANIO_EN_TEXTO = /(19|20)[0-9]{2}/;

function anioDe(base: string, rotulos?: Readonly<Record<string, string>>): number | null {
  const desdeRotulo = (rotulos?.[base] ?? "").match(ANIO_EN_TEXTO)?.[0];
  const anio = desdeRotulo ?? base.match(ANIO_EN_TEXTO)?.[0];
  return anio ? Number(anio) : null;
}

/** El año que nombra una base (en su rótulo o en su nombre), o `null`. */
export function anioDeBase(base: string, rotulos?: Readonly<Record<string, string>>): number | null {
  return anioDe(base, rotulos);
}

/** Las bases en orden cronológico, o `null` si alguna no nombra un año. */
export function ordenPorAnio(
  bases: readonly string[],
  rotulos?: Readonly<Record<string, string>>,
): string[] | null {
  if (bases.length === 0) return null;
  const anios = bases.map((b) => anioDe(b, rotulos));
  if (anios.some((a) => a === null)) return null;
  return bases
    .map((base, i) => ({ base, i, anio: anios[i] as number }))
    .sort((a, b) => a.anio - b.anio || a.i - b.i)
    .map((x) => x.base);
}

/** Orden de la serie sin declaración: cronológico si todas nombran un año; si no, el de alta. */
export function ordenPorDefectoDeSerie(
  bases: readonly string[],
  rotulos?: Readonly<Record<string, string>>,
): string[] {
  return ordenPorAnio(bases, rotulos) ?? [...bases];
}
