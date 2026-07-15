// Lógica pura del importador de "Matriz PULSO IAC-CINDA".
//
// La matriz es un .xlsx de preguntas por criterio/subcriterio con columnas de
// audiencia (Docentes/Estudiantes/Administrativos). Al confirmar el diálogo, se
// genera un formulario por audiencia elegida en la biblioteca multi-formulario,
// respetando el tope compartido de formularios por proyecto.

export const MATRIZ_PULSO_AUDIENCES = ["Docentes", "Estudiantes", "Administrativos"] as const;

export type MatrizPulsoFormPlan = {
  /** Audiencias que sí se crearán (recortadas al cupo disponible). */
  toCreate: string[];
  /** Audiencias que quedaron fuera por el tope de formularios. */
  skipped: string[];
  /** true si hubo que recortar por el tope. */
  capped: boolean;
  /** Cupos libres al momento de planificar (maxForms - existentes). */
  availableSlots: number;
};

// Decide cuántos formularios crear vs. el tope. Deduplica y descarta vacíos,
// preserva el orden de selección y recorta al cupo libre.
export function planMatrizPulsoForms(
  selected: readonly string[],
  existingCount: number,
  maxForms: number,
): MatrizPulsoFormPlan {
  const availableSlots = Math.max(0, maxForms - Math.max(0, existingCount));
  const unique = selected.filter(
    (audience, index) => audience.trim().length > 0 && selected.indexOf(audience) === index,
  );
  const toCreate = unique.slice(0, availableSlots);
  const skipped = unique.slice(availableSlots);
  return {
    toCreate,
    skipped,
    capped: skipped.length > 0,
    availableSlots,
  };
}
