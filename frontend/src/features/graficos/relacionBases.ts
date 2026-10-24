// De qué base lee el motor una pregunta que no dice su base (`p7` en vez de `docentes$p7`).
//
// El motor del PPT resuelve una referencia suelta contra `default_source` (`api/R/reporte_plan_ppt.R`): la única base
// si hay una sola, o la base llamada `default` si existe; si no hay ninguna de las dos, aborta. Es determinista, así
// que «existe en dos bases» no siempre es un bloqueo: si la otra base es un repeat (o una hija) de la que lee el motor,
// sus columnas son las mismas preguntas repetidas y la lámina sale bien. CCSS Perfil 2026: `datos_crianza` repite
// columnas de `default` y el validador bloqueaba 117 láminas que «Previsualizar» dibujaba sin problema.
//
// Entre públicos hermanos (docentes y estudiantes, dos bases principales) la pregunta sí es ambigua y sigue siendo
// error: la ref suelta saldría de `default` aunque el analista pensara en la otra.

/** Base que el motor usa para una ref sin `$` cuando hay varias. */
export const BASE_QUE_LEE_EL_MOTOR = "default";

export type RelacionBases = {
  /** Base contra la que el motor resuelve una ref suelta; `null` si no hay ninguna (entonces aborta). */
  resolutora: string | null;
  /** Base hija → base madre (repeats y bases hijas). */
  padreDe: Readonly<Record<string, string>>;
};

export const SIN_RELACION: RelacionBases = { resolutora: null, padreDe: {} };

/** Lo que el endpoint de variables trae de cada fuente; lo demás se ignora. */
export type FuenteConRelacion = {
  name: string;
  source_role?: unknown;
  parent_base?: unknown;
  repeat_grain?: unknown;
};

// R puede serializar un escalar como `["default"]`.
function texto(v: unknown): string {
  if (Array.isArray(v)) return v.length === 1 ? texto(v[0]) : "";
  return typeof v === "string" ? v.trim() : "";
}

/** Base madre de una fuente: `parent_base` o, si es repeat, el `parent_base` de su grano. */
export function padreDeFuente(fuente: FuenteConRelacion): string {
  const directo = texto(fuente.parent_base);
  if (directo) return directo;
  const grano = fuente.repeat_grain;
  if (grano && typeof grano === "object" && !Array.isArray(grano)) {
    return texto((grano as Record<string, unknown>).parent_base);
  }
  return "";
}

export function relacionDeFuentes(fuentes: readonly FuenteConRelacion[]): RelacionBases {
  const nombres = fuentes.map((f) => texto(f.name)).filter(Boolean);
  const padreDe: Record<string, string> = {};
  for (const f of fuentes) {
    const nombre = texto(f.name);
    const padre = padreDeFuente(f);
    if (nombre && padre && padre !== nombre && nombres.includes(padre)) padreDe[nombre] = padre;
  }
  const resolutora = nombres.length === 1
    ? nombres[0]
    : nombres.includes(BASE_QUE_LEE_EL_MOTOR) ? BASE_QUE_LEE_EL_MOTOR : null;
  return { resolutora, padreDe };
}

function desciendeDe(base: string, ancestro: string, padreDe: Readonly<Record<string, string>>): boolean {
  let actual = base;
  for (let paso = 0; paso < 16; paso++) {
    const padre = padreDe[actual];
    if (!padre) return false;
    if (padre === ancestro) return true;
    actual = padre;
  }
  return false;
}

/**
 * La base de la que el motor leerá una pregunta suelta presente en `bases`, si no hay ambigüedad: está en la base
 * resolutora y las demás bases donde aparece son repeats o hijas de ella. `null` en cualquier otro caso.
 */
export function baseQueResuelve(bases: readonly string[], relacion: RelacionBases): string | null {
  const { resolutora, padreDe } = relacion;
  if (!resolutora || !bases.includes(resolutora)) return null;
  return bases.every((b) => b === resolutora || desciendeDe(b, resolutora, padreDe)) ? resolutora : null;
}

/** «la base principal» para `default`; «la base «Datos crianza»» para el resto (sin guiones bajos). */
export function laBase(nombre: string): string {
  if (nombre === BASE_QUE_LEE_EL_MOTOR) return "la base principal";
  const t = nombre.replace(/[_-]+/g, " ").trim();
  return `la base «${t ? t[0].toLocaleUpperCase("es") + t.slice(1) : nombre}»`;
}
