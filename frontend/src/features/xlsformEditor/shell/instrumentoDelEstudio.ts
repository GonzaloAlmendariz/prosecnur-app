// El instrumento del estudio en la biblioteca del editor (auditoría visual del 4 nov 2026, hallazgo 12).
//
// El Home contaba las 66 preguntas del instrumento vinculado a la base y el editor abría un borrador de 1
// pregunta, porque en la biblioteca sólo estaba ese borrador. Cuando el estudio tiene un instrumento que
// ningún formulario de la biblioteca trae, y todos los que hay son más chicos, el editor aterriza en la
// biblioteca y ofrece abrirlo, en vez de entrar al borrador. Nada se borra: el borrador sigue en la
// biblioteca con su autosave, y abrir el instrumento lo agrega como un formulario más.

import type { InstrumentoDelEstudio } from "../../../api/xlsformEditor";
import type { LibraryEntry } from "../state/persistence";

export function ofrecerInstrumentoDelEstudio(
  instrumento: InstrumentoDelEstudio | null,
  forms: readonly Pick<LibraryEntry, "source" | "nQuestions">[],
): boolean {
  if (!instrumento || instrumento.n_questions <= 0) return false;
  const nombre = instrumento.nombre.trim().toLowerCase();
  const yaEsta = forms.some((f) => {
    const origen = f.source?.original_name;
    return typeof origen === "string" && nombre !== "" && origen.trim().toLowerCase() === nombre;
  });
  if (yaEsta) return false;
  return forms.every((f) => (f.nQuestions ?? 0) < instrumento.n_questions);
}
