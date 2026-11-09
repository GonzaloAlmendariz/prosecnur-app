// Versiones de un tipo de gráfico (ADR 0139, enmienda 2026-11-09): una variante del catálogo no es una tarjeta aparte
// en «Tipo de gráfico», es una versión dentro de la tarjeta de su tipo. La tarjeta ofrece la base y cada variante con un
// control segmentado. El id de una versión es el de su entrada del catálogo: el graficador (la base) o el id de la
// variante, el mismo que devuelve `entradaDeGrafico` para un gráfico guardado. Los nombres salen del catálogo. Módulo puro.

import type { GraficadorRef } from "../../../../api/graficos";
import type { VarianteGraficoCatalogo } from "../../iconos/catalogoTipos.generated";
import {
  aplicarVariante, graficadorDeEntrada, nombreVersion, nombreVersionBase, varianteDeGrafico, varianteGrafico, variantesDeGraficador,
} from "../../catalogoGraficos";
import { ARGS_VERSION_CATEGORIAS } from "../coberturaCategorias/modeloUniversoCategorias";

export type VersionGrafico = {
  /** El graficador (la versión base) o el id de la variante. */
  id: string;
  nombre: string;
  variante: VarianteGraficoCatalogo | null;
};

/** Las versiones del tipo: la base y cada variante, en el orden del catálogo. Sin variantes, ninguna (no hay control). */
export function versionesDeTipo(graficador: string): VersionGrafico[] {
  const variantes = variantesDeGraficador(graficador);
  if (!variantes.length) return [];
  return [
    { id: graficador, nombre: nombreVersionBase(graficador), variante: null },
    ...variantes.map((v) => ({ id: v.id, nombre: nombreVersion(v), variante: v })),
  ];
}

/** ¿La versión (o entrada) pertenece a la tarjeta del tipo? */
export const esVersionDe = (version: string | null | undefined, graficador: string): boolean =>
  !!version && graficadorDeEntrada(version) === graficador;

/**
 * La versión que la tarjeta muestra elegida en su control: la que el analista eligió si la tarjeta es la candidata; si
 * no, la actual de la ranura cuando la tarjeta es su tipo; si no, la base.
 */
export function versionMostrada(graficador: string, candidata: string | null, actual: string | null): string {
  if (esVersionDe(candidata, graficador) && candidata) return candidata;
  if (esVersionDe(actual, graficador) && actual) return actual;
  return graficador;
}

/** Lo que una variante escribe y su base no lee. Sin entrada: el estilo y la regla del resumen (ADR 0139). */
const PROPIOS_DE_LA_VARIANTE: Readonly<Record<string, readonly string[]>> = {
  // ADR 0140: la cobertura por categorías; volver a "Por públicos" quita su versión, su variable, su universo y su tolerancia.
  p_cobertura: ARGS_VERSION_CATEGORIAS,
};
const PROPIOS_POR_DEFECTO = ["estilo", "regla"] as const;

/**
 * El gráfico que queda en la ranura al usar una versión, sobre `base` (el graficador con los args compatibles del
 * anterior; `anterior` es el gráfico original de la ranura, sin filtrar). Una variante escribe sus args fijos y borra los que quita. La base, desde una variante del mismo
 * graficador, deja de ser variante: se borran los args propios de la variante (el estilo y la regla del resumen; en la
 * cobertura, los de la versión por categorías) y el motor vuelve a su versión por defecto.
 */
export function graficoDeVersion(version: string, base: GraficadorRef, anterior: GraficadorRef | null = null): GraficadorRef {
  const args = base.args ?? {};
  const variante = varianteGrafico(version);
  if (variante) return { graficador: base.graficador, args: aplicarVariante(args, variante) };
  // Ronda 19 (F1): la variante se reconoce en el gráfico ORIGINAL. `compatibleGraficadorRef` filtra con el registro, que
  // no declara `modo` en la cobertura: sobre `base` la versión por categorías ya no se veía y sus args se quedaban.
  const desde = anterior && anterior.graficador === base.graficador ? anterior.args ?? {} : args;
  if (!varianteDeGrafico(base.graficador, desde) && !varianteDeGrafico(base.graficador, args)) return base;
  const sinVariante: Record<string, unknown> = { ...args };
  for (const k of PROPIOS_DE_LA_VARIANTE[base.graficador] ?? PROPIOS_POR_DEFECTO) delete sinVariante[k];
  return { graficador: base.graficador, args: sinVariante };
}
