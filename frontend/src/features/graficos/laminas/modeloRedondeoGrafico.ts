// Redondeo propio de un gráfico (R4 del rediseño, 2026-10-15). El motor gobierna método y decimales desde la regla del
// informe y quita esos campos del override de la lámina (`.calculos_sanear_overrides`, graficos_calculos_gobernados.R);
// la excepción es explícita: `overrides.calculos_propios = true` conserva los suyos. Sin la marca, un valor viejo que
// quedó en el plan sigue sin efecto. Puro: lee y arma el `overrides` del gráfico.

import { METODO_ESTANDAR, METODO_REPARTO, acotarDecimales, type FilaCalculo } from "../estiloInforme/modeloEstiloInforme";

export const ARG_CALCULOS_PROPIOS = "calculos_propios";
const CAMPOS = ["metodo_redondeo", "decimales", "decimales_pct", "valores_decimales"] as const;

type Args = Record<string, unknown>;
const overridesDe = (args: Args): Args =>
  args.overrides && typeof args.overrides === "object" && !Array.isArray(args.overrides) ? (args.overrides as Args) : {};

export type RedondeoGrafico = { propio: boolean; metodo: string; decimales: number };

/** Lo que el gráfico usa: el suyo si lo marcó como propio; si no, el de su tipo (que a su vez sigue al informe). */
export function leerRedondeo(args: Args, fila: FilaCalculo): RedondeoGrafico {
  const ov = overridesDe(args);
  const propio = ov[ARG_CALCULOS_PROPIOS] === true;
  const metodo = propio && fila.admiteMetodo && typeof ov.metodo_redondeo === "string" ? ov.metodo_redondeo : fila.metodo;
  const decimales = propio && fila.campoDecimales && ov[fila.campoDecimales] !== undefined ? acotarDecimales(ov[fila.campoDecimales]) : fila.decimales;
  return { propio, metodo, decimales };
}

/** El `overrides` con el redondeo propio puesto (parte de lo que el gráfico usa hoy). */
export function conRedondeo(args: Args, fila: FilaCalculo, cambio: Partial<Pick<RedondeoGrafico, "metodo" | "decimales">>): Args {
  const actual = leerRedondeo(args, fila);
  const ov: Args = { ...overridesDe(args), [ARG_CALCULOS_PROPIOS]: true };
  if (fila.admiteMetodo) ov.metodo_redondeo = cambio.metodo ?? actual.metodo;
  if (fila.campoDecimales) ov[fila.campoDecimales] = cambio.decimales ?? actual.decimales;
  return ov;
}

/** «Como el informe»: sin la marca ni los campos gobernados. */
export function sinRedondeo(args: Args): Args {
  const ov = { ...overridesDe(args) };
  delete ov[ARG_CALCULOS_PROPIOS];
  for (const c of CAMPOS) delete ov[c];
  return ov;
}

/** La excepción dicha para la lista bajo la regla: «Reparto a 100 % · Un decimal»; `null` si sigue al informe. */
export function describirRedondeo(args: Args, fila: FilaCalculo): string | null {
  const r = leerRedondeo(args, fila);
  if (!r.propio) return null;
  const partes: string[] = [];
  if (fila.admiteMetodo) partes.push(r.metodo === METODO_REPARTO ? "Reparto a 100 %" : "Estándar");
  if (fila.campoDecimales) partes.push(r.decimales === 0 ? "Sin decimales" : r.decimales === 1 ? "Un decimal" : `${r.decimales} decimales`);
  return partes.join(", ") || null;
}

export { METODO_ESTANDAR, METODO_REPARTO };
