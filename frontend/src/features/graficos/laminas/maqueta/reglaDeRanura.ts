// La firma del conteo de la regla de una ranura de la maqueta (M3): la MISMA que pide el inspector (useConteoRegla con
// los args del gráfico y el alcance del informe), para que ambos compartan el pedido de la caché de módulo.

import type { RanuraMaqueta } from "../modeloMaqueta";
import { firmaPedidoRegla, GRAFICADORES_CON_REGLA, reglaEfectiva } from "../reglaPreguntas/modeloReglaPreguntas";

/** La firma del pedido de conteo; `""` si el gráfico no elige sus preguntas con una regla. */
export function firmaReglaDeRanura(r: Pick<RanuraMaqueta, "graficador" | "args">, scope: "active" | "consolidated"): string {
  if (!r.graficador || !GRAFICADORES_CON_REGLA.has(r.graficador)) return "";
  if (!reglaEfectiva(r.graficador, r.args, r.args.regla)) return "";
  return firmaPedidoRegla(r.graficador, r.args, scope);
}
