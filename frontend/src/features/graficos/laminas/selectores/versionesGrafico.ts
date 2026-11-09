// Versiones de un tipo de gráfico (ADR 0139, enmienda 2026-11-09): una variante del catálogo no es una tarjeta aparte
// en «Tipo de gráfico», es una versión dentro de la tarjeta de su tipo. La tarjeta ofrece la base y cada variante con un
// control segmentado. El id de una versión es el de su entrada del catálogo: el graficador (la base) o el id de la
// variante, el mismo que devuelve `entradaDeGrafico` para un gráfico guardado. Los nombres salen del catálogo. Módulo puro.

import type { GraficadorRef } from "../../../../api/graficos";
import type { VarianteGraficoCatalogo } from "../../iconos/catalogoTipos.generated";
import {
  aplicarVariante, graficadorDeEntrada, nombreVersion, nombreVersionBase, varianteDeGrafico, varianteGrafico, variantesDeGraficador,
} from "../../catalogoGraficos";

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

/**
 * El gráfico que queda en la ranura al usar una versión, sobre `base` (el graficador con los args compatibles del
 * anterior). Una variante escribe sus args fijos y borra los que quita. La base, desde una variante del mismo
 * graficador, deja de ser variante: se borran el estilo y la regla del resumen (el motor vuelve a su estilo por defecto).
 */
export function graficoDeVersion(version: string, base: GraficadorRef): GraficadorRef {
  const args = base.args ?? {};
  const variante = varianteGrafico(version);
  if (variante) return { graficador: base.graficador, args: aplicarVariante(args, variante) };
  if (!varianteDeGrafico(base.graficador, args)) return base;
  const sinResumen: Record<string, unknown> = { ...args };
  delete sinResumen.estilo;
  delete sinResumen.regla;
  return { graficador: base.graficador, args: sinResumen };
}
