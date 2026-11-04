// Ediciones de la config de ponderación como mezclas puras.
//
// Cada parte de la ponderación (diseño, márgenes, NA/98/99, recorte) se edita
// desde un control distinto; ninguna edición puede borrar lo que otra declaró.
// Antes el panel reescribía `design` como `{var, pop_sizes}` y `rake` como
// `{margins}`: editar una meta borraba el peso base y el tratamiento de NA/98/99.

import type {
  PonderacionConfig, PonderDesign, PonderMargin, PonderRake, PonderTrim,
} from "./store";

export function conMargen(p: PonderacionConfig, m: PonderMargin): PonderacionConfig {
  const margins = (p.rake?.margins ?? []).slice();
  const i = margins.findIndex((x) => x.var === m.var);
  if (i >= 0) margins[i] = m;
  else margins.push(m);
  return { ...p, rake: { ...(p.rake ?? {}), margins } };
}

export function sinMargen(p: PonderacionConfig, varName: string): PonderacionConfig {
  const margins = (p.rake?.margins ?? []).filter((x) => x.var !== varName);
  return { ...p, rake: { ...(p.rake ?? {}), margins } };
}

export function conDiseno(p: PonderacionConfig, patch: Partial<PonderDesign> | null): PonderacionConfig {
  if (patch === null) return { ...p, design: null };
  const next: PonderDesign = { ...(p.design ?? {}), ...patch };
  // Una clave puesta a undefined se quita: el JSON guardado no la arrastra.
  (Object.keys(next) as (keyof PonderDesign)[]).forEach((k) => next[k] === undefined && delete next[k]);
  return { ...p, design: next };
}

export function conOpcionesRake(
  p: PonderacionConfig, patch: Partial<Omit<PonderRake, "margins">>,
): PonderacionConfig {
  const rake: PonderRake = { ...(p.rake ?? { margins: [] }), ...patch };
  (Object.keys(rake) as (keyof PonderRake)[]).forEach((k) => rake[k] === undefined && delete rake[k]);
  return { ...p, rake };
}

export function conRecorte(p: PonderacionConfig, patch: Partial<PonderTrim> | null): PonderacionConfig {
  if (patch === null) return { ...p, trim: null };
  const trim = { ...(p.trim ?? {}), ...patch } as PonderTrim;
  return { ...p, trim };
}

export type OrigenPesoBase = "ninguno" | "columna" | "estrato";

/** Cómo se arma el peso base que el raking calibra. */
export function origenPesoBase(p: PonderacionConfig): OrigenPesoBase {
  const d = p.design;
  if (!d) return "ninguno";
  // La clave presente (aun vacía, antes de elegir la columna) declara el origen.
  if (d.peso_columna !== undefined) return "columna";
  return "estrato";
}

/** Cambiar de origen: sólo el elegido queda vigente en el diseño. */
export function conOrigenPesoBase(
  p: PonderacionConfig, origen: OrigenPesoBase, columna = "",
): PonderacionConfig {
  if (origen === "ninguno") return { ...p, design: null };
  if (origen === "columna") return { ...p, design: { peso_columna: columna } };
  return { ...p, design: { var: p.design?.var ?? "", pop_sizes: p.design?.pop_sizes ?? {} } };
}

// ---- Hidratación ------------------------------------------------------------
// La config vuelve del backend pasada por R: `null` llega como `{}` (y un
// arreglo de largo 1 podría llegar como escalar). Sin normalizar, `design: {}`
// se leía como «reequilibrio por estrato», `total_poblacion: {}` se pintaba
// «[object Object]» y el grupo de edad abierto («65 a más») perdía su `null`.

const esObjetoVacio = (x: unknown) =>
  x != null && typeof x === "object" && !Array.isArray(x) && Object.keys(x as object).length === 0;
const nulo = <T,>(x: T): T | null => (x == null || esObjetoVacio(x) ? null : x);
const arreglo = (x: unknown): string[] =>
  (Array.isArray(x) ? x : x == null || esObjetoVacio(x) ? [] : [x]).map(String).filter(Boolean);
const numero = (x: unknown): number | null => {
  const v = Array.isArray(x) ? x[0] : x;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

export function normalizarPonderacion(raw: unknown): PonderacionConfig {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<PonderacionConfig>;
  const rake = (p.rake && typeof p.rake === "object" ? p.rake : { margins: [] }) as PonderRake;
  const margins = (Array.isArray(rake.margins) ? rake.margins : []).map((m) => {
    const f = nulo(m.fuente ?? null);
    const fuente = f
      ? { ...f, mapeo: Object.fromEntries(Object.entries(f.mapeo ?? {}).map(([k, v]) => [k, arreglo(v)])) }
      : null;
    return { ...m, targets: esObjetoVacio(m.targets) ? {} : m.targets ?? {}, ...(fuente ? { fuente } : {}) };
  });
  const out: PonderacionConfig = { ...p, enabled: !!p.enabled, rake: { ...rake, margins } } as PonderacionConfig;
  const design = nulo(p.design ?? null);
  out.design = design;
  out.trim = nulo(p.trim ?? null);
  if ("total_poblacion" in p) out.total_poblacion = numero(p.total_poblacion);
  if (rake.codigos_faltantes !== undefined) out.rake.codigos_faltantes = arreglo(rake.codigos_faltantes);
  if (rake.imputacion !== undefined && esObjetoVacio(rake.imputacion)) delete out.rake.imputacion;
  if (p.poblacion !== "territorio" && p.poblacion !== "marco") delete out.poblacion;
  const metas = nulo(p.metas_cpv2025 ?? null);
  out.metas_cpv2025 = metas
    ? {
        ...metas,
        distritos: arreglo(metas.distritos),
        provincias: arreglo(metas.provincias),
        grupos_edad: (Array.isArray(metas.grupos_edad) ? metas.grupos_edad : []).map((g) => ({
          etiqueta: typeof g.etiqueta === "string" ? g.etiqueta : "",
          min: numero(g.min) ?? 0,
          max: numero(g.max),
        })),
      }
    : null;
  return out;
}
