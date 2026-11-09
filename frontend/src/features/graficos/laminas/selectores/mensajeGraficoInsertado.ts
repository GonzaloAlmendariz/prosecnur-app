// El aviso al poner un gráfico en una ranura (ronda 18). Antes decía «Gráfico: Multiapilada divergente: Con columna de Sin
// información», con dos veces dos puntos. Ronda 19 (O3): el tipo y su versión se nombran con el mismo helper que el
// selector, la maqueta y el inspector (`nombreConVersion`: «<tipo>, versión <versión>»). Módulo puro.

import type { VarianteGraficoCatalogo } from "../../iconos/catalogoTipos.generated";
import { nombreConVersion } from "../../catalogoGraficos";

/**
 * «Gráfico insertado: <tipo>» o, con versión, «Gráfico insertado: <tipo>, versión <versión>». En una lámina de varios
 * gráficos dice dónde: «Gráfico insertado en el espacio "Derecha": …». `ranura` es el rótulo del espacio (vacío con uno solo).
 */
export function mensajeGraficoInsertado(nombreTipo: string, variante: VarianteGraficoCatalogo | null, ranura = ""): string {
  const donde = ranura ? ` en el ${ranura}` : "";
  return `Gráfico insertado${donde}: ${variante ? nombreConVersion(variante, nombreTipo) : nombreTipo}`;
}
