/**
 * Cómo se llama cada columna del marco en el idioma del usuario.
 *
 * G43 · Gonzalo: «pero los nombres de la base no son los de las columnas
 * originales del Excel». Cierto: el explorador enseñaba `session_type`,
 * `eligible_n` o `condicion_curso`, que son los nombres internos del motor. El
 * mapeo que la mesa ya guarda —rol → columna declarada en Datos › Variables—
 * dice cómo se llamaba esa columna en el archivo, así que la superficie puede
 * hablar el idioma del que subió la base.
 *
 * Tres orígenes distintos, y la diferencia importa:
 *
 * - `excel` — la columna existe en el archivo con ese nombre; se muestra tal
 *   cual, con su nombre técnico al lado para no perder la trazabilidad.
 * - `motor` — la calculó el marco (elegibles por curso-horario, prevalencia,
 *   homogeneidad de nivel…). No hay columna original que enseñar, y fingir una
 *   sería peor que decirlo.
 * - `interno` — resto de columnas del frame sin etiqueta conocida: se muestran
 *   con su nombre crudo, que es lo único cierto que se sabe de ellas.
 */
import type { CalcMuestraWorkspaceVariableMapping } from "../../../../api/client";
import { UNIVERSITY_REQUIRED_VARIABLES } from "../shared/constants";

export type OrigenColumna = "excel" | "motor" | "interno";

export type NombreColumna = {
  /** Lo que se muestra como título. */
  titulo: string;
  /** El nombre técnico de la columna del frame (siempre disponible). */
  tecnico: string;
  origen: OrigenColumna;
  /** Presente cuando el origen es `motor`: qué calcula. */
  detalle?: string;
};

/**
 * Columnas que el marco DERIVA. No vienen de ninguna hoja, así que su nombre
 * legible se declara aquí junto a lo que significan: mostrarlas con el nombre
 * crudo obligaba a saberse el motor de memoria.
 */
const DERIVADAS: Record<string, { titulo: string; detalle: string }> = {
  eligible_n: {
    titulo: "Alumnos elegibles",
    detalle: "estudiantes del curso-horario que cumplen los criterios de estudiante",
  },
  eligible_ratio: {
    titulo: "Proporción de elegibles",
    detalle: "elegibles sobre matriculados del curso-horario",
  },
  included: { titulo: "Entra al marco", detalle: "resultado de aplicar todos los criterios" },
  exclude_reason: { titulo: "Motivo de exclusión", detalle: "criterio que dejó fuera el curso-horario" },
  size_group: { titulo: "Tramo de tamaño", detalle: "grupo por número de elegibles" },
  prevalence_ratio: {
    titulo: "Prevalencia de elegibles",
    detalle: "elegibles sobre la matrícula total del curso-horario",
  },
  cycle_homogeneity: {
    titulo: "Homogeneidad de nivel",
    detalle: "proporción de matriculados que cursa el nivel del curso",
  },
  faculty_match_share: {
    titulo: "Coincidencia de facultad",
    detalle: "proporción de matriculados de la facultad que dicta el curso",
  },
  level_match_share: {
    titulo: "Coincidencia de nivel",
    detalle: "proporción de matriculados en el nivel de referencia",
  },
  level_reference: { titulo: "Nivel de referencia", detalle: "nivel con el que se compara el curso" },
  course_level_num: { titulo: "Nivel del curso (número)", detalle: "nivel normalizado a número" },
  unique_student_hash: { titulo: "Huella de estudiantes", detalle: "control de duplicados; no identifica a nadie" },
  sex_top_1: { titulo: "Sexo predominante", detalle: "categoría de sexo más frecuente del curso-horario" },
  sex_top_1_n: { titulo: "Frecuencia del sexo predominante", detalle: "cuántos estudiantes lo componen" },
  sex_top_2: { titulo: "Segundo sexo", detalle: "segunda categoría de sexo del curso-horario" },
  sex_top_2_n: { titulo: "Frecuencia del segundo sexo", detalle: "cuántos estudiantes lo componen" },
  teacher_type_top: { titulo: "Tipo de docente predominante", detalle: "categoría de docente más frecuente" },
  label: { titulo: "Etiqueta del curso-horario", detalle: "nombre legible que arma el motor" },
  classroom_id: { titulo: "Identificador de curso-horario", detalle: "clave con la que el motor une las bases" },
};

/** Etiqueta institucional del rol, para cuando el archivo no declara nombre. */
const ETIQUETA_ROL = new Map(
  UNIVERSITY_REQUIRED_VARIABLES.map((row) => [row.role, row.label ?? row.role]),
);

/**
 * G43 · Dos sitios declaran el nombre del archivo, y hay que mirar los dos.
 *
 * `variable_mappings` es lo que el usuario declaró en Datos › Variables, y el
 * catálogo de criterios publica `mappedColumn` por variable —la columna que el
 * motor leyó de verdad—. Con un proyecto abierto desde un `.pulso` el primero
 * puede venir vacío y el segundo sigue ahí.
 *
 * NO se usa `config.mapping` del frame aunque parezca la fuente obvia: mide en
 * el proyecto real y sus pares salen desalineados (`faculty=tipo_sesion`,
 * `session_type=Horario`) porque la lista arrastra los alias candidatos de cada
 * rol y las claves repetidas colapsan al serializar. Un nombre inventado con
 * aspecto de dato del archivo es peor que el nombre técnico.
 */
export function nombreDeColumna(
  columna: string,
  mappings: CalcMuestraWorkspaceVariableMapping[] | null | undefined,
  mappingMotor?: Record<string, unknown> | null,
): NombreColumna {
  const mapeada = (mappings ?? []).find(
    (row) => row.role === columna && typeof row.column === "string" && row.column.trim(),
  );
  if (mapeada?.column) {
    return { titulo: mapeada.column.trim(), tecnico: columna, origen: "excel" };
  }
  const delMotor = mappingMotor?.[columna];
  if (typeof delMotor === "string" && delMotor.trim()) {
    return { titulo: delMotor.trim(), tecnico: columna, origen: "excel" };
  }
  const derivada = DERIVADAS[columna];
  if (derivada) {
    return {
      titulo: derivada.titulo,
      tecnico: columna,
      origen: "motor",
      detalle: derivada.detalle,
    };
  }
  /*
   * Sin columna declarada y sin ser derivada conocida: puede ser un rol que la
   * mesa entiende (y entonces su etiqueta institucional ayuda) o una columna
   * del frame que nadie nombró. En los dos casos el nombre técnico sigue a la
   * vista, porque es lo que permite volver al dato.
   */
  const etiqueta = ETIQUETA_ROL.get(columna);
  if (etiqueta) return { titulo: etiqueta, tecnico: columna, origen: "interno" };
  return { titulo: columna, tecnico: columna, origen: "interno" };
}
