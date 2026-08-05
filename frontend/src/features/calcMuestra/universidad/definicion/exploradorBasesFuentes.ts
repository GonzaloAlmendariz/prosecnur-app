/**
 * Qué bases puede explorar la pestaña.
 *
 * G49 · Gonzalo: «con las dos bases iniciales y crudas teníamos suficiente para
 * poder ir mapeando qué teníamos». Las bases son las que se declararon en
 * Datos › Fuentes —archivo y hoja—, no el marco: el explorador va ANTES de
 * construirlo, y por eso también va antes de Variables.
 *
 * El marco se conserva como una opción más, al final: sirve para auditar qué
 * calculó el motor, pero ya no compite con las columnas del usuario ni obliga a
 * construirlo para mirar un Excel.
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";

export type FuenteExplorable =
  | {
      tipo: "archivo";
      id: string;
      etiqueta: string;
      detalle: string;
      fileId: string;
      sheet: string;
    }
  | { tipo: "marco"; id: "marco"; etiqueta: string; detalle: string };

/** Cómo se llama cada base en la pantalla, por su rol declarado. */
const ETIQUETA_ROL: Record<string, { etiqueta: string; detalle: string }> = {
  base_madre: { etiqueta: "Base principal", detalle: "una fila por estudiante y curso" },
  estudiantes: { etiqueta: "Estudiantes", detalle: "matrícula: una fila por estudiante y curso" },
  inscripciones: { etiqueta: "Inscripciones", detalle: "matrícula por curso-horario" },
  catalogo_curso_horario: { etiqueta: "Cursos-horario", detalle: "catálogo: una fila por curso-horario" },
  agenda: { etiqueta: "Agenda", detalle: "operación de campo por curso-horario" },
  muestra_previa: { etiqueta: "Selección previa", detalle: "cursos-horario ya seleccionados" },
};

/**
 * La referencia histórica NO se ofrece aquí: es la base de otro estudio, tiene
 * su propia pestaña y mezclarla con las del marco invita a leerla como si
 * describiera el universo de este.
 */
const ROLES_FUERA = new Set(["referencia_asistencia"]);

export function fuentesExplorables(
  workspace: CalcMuestraWorkspace | null | undefined,
  aulasState: CalcMuestraAulasState | null | undefined,
): FuenteExplorable[] {
  const bindings = (workspace?.source_bindings ?? []) as CalcMuestraWorkspaceSourceBinding[];
  const fuentes: FuenteExplorable[] = [];
  for (const binding of bindings) {
    const rol = String(binding.role ?? "");
    if (!rol || ROLES_FUERA.has(rol)) continue;
    const fileId = String(binding.file_id ?? "").trim();
    // Sin archivo no hay nada que leer: una base declarada pero no subida se
    // ofrecería como una pestaña vacía sin decir por qué.
    if (!fileId) continue;
    const meta = ETIQUETA_ROL[rol] ?? { etiqueta: rol, detalle: "base declarada" };
    fuentes.push({
      tipo: "archivo",
      id: String(binding.id ?? rol),
      etiqueta: meta.etiqueta,
      detalle: meta.detalle,
      fileId,
      sheet: String(binding.sheet_name ?? "").trim(),
    });
  }
  if (aulasState?.frame) {
    fuentes.push({
      tipo: "marco",
      id: "marco",
      etiqueta: "Marco construido",
      detalle: "lo que el motor derivó de tus bases",
    });
  }
  return fuentes;
}
