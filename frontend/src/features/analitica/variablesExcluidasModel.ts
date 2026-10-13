// Modelo puro de «Variables excluidas» de Analítica (U5 del checklist
// entregables-hsyvbg-2026-10-13).
//
// `config.variables_excluidas` es la lista de variables que no salen en ningún
// entregable de Analítica. Se guarda en la config de Analítica, que el backend
// scopea por base cuando las bases no comparten instrumento (ADR 0061) y deja
// global cuando las comparten. Este módulo decide, sin React:
//
// - cuántas variables quedan incluidas y cuántas excluidas —sobre la lista de la
//   config, no sobre las columnas presentes: una variable excluida puede no estar
//   en los datos (la retiró una base preparada fuera, ADR 0100) y aun así cuenta;
// - qué motivo tiene cada exclusión cuando el backend lo sabe (la declaración
//   de origen externo de Carga) y ninguno cuando no lo sabe;
// - qué filas muestra el panel según el buscador.

import type {
  OrigenExterno,
  OrigenExternoMotivoVariable,
} from "../../api/cargaOrigenExterno";

/** Una variable elegible: su nombre en la base y su etiqueta, si la hay. */
export type VariableElegible = {
  name: string;
  label?: string | null;
};

/** Por qué una variable está excluida, cuando el backend lo declara. */
export type MotivoExclusion = {
  motivo: OrigenExternoMotivoVariable;
  /** Base cuya declaración de origen la retiró. */
  base: string;
};

export const ROTULO_MOTIVO_EXCLUSION: Record<OrigenExternoMotivoVariable, string> = {
  metadato: "Metadato del formulario",
  no_va_al_cliente: "No va al cliente",
  otra: "No viene en la base",
};

export type FilaExcluida = {
  name: string;
  label: string;
  motivo: MotivoExclusion | null;
  /** `false` si la variable no está entre las columnas de la base. */
  enLosDatos: boolean;
};

export type ConteoExclusion = {
  incluidas: number;
  excluidas: number;
};

/**
 * Incluidas: las variables de la base que no están en la lista. Excluidas: toda
 * la lista, estén o no en la base. Antes se calculaban las dos sobre las
 * columnas presentes y una exclusión de una variable ausente desaparecía del
 * conteo («265/265 incluidas» con 2 excluidas).
 */
export function conteoExclusion(
  variables: readonly VariableElegible[],
  excluidas: readonly string[],
): ConteoExclusion {
  const set = new Set(excluidas);
  return {
    incluidas: variables.filter((v) => !set.has(v.name)).length,
    excluidas: set.size,
  };
}

export function rotuloIncluidas(n: number): string {
  return `${n} incluida${n === 1 ? "" : "s"}`;
}

export function rotuloExcluidas(n: number): string {
  return `${n} excluida${n === 1 ? "" : "s"}`;
}

/**
 * ¿La config de Analítica es propia de cada base? Espejo de
 * `.analitica_config_es_por_base` del backend (ADR 0061): bases hermanas
 * independientes, o más de una base declarada como separada/independiente.
 */
export function configAnaliticaPorBase({
  modoProcesamiento,
  topologiaDeclarada,
  nBases,
}: {
  modoProcesamiento: string | null | undefined;
  topologiaDeclarada: string | null | undefined;
  nBases: number | null | undefined;
}): boolean {
  if (modoProcesamiento === "independent_siblings") return true;
  const n = Number.isFinite(nBases) ? Number(nBases) : 0;
  return (topologiaDeclarada === "separate" || topologiaDeclarada === "independent") && n > 1;
}

/**
 * Motivo de cada variable según las declaraciones de origen externo leídas.
 * Solo cuenta una declaración con bloque: sin bloque no hay nada declarado. Si
 * dos bases declaran la misma variable, gana la primera en el orden recibido.
 */
export function motivosDesdeOrigen(
  origenes: readonly OrigenExterno[],
): Map<string, MotivoExclusion> {
  const out = new Map<string, MotivoExclusion>();
  for (const origen of origenes) {
    const bloque = origen.bloque;
    if (!bloque) continue;
    for (const retirada of bloque.variables_retiradas) {
      if (!retirada.variable || out.has(retirada.variable)) continue;
      out.set(retirada.variable, { motivo: retirada.motivo, base: origen.base });
    }
  }
  return out;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** El buscador casa por nombre o por etiqueta, sin tildes ni mayúsculas. */
export function coincideBusqueda(variable: VariableElegible, busqueda: string): boolean {
  const q = normalizar(busqueda);
  if (!q) return true;
  return normalizar(variable.name).includes(q) || normalizar(variable.label ?? "").includes(q);
}

/** Las excluidas en el orden en que se excluyeron, con su motivo si se sabe. */
export function filasExcluidas(
  excluidas: readonly string[],
  variables: readonly VariableElegible[],
  motivos: ReadonlyMap<string, MotivoExclusion>,
  busqueda = "",
): FilaExcluida[] {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  const vistas = new Set<string>();
  const filas: FilaExcluida[] = [];
  for (const name of excluidas) {
    if (!name || vistas.has(name)) continue;
    vistas.add(name);
    const variable = porNombre.get(name);
    const label = variable?.label?.trim() ?? "";
    if (!coincideBusqueda({ name, label }, busqueda)) continue;
    filas.push({
      name,
      label,
      motivo: motivos.get(name) ?? null,
      enLosDatos: Boolean(variable),
    });
  }
  return filas;
}

/** Las variables de la base que todavía salen en los entregables. */
export function variablesIncluidas(
  variables: readonly VariableElegible[],
  excluidas: readonly string[],
  busqueda = "",
): VariableElegible[] {
  const set = new Set(excluidas);
  return variables.filter((v) => !set.has(v.name) && coincideBusqueda(v, busqueda));
}

export function sinVariable(excluidas: readonly string[], name: string): string[] {
  return excluidas.filter((v) => v !== name);
}

export function conVariable(excluidas: readonly string[], name: string): string[] {
  return excluidas.includes(name) ? [...excluidas] : [...excluidas, name];
}
