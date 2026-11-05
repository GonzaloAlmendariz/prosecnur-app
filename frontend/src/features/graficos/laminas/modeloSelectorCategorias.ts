// Qué dice y qué hace la fila de fichas de SelectorCategorias, sin React (H9 del checklist de usabilidad, 2026-11-05).
//
// Tres sentidos de una ficha marcada:
//   - «excluir»: lo marcado sale del gráfico; nada marcado, se muestran todas.
//   - «elegir»: lo marcado es lo que cuenta (el corte, las respuestas de una línea); nada marcado es eso, nada.
//   - «elegir» con `vacioEsTodos` («Niveles que se muestran»): guardar nada significa TODOS, así que la fila arranca
//     con todas las fichas marcadas y «Todos (N)»; quitar una ficha saca ese nivel. Volver a marcar todas guarda la
//     lista vacía (la forma canónica de «todos»). La última ficha marcada no se quita: quedaría «ninguno», que el
//     motor leería como todos.
// Las frases concuerdan con el sustantivo de la fila («Ningún nivel elegido», «Ninguna respuesta elegida»).

export type Sustantivo = { uno: string; varios: string; femenino: boolean };

export const RESPUESTA: Sustantivo = { uno: "respuesta", varios: "respuestas", femenino: true };
export const NIVEL: Sustantivo = { uno: "nivel", varios: "niveles", femenino: false };
export const GRUPO: Sustantivo = { uno: "grupo", varios: "grupos", femenino: false };

export type ModoFichas = "excluir" | "elegir" | "una";

/** Las claves que se ven marcadas: con `vacioEsTodos` y nada guardado, todas. */
export function marcadas(elegidos: ReadonlySet<string>, claves: readonly string[], vacioEsTodos: boolean): Set<string> {
  const guardadas = claves.filter((c) => elegidos.has(c));
  return new Set(vacioEsTodos && guardadas.length === 0 ? claves : guardadas);
}

/** ¿Se puede pulsar esta ficha? Con `vacioEsTodos`, la última marcada no se quita. */
export function fichaBloqueada(clave: string, visibles: ReadonlySet<string>, vacioEsTodos: boolean): boolean {
  return vacioEsTodos && visibles.size === 1 && visibles.has(clave);
}

/** Lo que se guarda al pulsar una ficha, en el orden de las categorías. */
export function trasPulsar(
  clave: string, elegidos: ReadonlySet<string>, claves: readonly string[], modo: ModoFichas, vacioEsTodos = false,
): string[] {
  if (modo === "una") return elegidos.has(clave) ? [] : [clave];
  const visibles = marcadas(elegidos, claves, vacioEsTodos);
  if (fichaBloqueada(clave, visibles, vacioEsTodos)) return claves.filter((c) => elegidos.has(c));
  if (visibles.has(clave)) visibles.delete(clave); else visibles.add(clave);
  const lista = claves.filter((c) => visibles.has(c));
  return vacioEsTodos && lista.length === claves.length ? [] : lista;
}

const uno = (s: Sustantivo) => (s.femenino ? "Una" : "Uno");
const conGenero = (s: Sustantivo, fem: string, masc: string) => (s.femenino ? fem : masc);

/** El resumen a la derecha del rótulo («Todos (4)», «2 de 4 niveles», «Ningún nivel elegido», «Una excluida»). */
export function resumenFichas(n: number, total: number, modo: ModoFichas, s: Sustantivo = RESPUESTA, vacioEsTodos = false): string {
  if (modo === "excluir") {
    if (n === 0) return `Se muestran ${conGenero(s, "todas", "todos")}`;
    return n === 1 ? `${uno(s)} ${conGenero(s, "excluida", "excluido")}` : `${n} ${conGenero(s, "excluidas", "excluidos")}`;
  }
  if (vacioEsTodos) {
    if (n === 0 || n >= total) return `${conGenero(s, "Todas", "Todos")} (${total})`;
    return `${n} de ${total} ${s.varios}`;
  }
  if (n === 0) return `${conGenero(s, "Ninguna", "Ningún")} ${s.uno} ${conGenero(s, "elegida", "elegido")}`;
  return n === 1 ? `${uno(s)} ${conGenero(s, "elegida", "elegido")}` : `${n} ${conGenero(s, "elegidas", "elegidos")}`;
}
