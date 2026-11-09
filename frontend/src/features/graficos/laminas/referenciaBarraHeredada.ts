// Ronda 21: «Pista gris hasta el 100%» (`pista_barras`, v7.11) y «Referencia de las barras» (`referencia_barra`, B8)
// salían juntos en la tarjeta de las barras agrupadas y categóricas, y el motor hace caso al segundo
// (lamina_barras_pista.R, `.lam_barras_pista_activa`). Un solo camino: donde el tipo ofrece `referencia_barra`, el mando
// viejo no sale; lo que el analista guardó en él se lee en el segmentado nuevo y la tarjeta escribe sólo
// `referencia_barra`. El valor viejo no se borra al editar: con `referencia_barra` declarado ya no rige. Módulo puro.
import { valorDeMando } from "./mandosPorOverrides";

type Args = Readonly<Record<string, unknown>>;

/** Lo que `pista_barras` guardado dice en el vocabulario de `referencia_barra`; «auto» o vacío, nada (lo del gráfico). */
export function referenciaDePista(pista: unknown): "pista" | "eje" | undefined {
  if (pista === true || pista === "siempre") return "pista";
  if (pista === false || pista === "nunca") return "eje";
  return undefined;
}

/** Sin el mando viejo cuando el tipo ofrece el nuevo. */
export function sinPistaDuplicada<T extends { arg: { name: string } }>(campos: readonly T[]): T[] {
  if (!campos.some((c) => c.arg.name === "referencia_barra")) return [...campos];
  return campos.filter((c) => c.arg.name !== "pista_barras");
}

/**
 * Lo que la tarjeta muestra en «Referencia de las barras»: lo declarado (con `overrides` mandando, como el motor) o, si no
 * hay, lo que dice `pista_barras` guardado.
 */
export function referenciaQueRige(args: Args, graficador?: string): unknown {
  const declarada = valorDeMando(args, "referencia_barra", graficador);
  if (declarada !== undefined && declarada !== null && declarada !== "") return declarada;
  return referenciaDePista(valorDeMando(args, "pista_barras", graficador)) ?? declarada;
}

/**
 * El parche de un cambio en «Referencia de las barras». Siempre `referencia_barra`. Sólo al volver a «Como el gráfico»
 * sobre un `pista_barras` que se lee como pista o eje se borra también el viejo: si no, el segmentado volvería a marcar
 * lo de antes y el clic no tendría efecto.
 */
export function parcheDeReferencia(args: Args, valor: unknown, graficador?: string): Record<string, unknown> {
  const vacio = valor === null || valor === undefined || valor === "";
  if (vacio && referenciaDePista(valorDeMando(args, "pista_barras", graficador))) return { referencia_barra: null, pista_barras: null };
  return { referencia_barra: valor };
}
