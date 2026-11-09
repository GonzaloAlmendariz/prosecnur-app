// Separadores entre filas del dumbbell (D4, aprobado por el dueño en la ronda 19): un clic entre dos filas de la lista de
// preguntas pone o quita una línea punteada en el gráfico. Se guarda en `separar_tras` (posiciones en el orden declarado,
// que el motor fija al haber separador: graficos_espec_contraste.R). El motor nunca pone uno por su cuenta. Módulo puro.

import { argsATemas } from "../../temasEquivalentes/temasEquivalentesModel";
import { esEntreGrupos, preguntasDeclaradas } from "./modeloBrechaGrupos";
import { usaPublicos } from "../publicosGrafico/modeloPublicos";

type Args = Readonly<Record<string, unknown>>;

/** Las filas tras las que va un separador: enteros ≥ 1, sin repetir y en orden (un número suelto o una lista; 0 = ninguno). */
export function separadoresDe(args: Args): number[] {
  const v = args.separar_tras;
  const crudos = Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];
  const n = crudos.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 1);
  return [...new Set(n)].sort((a, b) => a - b);
}

/** El cambio que pone (`activo`) o quita el separador tras la fila `posicion`; sin ninguno, borra el argumento. */
export function conSeparador(args: Args, posicion: number, activo: boolean): Record<string, unknown> {
  const s = new Set(separadoresDe(args));
  if (activo) s.add(posicion); else s.delete(posicion);
  const lista = [...s].sort((a, b) => a - b);
  return { separar_tras: lista.length ? lista : null };
}

/**
 * ¿La tarjeta de Datos lista las filas del dumbbell (y por eso los separadores se ponen entre ellas)? Entre grupos, con
 * dos o más preguntas elegidas una por una; entre bases, con dos o más temas. Con `base$*` o la regla las filas no se ven
 * en la tarjeta y queda el campo numérico de Aspecto.
 */
export function filasEnLaTarjeta(args: Args): boolean {
  if (esEntreGrupos(args)) return !usaPublicos(args.vars) && preguntasDeclaradas(args).length >= 2;
  return argsATemas(args).length >= 2;
}
