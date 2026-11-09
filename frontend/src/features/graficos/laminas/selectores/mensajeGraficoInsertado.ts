// El aviso al poner un gráfico en una ranura (ronda 18). Antes decía «Gráfico: Multiapilada divergente: Con columna de Sin
// información», con dos veces dos puntos: el tipo y su versión van separados por coma, y la versión en minúscula como
// continuación de la frase. Módulo puro.

import type { VarianteGraficoCatalogo } from "../../iconos/catalogoTipos.generated";
import { nombreVersion } from "../../catalogoGraficos";

/** La primera letra en minúscula, salvo que abra una sigla («TC», «PUCP»). */
function continuacion(texto: string): string {
  const t = texto.trim();
  if (t.length > 1 && t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase()) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/**
 * «Gráfico insertado: <tipo>» o, con versión, «Gráfico insertado: <tipo>, <versión>». En una lámina de varios gráficos
 * dice dónde: «Gráfico insertado en el espacio "Derecha": …». `ranura` es el rótulo del espacio (vacío con uno solo).
 */
export function mensajeGraficoInsertado(nombreTipo: string, variante: VarianteGraficoCatalogo | null, ranura = ""): string {
  const donde = ranura ? ` en el ${ranura}` : "";
  const version = variante ? `, ${continuacion(nombreVersion(variante))}` : "";
  return `Gráfico insertado${donde}: ${nombreTipo}${version}`;
}
