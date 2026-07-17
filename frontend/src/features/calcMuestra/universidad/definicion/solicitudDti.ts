/**
 * Payload PURO de la solicitud de base para DTI (contrato congelado
 * POST /api/calc-muestra/solicitud-dti): la estructura de variables esperadas
 * sale de UNIVERSITY_REQUIRED_VARIABLES (rol, label, hoja, requerida,
 * descripción) y las notas fijan los acuerdos de la reunión del diseño
 * muestral 2026-07-15. Función pura con test; el botón solo la consume.
 */
import type { CalcMuestraSolicitudDtiVariable } from "../../../../api/client";
import { UNIVERSITY_REQUIRED_VARIABLES } from "../shared/constants";

/** Hoja legible donde se espera cada rol (por source_role del mapeo). */
const HOJA_POR_SOURCE_ROLE: Record<string, string> = {
  base_madre: "Hoja de matrícula (una fila por estudiante en cada curso-horario)",
  estudiantes: "Hoja de matrícula",
  catalogo_curso_horario: "Hoja de cursos y horarios",
};

/** Acuerdos de la reunión del diseño muestral (2026-07-15) para el correo a DTI. */
export const NOTAS_SOLICITUD_DTI: string[] = [
  "Tipo de curso DESAGREGADO por curso-horario (teórico, teórico-práctico, laboratorio, taller, seminario…), no agrupado en una sola categoría.",
  "Condición del curso (obligatorio, electivo…) informada por cada curso-horario (CH), no solo a nivel de curso.",
  "Nivel curricular Y nivel según créditos como columnas separadas (el nivel curricular manda; los créditos son apoyo).",
  "Código de estudiante en cada fila de matrícula (control de duplicados y cobertura; no se publica en salidas para cliente).",
];

export type SolicitudDtiPayload = {
  variables: CalcMuestraSolicitudDtiVariable[];
  notas: string[];
};

/**
 * Arma el payload de la solicitud: una fila por ROL único del mapeo requerido
 * (dedupe defensivo por rol) con su hoja legible, si es requerida y por qué.
 */
export function solicitudDtiPayload(): SolicitudDtiPayload {
  const seen = new Set<string>();
  const variables: CalcMuestraSolicitudDtiVariable[] = [];
  for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
    if (seen.has(base.role)) continue;
    seen.add(base.role);
    variables.push({
      rol: base.role,
      label: base.label,
      hoja: HOJA_POR_SOURCE_ROLE[base.source_role ?? ""] ?? (base.source_role ?? ""),
      requerida: Boolean(base.required),
      descripcion: base.description ?? "",
    });
  }
  return { variables, notas: [...NOTAS_SOLICITUD_DTI] };
}
