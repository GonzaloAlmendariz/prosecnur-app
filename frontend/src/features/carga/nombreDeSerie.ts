/**
 * Cómo se nombran las mediciones de una serie en la UI.
 *
 * Una serie puede ser de años («2024», «2025»), de públicos («docentes»,
 * «egresados»), de sedes o de cualquier otra cosa. La UI no adivina cuál: las
 * llama siempre «bases», que es lo que son en Carga, en Ponderación y en
 * Equivalencias. Antes se hablaba de «años» cuando todos los rótulos parecían
 * años, y la misma pantalla cambiaba de vocabulario según los datos (Gonzalo,
 * 2026-10-16: «la UI sigue asumiendo años cuando no siempre van a ser años»).
 */

/** El año que trae el nombre de una base, o el nombre entero si no trae ninguno. */
export function rotuloPorDefecto(base: string): string {
  return base.match(/(19|20)[0-9]{2}/)?.[0] ?? base;
}

export function pareceAnio(rotulo: string): boolean {
  return /^(19|20)[0-9]{2}$/.test(rotulo.trim());
}

export type NombreDeSerie = {
  /** «base». */
  singular: string;
  /** «bases». */
  plural: string;
  /** «todas las bases». */
  todas: string;
  /** «ninguna base». */
  ninguna: string;
  /** «las». */
  articulo: string;
};

const BASES: NombreDeSerie = {
  singular: "base",
  plural: "bases",
  todas: "todas las bases",
  ninguna: "ninguna base",
  articulo: "las",
};

/** Siempre «bases»: el vocabulario no depende de cómo se llamen. */
export function nombreDeSerie(_rotulos: readonly string[]): NombreDeSerie {
  return BASES;
}

/** Si todas las bases nombran un año. Sólo para capacidades reales (un lector que exige años). */
export function basesNombranAnio(bases: readonly string[]): boolean {
  return bases.length > 0 && bases.map(rotuloPorDefecto).every(pareceAnio);
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
