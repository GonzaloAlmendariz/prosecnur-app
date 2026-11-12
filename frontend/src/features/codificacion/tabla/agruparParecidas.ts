// "Agrupar parecidas" de la tabla de Codificar (prototipo, vista de tabla; plan 5.3: "Juntar a ojo los
// textos parecidos" pasa a "Agrupar parecidas los junta en una fila y los lista debajo"). Puro.
//
// Usa la misma medida que "Parecidas" de la tarjeta de un código (`parecido`, distancia de edición sobre
// el texto normalizado), con un umbral alto: junta variantes de escritura ("iglesia catolica" e "iglesia
// catolicas"), no textos que tratan de lo mismo con otras palabras ("Colas largas" y "Menos colas en
// ventanilla", el ejemplo del prototipo). Ese segundo agrupado, por sentido, no lo da esta medida: es un
// pedido al motor.
//
// Reglas: la fila que queda es la primera en el orden de la tabla; solo se juntan filas con los mismos
// códigos (la celda dice la verdad de todas) y del mismo tramo (una no respuesta no se mezcla con una
// respuesta). Con muchas filas no se agrupa: comparar todas contra todas no cabe en un pintado.

import { parecido } from "../codificar/modeloDeCodificar";
import type { FilaTabla, MiembroDeFila } from "./tablaCodificarModelo";

/** Parecido mínimo para juntar dos textos en una fila: solo variantes de escritura. */
export const PARECIDO_PARA_AGRUPAR = 0.85;
/** Con más filas que esto la tabla no agrupa. */
export const FILAS_MAXIMAS_PARA_AGRUPAR = 1500;

const firmaDeCodigos = (f: FilaTabla) => f.codigos.map((c) => c.id).sort().join("|");

export function agruparParecidas(filas: readonly FilaTabla[], umbral = PARECIDO_PARA_AGRUPAR): FilaTabla[] {
  if (filas.length > FILAS_MAXIMAS_PARA_AGRUPAR) return [...filas];
  const usadas = new Set<number>();
  const salida: FilaTabla[] = [];
  let cambio = false;
  for (let i = 0; i < filas.length; i += 1) {
    if (usadas.has(i)) continue;
    const base = filas[i];
    const firma = firmaDeCodigos(base);
    const miembros: MiembroDeFila[] = [];
    for (let j = i + 1; j < filas.length; j += 1) {
      if (usadas.has(j)) continue;
      const otra = filas[j];
      if (otra.noResponde !== base.noResponde || firmaDeCodigos(otra) !== firma) continue;
      const largo = Math.max(base.clave.length, otra.clave.length);
      // Un parecido de 0.85 no admite más diferencia de largo que el 15 %: se descarta sin medir.
      if (largo > 0 && Math.abs(base.clave.length - otra.clave.length) / largo > 1 - umbral) continue;
      if (parecido(base.clave, otra.clave) < umbral) continue;
      usadas.add(j);
      miembros.push({ clave: otra.clave, texto: otra.texto, titulo: otra.titulo, veces: otra.veces });
    }
    if (miembros.length === 0) {
      salida.push(base);
      continue;
    }
    cambio = true;
    salida.push({ ...base, veces: base.veces + miembros.reduce((s, m) => s + m.veces, 0), miembros });
  }
  return cambio ? salida : [...filas];
}

/** Las claves que representa una fila: la suya y las de las parecidas que junta. */
export function clavesDeFila(fila: Pick<FilaTabla, "clave" | "miembros">): string[] {
  return [fila.clave, ...(fila.miembros ?? []).map((m) => m.clave)];
}
