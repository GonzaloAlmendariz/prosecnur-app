import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colchonPorFacultad } from "./consumoDeCadena";

/**
 * De dónde se saca lo que a un aula le faltó.
 *
 * **La cuota es por facultad**, así que la pregunta no es cuántas reservas
 * quedan en el operativo sino cuántas quedan en la facultad de esa aula: veinte
 * reservas libres no sirven de nada si la facultad que perdió el aula tiene
 * cero.
 *
 * Reusa `colchonPorFacultad()` —el mismo cálculo que pinta el panel del
 * colchón— en vez de contar reservas por su cuenta. Dos cuentas de lo mismo se
 * separan en cuanto una cambia, y aquí se separarían en la peor forma posible:
 * la ficha diría que hay de dónde sacar y el panel de al lado que no.
 *
 * **El banco de extras se queda fuera a propósito.** Tiene su propio panel con
 * su tasa observada y su banda; repetir aquí una versión sin banda daría una
 * cifra más optimista y sin su incertidumbre.
 */

export type DondeSeSaca = {
  facultad: string;
  /** Reservas de esa facultad que siguen sin usarse. */
  reservasLibres: number;
  /** Cadenas de esa facultad que ya gastaron todas sus reservas. */
  cadenasAgotadas: number;
  /** Cadenas que nunca tuvieron reserva: no las gastó el campo. */
  cadenasSinColchon: number;
  /** La facultad no aparece en el plan. */
  conocida: boolean;
};

export function dondeSeSaca(
  facultad: string,
  agenda: ReadonlyArray<MonitoreoAulasPlanRow>,
): DondeSeSaca {
  const limpia = facultad.trim();
  const vacio: DondeSeSaca = {
    facultad: limpia,
    reservasLibres: 0,
    cadenasAgotadas: 0,
    cadenasSinColchon: 0,
    conocida: false,
  };
  if (!limpia) return vacio;

  const suya = colchonPorFacultad(agenda).find(
    (f) => f.facultad.trim().toLowerCase() === limpia.toLowerCase(),
  );
  if (!suya) return vacio;

  return {
    facultad: suya.facultad,
    reservasLibres: suya.libres,
    cadenasAgotadas: suya.agotadas,
    cadenasSinColchon: suya.nuncaTuvo,
    conocida: true,
  };
}
