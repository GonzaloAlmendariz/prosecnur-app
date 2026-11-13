// Los formularios del editor del proyecto que Carga puede usar como formulario
// de la base (ítem 23 del checklist de validación del practicante). Solo los
// que tienen preguntas que reciben respuesta; primero el que está abierto en
// el editor.
import type { FormLibraryEntry } from "../../../../api/xlsformEditor";
import { formatoConteoDe } from "../../../../lib/formatoNumero";

export type FormularioDelEditor = { id: string; nombre: string; rotulo: string };

export function formulariosDelEditor(formularios: readonly FormLibraryEntry[]): FormularioDelEditor[] {
  return formularios
    .filter((f) => (f.n_questions ?? 0) > 0)
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.saved_at ?? 0) - (a.saved_at ?? 0))
    .map((f) => {
      const nombre = f.name.trim() || "Formulario sin nombre";
      return { id: f.id, nombre, rotulo: `${nombre} (${formatoConteoDe(f.n_questions, "pregunta")})` };
    });
}
