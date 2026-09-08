// avisoParteContraPlataforma.ts — cuándo el parte y la plataforma están LEJOS.
//
// S8 (loop estética-aulas-sheets, 2026-09-07). La Base de control publica las
// dos cuentas juntas y el panel «El parte contra la plataforma» lista todos
// los descuadres, pero nadie avisaba cuando la distancia es grande, que es el
// control de campo que ese bloque existe para dar. Medido el día 1 de
// HSVG2026: CH 76 declaró 23 y la plataforma da 38 (−39 %), CH 72 23 contra
// 34 (−32 %), CH 108 12 contra 6 (+100 %); los otros cuatro partes difieren
// en 1 o 2, que es el ruido normal de contar a mano.
//
// «Lejos» exige las dos cosas a la vez: 5 encuestas o más de diferencia (una
// proporción sola alarma con 3 contra 1) y 20 % o más del lado de la
// plataforma (una cifra sola alarma en un aula de 80). Los casos salen del
// MISMO cruce del panel (`parteContraPlataforma`), no de una segunda cuenta.
import type { TonoAviso } from "./avisoLibroImportado";
import type { DescuadreDeAula, ParteContraPlataforma } from "./parteContraPlataforma";
import { fmt } from "./kpisDeAulas";

export const LEJOS_MINIMO_ENCUESTAS = 5;
export const LEJOS_PROPORCION = 0.2;

export function casosLejos(
  casos: ReadonlyArray<DescuadreDeAula>,
  umbral: { minimo?: number; proporcion?: number } = {},
): DescuadreDeAula[] {
  const minimo = umbral.minimo ?? LEJOS_MINIMO_ENCUESTAS;
  const proporcion = umbral.proporcion ?? LEJOS_PROPORCION;
  return casos.filter((c) => {
    const dif = Math.abs(c.diferencia);
    if (dif < minimo) return false;
    const base = Math.max(1, Math.abs(c.enPlataforma));
    return dif / base >= proporcion;
  });
}

function nombres(casos: ReadonlyArray<DescuadreDeAula>): string {
  const vistos = casos.slice(0, 5)
    .map((c) => `${c.codigo} (parte ${fmt(c.declaradas)}, plataforma ${fmt(c.enPlataforma)})`)
    .join(", ");
  const resto = casos.length - 5;
  return resto > 0 ? `${vistos} y ${fmt(resto)} más` : vistos;
}

/**
 * El aviso del cruce: nombra los cursos-horario lejos, dice la causa probable
 * de cada lado y la salida. Calla cuando el panel ya declara que las fuentes
 * no se corresponden (ahí el problema no es de campo) y cuando nada está lejos.
 */
export function avisoParteContraPlataforma(r: ParteContraPlataforma | null | undefined): {
  texto: string;
  tono: TonoAviso;
  codigos: string[];
} {
  if (!r || r.fuentesSinCorrespondencia) return { texto: "", tono: "ok", codigos: [] };
  const lejos = casosLejos(r.casos ?? []);
  if (!lejos.length) return { texto: "", tono: "ok", codigos: [] };
  const n = lejos.length;
  return {
    codigos: lejos.map((c) => c.codigo),
    tono: "atencion",
    texto:
      `${fmt(n)} ${n === 1 ? "curso-horario" : "cursos-horario"} con el parte lejos de la plataforma: ${nombres(lejos)}. ` +
      "Por debajo, el parte se cerró antes de que entraran las últimas respuestas o entran respuestas de otro curso-horario por el mismo QR. " +
      "Por encima, encuestas que no llegaron a la plataforma. Confírmalo con el aplicador y revisa el collectorID de esas respuestas.",
  };
}
