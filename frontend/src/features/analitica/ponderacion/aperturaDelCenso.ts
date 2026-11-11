// Cuándo se ve el bloque "Metas del CPV 2025" y cuándo está montado.
//
// El bloque se abre solo mientras un estudio territorial no trae metas del
// censo. Esa apertura queda fijada: aplicar el primer margen sube el conteo de
// metas del censo a 1 y, si la apertura siguiera dependiendo de ese conteo, el
// bloque se cerraría solo con la consulta, la selección de distritos y los
// márgenes aún sin asignar dentro. Una vez abierto, solo lo cierra su botón, y
// cerrado sigue montado (oculto) para no perder ese estado ni volver a pedir el
// catálogo.

export type AperturaDelCenso = {
  /** Lo que queda fijado: `null` mientras el bloque no se abrió nunca. */
  elegido: boolean | null;
  abierto: boolean;
  /** Montado desde la primera vez que se abre, aunque después se cierre. */
  montado: boolean;
};

export function aperturaDelCenso(
  elegido: boolean | null,
  /** La población de referencia es un territorio y los pesos se calculan. */
  ofrece: boolean,
  metasDelCenso: number,
): AperturaDelCenso {
  const fijado = elegido === null && ofrece && metasDelCenso === 0 ? true : elegido;
  return { elegido: fijado, abierto: ofrece && fijado === true, montado: ofrece && fijado !== null };
}
