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
 * **La reserva adicional se queda fuera a propósito.** Tiene su propio panel
 * con su tasa observada y su banda; repetir aquí una versión sin banda daría
 * una cifra más optimista y sin su incertidumbre.
 */

export type DondeSeSaca = {
  facultad: string;
  /** Reservas de CADENA de esa facultad que siguen sin usarse. */
  reservasLibres: number;
  /**
   * Extras de su reserva adicional que siguen sin usarse, o `null` si el
   * estudio no publica reserva adicional.
   *
   * Va aparte de `reservasLibres` porque son dos recursos con procedimiento
   * distinto -la cadena sigue el orden del sorteo y la reserva adicional se
   * elige-, pero hace falta aquí: sin él, la ficha manda a la reserva
   * adicional sin saber si esa facultad tiene alguna. Medido sobre HSVG 2026:
   * **12 de 15 la tienen vacía**.
   */
  reservaAdicionalLibre: number | null;
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
  /**
   * `banco_extras.por_facultad`. Enumera TODAS las facultades del plan, con
   * cero donde no hay: una que no aparezca es que el estudio no publica
   * reserva adicional, y eso no es lo mismo que tenerla vacía.
   */
  banco: ReadonlyArray<{ faculty?: unknown; disponibles?: unknown }> = [],
): DondeSeSaca {
  const limpia = facultad.trim();
  const vacio: DondeSeSaca = {
    facultad: limpia,
    reservasLibres: 0,
    reservaAdicionalLibre: null,
    cadenasAgotadas: 0,
    cadenasSinColchon: 0,
    conocida: false,
  };
  if (!limpia) return vacio;

  const suyaEnReservaAdicional = banco.find(
    (b) => String(b.faculty ?? "").trim().toLowerCase() === limpia.toLowerCase(),
  );
  const reservaAdicionalLibre = suyaEnReservaAdicional && typeof suyaEnReservaAdicional.disponibles === "number"
    ? suyaEnReservaAdicional.disponibles
    : null;

  const suya = colchonPorFacultad(agenda).find(
    (f) => f.facultad.trim().toLowerCase() === limpia.toLowerCase(),
  );
  if (!suya) return { ...vacio, reservaAdicionalLibre };

  return {
    facultad: suya.facultad,
    reservasLibres: suya.libres,
    reservaAdicionalLibre,
    cadenasAgotadas: suya.agotadas,
    cadenasSinColchon: suya.nuncaTuvo,
    conocida: true,
  };
}
