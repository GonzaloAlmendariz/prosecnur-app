/**
 * El semáforo de profundidad de reservas, contra el objetivo DECLARADO.
 *
 * La cabecera de reemplazos pintaba alerta bajo 1 y «colchón holgado» a partir
 * de 2, dos números escritos a mano. Coinciden con el objetivo por defecto
 * (`reserve_depth_target: 1`) y por eso nunca se notó, pero el objetivo es
 * configurable y el motor SÍ lo respeta: avisa «Profundidad de reservas menor
 * al objetivo» cuando la media de `depth_ratio` queda por debajo. Con un
 * objetivo de 3, la pantalla seguía diciendo «holgado» con 2 reservas por
 * titular mientras el motor avisaba — verde contra un objetivo que la propia
 * pantalla ignoraba.
 *
 * Aquí no se decide un umbral nuevo: se lee el que ya está declarado. La
 * holgura es 2× el objetivo, que es exactamente el comportamiento de siempre
 * cuando el objetivo vale 1.
 *
 * Una diferencia que se conserva a propósito: el motor promedia `depth_ratio`
 * sobre las celdas y la pantalla mira el MÍNIMO. Son preguntas distintas —«¿el
 * plan tiene colchón?» contra «¿hay alguna celda descubierta?»— y la de campo
 * es la segunda, porque una celda sin reserva no la salva la media de las
 * demás.
 */

export type TonoProfundidad = "alerta" | "ok" | undefined;

export type ProfundidadReserva = {
  /** Objetivo declarado de reservas por titular. */
  objetivo: number;
  /** El peor `depth_ratio` entre las celdas. */
  minimo: number;
  tono: TonoProfundidad;
  /** El objetivo no es el de fábrica: nombrarlo evita leer el tono a ciegas. */
  objetivoExplicito: boolean;
};

/** El que trae la config de fábrica; sirve para saber si alguien lo movió. */
export const OBJETIVO_RESERVA_POR_DEFECTO = 1;

export function profundidadReserva(
  minimo: number,
  objetivoDeclarado: number | null | undefined,
): ProfundidadReserva | null {
  if (!Number.isFinite(minimo)) return null;
  // Un objetivo no positivo no ordena nada: se cae al de fábrica antes que
  // pintar todo verde por division degenerada.
  const objetivo =
    typeof objetivoDeclarado === "number" && Number.isFinite(objetivoDeclarado) && objetivoDeclarado > 0
      ? objetivoDeclarado
      : OBJETIVO_RESERVA_POR_DEFECTO;
  return {
    objetivo,
    minimo,
    tono: minimo < objetivo ? "alerta" : minimo >= 2 * objetivo ? "ok" : undefined,
    objetivoExplicito: objetivo !== OBJETIVO_RESERVA_POR_DEFECTO,
  };
}
