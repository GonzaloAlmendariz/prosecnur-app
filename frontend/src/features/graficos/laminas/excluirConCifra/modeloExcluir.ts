// Excluir respuestas con su cifra (oleada I2, ítem 1), sin React. Tres variantes del mismo gráfico van en un lote:
//   - «actual»: los args tal cual (el % de cada ficha que sigue en el gráfico, sobre la base nueva);
//   - «sin»: sin ninguna exclusión (la base de antes y el % que tendría cada ficha excluida);
//   - «sondeo»: con la ficha bajo el cursor alternada (el efecto antes de marcarla).
// El efecto se dice con la categoría más alta que queda: «Sin "No sabe": Sí 58% → 63%». Si el gráfico no tiene una fila
// que lo resuma (varias barras sin total), se dice con la base.

import type { DetalleCifras } from "../../../../api/graficosCifras";
import { antesDespues, mayorDe, pctDe, textoBase, claveEnDetalle } from "../cifrasInspector/modeloCifras";
import type { VarianteDetalle } from "../cifrasInspector/useDetalleCifras";
import { trasPulsar } from "../modeloSelectorCategorias";

type Args = Readonly<Record<string, unknown>>;

export const ACTUAL = "actual";
export const SIN = "sin";
export const SONDEO = "sondeo";

export function variantesExcluir(
  args: Args, argName: string, elegidos: readonly string[], sondeo: string | null, claves: readonly string[],
): VarianteDetalle[] {
  const out: VarianteDetalle[] = [{ clave: ACTUAL, args }];
  if (elegidos.length) out.push({ clave: SIN, args: { ...args, [argName]: [] } });
  if (sondeo && claves.includes(sondeo)) {
    out.push({ clave: SONDEO, args: { ...args, [argName]: trasPulsar(sondeo, new Set(elegidos), claves, "excluir") } });
  }
  return out;
}

/** La línea del efecto de alternar la ficha sondeada; null si falta alguno de los dos detalles. */
export function efectoSondeo(
  actual: DetalleCifras | null, sondeado: DetalleCifras | null, rotulo: string, yaExcluida: boolean,
): string | null {
  if (!actual || !sondeado) return null;
  const que = `${yaExcluida ? "Con" : "Sin"} "${rotulo}"`;
  // La más alta de lo que queda en el gráfico SIN la sondeada (la que se compara antes y después).
  const conElla = yaExcluida ? sondeado : actual;
  const sinElla = yaExcluida ? actual : sondeado;
  const mayor = mayorDe(sinElla, claveEnDetalle(conElla, [rotulo]));
  if (mayor) {
    const cambio = antesDespues(pctDe(actual, [mayor.clave]), pctDe(sondeado, [mayor.clave]));
    if (cambio) return `${que}: ${mayor.clave} ${cambio}`;
  }
  const base = textoBase(actual, sondeado);
  return base ? `${que}: ${base}` : null;
}
