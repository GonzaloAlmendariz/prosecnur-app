/**
 * El estadístico que elige el Recorrido tiene que llegarle al motor R.
 *
 * El Recorrido deja elegir con qué resumen del marco se calculan los alumnos
 * por curso-horario (`resumenEstAula`), y su default —`min_mediana_media`— es la
 * regla que usó el diseño de 2025. El motor R tiene el mismo ajuste en
 * `parametros.estadistico_conglomerado`, y su propio comentario dice que es
 * «espejo del `resumenEstAula` del Recorrido». Pero nadie escribía ese
 * parámetro: R se quedaba siempre en su default, `media`, mientras la pantalla
 * mostraba otra cosa.
 *
 * Y no se podía cablear de un pase, porque **los dos nombres están cruzados**:
 *
 *     Recorrido (TS)      min_mediana_media
 *     Motor (R)           min_media_mediana
 *
 * Pasarlo tal cual no rompe nada de forma visible: `calc_enum` no reconoce el
 * valor, cae al default y el motor sigue dividiendo por la media sin decirlo.
 * Ese silencio es la razón de que el módulo exista y de que la traducción sea
 * explícita en vez de una asignación directa.
 */

import type { CalcMuestraParametros } from "../../../../api/calcMuestra";
import type { ResumenEstAula } from "../../dominio";

export type EstadisticoConglomerado = NonNullable<CalcMuestraParametros["estadistico_conglomerado"]>;

/**
 * Traduce el resumen del Recorrido al estadístico del motor.
 *
 * `li_bootstrap` no tiene equivalente: la cota inferior del intervalo bootstrap
 * la calcula el perfil, no el motor de tamaño. Se traduce a `min_media_mediana`
 * porque es exactamente el mismo cálculo al que el Recorrido ya degrada cuando
 * el intervalo no existe —facultades con menos de 15 cursos-horario—, y porque
 * es el más conservador de los tres que R sabe hacer. No es una equivalencia
 * exacta y conviene recordarlo: con intervalo disponible, la pantalla puede
 * mostrar un divisor algo menor que el que usa el motor.
 */
export function estadisticoConglomeradoDe(resumen: ResumenEstAula): EstadisticoConglomerado {
  switch (resumen) {
    case "media":
      return "media";
    case "mediana":
      return "mediana";
    case "min_mediana_media":
    case "li_bootstrap":
      return "min_media_mediana";
  }
}
