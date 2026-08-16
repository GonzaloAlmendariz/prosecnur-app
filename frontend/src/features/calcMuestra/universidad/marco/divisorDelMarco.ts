/**
 * El divisor de cada facultad sale del marco, no de una constante.
 *
 * Para saber cuántas aulas hay que visitar en una facultad hace falta dividir su
 * cuota entre los alumnos que caben en un curso-horario. Ese divisor lo mide el
 * perfil del marco por facultad —mediana y media—, y el motor R lo consume por
 * `promedio_conglomerado` y `mediana_conglomerado`.
 *
 * Hasta ahora sólo llegaba la media, y venía de un mapa de referencia con los
 * valores del estudio de 2025. Mientras el marco fuera el de 2025 daba lo
 * correcto; con otro marco el motor seguiría dividiendo por los tamaños del año
 * pasado y nadie lo notaría, porque la cifra no depende de los datos cargados.
 *
 * La mediana no llegaba en absoluto: `mediana_conglomerado` ni siquiera estaba
 * declarada en el tipo del estrato. Por eso `min_media_mediana` —la regla que
 * usó el diseño de 2025, «mínimo entre mediana y media»— no podía dispararse:
 * el motor la recibe, ve la mediana en 0 y degrada a la media sin decirlo.
 *
 * Este módulo hace una sola cosa: refrescar los dos divisores de cada estrato
 * con lo que el marco mide hoy.
 */

import type { CalcMuestraEstrato } from "../../../../api/calcMuestra";
import type { FacultadDatos } from "../../dominio";
import { slugFacultad } from "./facultadDecisionModel";

/** Un número sirve como divisor sólo si es finito y positivo: con 0 no se divide. */
function divisorUtil(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Devuelve los estratos con `promedio_conglomerado` y `mediana_conglomerado`
 * tomados del marco, emparejando por el slug de la etiqueta.
 *
 * Lo que NO hace, y es deliberado: **no borra un divisor que ya existe**. Una
 * facultad que el perfil no conoce —o que el perfil conoce sin tamaños, como las
 * que no tienen ningún curso-horario elegible— conserva el valor que traía. Es
 * la diferencia entre «el marco dice otra cosa» y «el marco no dice nada», y
 * pisar con null convertiría lo segundo en una división por cero.
 */
export function conDivisorDelMarco(
  estratos: CalcMuestraEstrato[],
  facultades: FacultadDatos[],
): CalcMuestraEstrato[] {
  if (!estratos.length || !facultades.length) return estratos;
  const porFacultad = new Map<string, FacultadDatos>();
  for (const facultad of facultades) {
    const clave = slugFacultad(facultad.nombre ?? "");
    if (clave) porFacultad.set(clave, facultad);
  }
  if (!porFacultad.size) return estratos;

  return estratos.map((estrato) => {
    const medido = porFacultad.get(slugFacultad(estrato.label ?? ""));
    if (!medido) return estrato;
    const media = divisorUtil(medido.estAulaMedia) ? medido.estAulaMedia : null;
    const mediana = divisorUtil(medido.estAulaMediana) ? medido.estAulaMediana : null;
    if (media == null && mediana == null) return estrato;
    return {
      ...estrato,
      ...(media == null ? {} : { promedio_conglomerado: media }),
      ...(mediana == null ? {} : { mediana_conglomerado: mediana }),
    };
  });
}
