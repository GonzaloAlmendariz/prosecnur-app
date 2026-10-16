// El resumen de «Nueva versión» de las respuestas: qué cambió en casos y en
// columnas, y qué falta hacer. Sin cambios, se dice; una columna nueva invita a
// declararla en Variables de la base, y menos casos recuerda que, si la versión
// marca qué casos cuentan, eso se declara en Validación.

import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import type { CambiosDeRespuestas } from "../../../api/estudio";

function listaCorta(xs: readonly string[], max = 4): string {
  const vistos = xs.slice(0, max).map((x) => `«${x}»`).join(", ");
  return xs.length > max ? `${vistos} y ${formatoConteo(xs.length - max)} más` : vistos;
}

export function resumenCambiosDeRespuestas(c: CambiosDeRespuestas): string[] {
  const { antes, despues, clave, nuevos, ya_no_vienen } = c.casos;
  const lineas: string[] = [];
  lineas.push(antes === despues
    ? `Sigue con ${formatoConteoDe(despues, "respuesta")}.`
    : `Pasó de ${formatoConteo(antes)} a ${formatoConteoDe(despues, "respuesta")}.`);
  if (clave && (nuevos || ya_no_vienen)) {
    const partes = [
      nuevos ? `${formatoConteoDe(nuevos, "caso nuevo", "casos nuevos")}` : "",
      ya_no_vienen ? `${formatoConteoDe(ya_no_vienen, "caso que ya no viene", "casos que ya no vienen")}` : "",
    ].filter(Boolean);
    lineas.push(`Por ${clave}: ${partes.join(" y ")}.`);
  }
  if (c.columnas_nuevas.length) {
    const una = c.columnas_nuevas.length === 1;
    lineas.push(`${una ? "Columna nueva" : "Columnas nuevas"}: ${listaCorta(c.columnas_nuevas)}. ${una ? "Declárala" : "Decláralas"} en Variables para usarla${una ? "" : "s"} en el análisis.`);
  }
  if (c.columnas_que_no_vienen.length) {
    lineas.push(`${c.columnas_que_no_vienen.length === 1 ? "Ya no viene" : "Ya no vienen"}: ${listaCorta(c.columnas_que_no_vienen)}.`);
  }
  lineas.push("Si la base tenía codificación, vuelve a aplicarla para que llegue a las respuestas nuevas.");
  return lineas;
}
