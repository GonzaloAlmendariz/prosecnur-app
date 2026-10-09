import { fmt } from "./kpisDeAulas";
import type { TonoAviso } from "./avisoLibroImportado";

/**
 * Qué entró al importar el excel de disponibilidad.
 *
 * El aviso contaba TODO lo que devolvía el lector y lo llamaba «celdas
 * ilegibles tomadas como no disponible». Desde que el lector también declara
 * cosas que no son celdas —una persona que sale en dos filas y se fusiona, una
 * fila con horas y sin nombre, una fila que no es un aplicador— ese rótulo
 * prometía un número que no era el suyo: «4 celdas ilegibles» cuando sólo una
 * lo era.
 *
 * Y el texto de cada aviso no se enseñaba nunca. Eso es lo que importa: dicen
 * la FILA del excel («sale en las filas 3 y 9»), que es lo único que permite
 * ir a arreglarlo. Un contador sin los textos deja al coordinador sabiendo que
 * hay algo mal y sin poder tocarlo.
 *
 * El lector los emite ordenados —primero los de fila, que cambian quién está
 * en el operativo; después los de celda, que son matices de una franja—, así
 * que enseñar los primeros enseña los que piden actuar. Aquí no se clasifica
 * nada: un reconocedor por texto se apagaría en cuanto alguien reescriba una
 * frase, y lo haría en verde.
 */

/** Cuántos avisos se enseñan enteros antes de pasar a contarlos. */
export const AVISOS_VISIBLES = 4;

export function avisoDisponibilidadImportada(res: {
  aplicadores: number;
  avisos?: string[] | null;
}): { texto: string; tono: TonoAviso } {
  const avisos = (res.avisos ?? []).filter((a) => typeof a === "string" && a.trim().length > 0);
  const cuantos = res.aplicadores;
  const cabeza = `Disponibilidad importada: ${fmt(cuantos)} ${cuantos === 1 ? "aplicador" : "aplicadores"}`;

  if (cuantos === 0) {
    // Cero aplicadores no es «importado con matices»: es que no entró nadie, y
    // el reparto que viene detrás no va a tener a quién asignar.
    return {
      texto: avisos.length
        ? `El excel no dejó ningún aplicador. ${avisos.slice(0, AVISOS_VISIBLES).join(" ")}`
        : "El excel no dejó ningún aplicador: revisa que los nombres estén en la columna «Nombres» y las marcas en las franjas.",
      tono: "atencion",
    };
  }

  if (!avisos.length) {
    return { texto: `${cabeza}. El reparto se rearmó con la oferta nueva.`, tono: "ok" };
  }

  const visibles = avisos.slice(0, AVISOS_VISIBLES);
  const resto = avisos.length - visibles.length;
  const frases = [
    `${cabeza}, con ${fmt(avisos.length)} ${avisos.length === 1 ? "aviso" : "avisos"}.`,
    ...visibles,
  ];
  if (resto > 0) {
    // No se promete una pantalla que no existe: se dice cuántos quedan y que
    // son del mismo excel, celda a celda, que es donde se van a mirar.
    frases.push(
      `Y ${fmt(resto)} ${resto === 1 ? "aviso más" : "avisos más"} sobre celdas sueltas de ese excel.`,
    );
  }
  frases.push("El reparto se rearmó con la oferta nueva.");
  return { texto: frases.join(" "), tono: "atencion" };
}
