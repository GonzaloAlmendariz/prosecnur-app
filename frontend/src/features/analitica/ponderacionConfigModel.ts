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
  if ((d.peso_columna ?? "").trim()) return "columna";
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
