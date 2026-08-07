// Visibilidad de args según el modo elegido.
//
// Un graficador con modos declara los campos de TODOS sus modos, porque el
// registro describe la función R entera. Sin filtrar, el analista que eligió
// «Entre públicos» seguía viendo «Variable (modo Select múltiple)» y «Variables
// (modo Cajas/cortes)» — dos juegos de campos que ese modo nunca lee. La
// etiqueta hacía de aviso justamente porque el panel no sabía esconderlos.
//
// El backend declara la dependencia (`depende: {arg, valores}`) y aquí se
// evalúa contra el payload del slide. Es genérico: hoy el arg de control es
// siempre `modo`, pero nada en esta función lo asume.

import type { ArgMetadata } from "../../api/client";

export type ArgDependencia = { arg: string; valores: string[] };

function leerDependencia(meta: ArgMetadata): ArgDependencia | null {
  const dep = (meta as { depende?: unknown }).depende;
  if (!dep || typeof dep !== "object") return null;
  const { arg, valores } = dep as { arg?: unknown; valores?: unknown };
  if (typeof arg !== "string" || !arg) return null;
  // `valores` llega de R como lista y jsonlite puede serializar un solo
  // elemento como escalar; se acepta cualquiera de las dos formas.
  const lista = Array.isArray(valores) ? valores : [valores];
  const limpios = lista.filter((v): v is string => typeof v === "string" && v.length > 0);
  return limpios.length ? { arg, valores: limpios } : null;
}

/** ¿Este arg aplica al modo actualmente elegido? */
export function argAplica(meta: ArgMetadata, values: Record<string, unknown>): boolean {
  const dep = leerDependencia(meta);
  if (!dep) return true;
  const actual = values[dep.arg];
  // Mientras no se haya elegido nada no se esconde: un panel vacío al abrir un
  // graficador nuevo se lee como roto, y el modo es lo primero que se toca.
  if (actual === undefined || actual === null || actual === "") return true;
  const texto = Array.isArray(actual) ? String(actual[0] ?? "") : String(actual);
  return dep.valores.includes(texto);
}

/** Filtra una lista de args a los que aplican al modo elegido. */
export function argsQueAplican(
  args: ArgMetadata[],
  values: Record<string, unknown>,
): ArgMetadata[] {
  return args.filter((meta) => argAplica(meta, values));
}
