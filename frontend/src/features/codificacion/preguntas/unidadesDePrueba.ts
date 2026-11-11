// Datos de prueba de Preguntas: los comparten las pruebas del modelo y las de las piezas.

import type { PreguntaAbierta } from "../../../api/codificacion";

export function pregunta(parent: string, tipo: string, extra: Partial<PreguntaAbierta> = {}): PreguntaAbierta {
  return {
    parent,
    parent_label: `Etiqueta de ${parent}`,
    tipo,
    subtipo: "text",
    modo_so: "",
    text_col: "",
    parent_col: "",
    list_norm: "",
    col_efectiva: "",
    n_respuestas: 0,
    n_unicas: 0,
    n_codificadas: 0,
    status: "no-iniciado",
    habilitada: true,
    preview: [],
    section: "datos",
    section_label: "Datos generales",
    q_order: null,
    candidatos_texto: [],
    pareja: null,
    marcada: false,
    marcada_auto: false,
    ...extra,
  };
}

// Un formulario chico: una pareja de opción única ya codificada, una de opción múltiple sin su "Otros",
// una cerrada sin texto, un texto suelto marcado y a medias, un texto con patrón de "otro", una numérica
// y una desactivada. El orden del arreglo no es el del formulario: lo da `q_order`.
export const FORMULARIO: PreguntaAbierta[] = [
  pregunta("p9", "text", { q_order: 5, section: "laboral", section_label: "Situación laboral", marcada: true, status: "en-curso", n_respuestas: 142, n_unicas: 97, n_codificadas: 70 }),
  pregunta("p3_otro", "text", { q_order: 2, col_efectiva: "p3_otro", n_respuestas: 23, n_unicas: 14 }),
  pregunta("p3", "select_one", {
    q_order: 1, modo_so: "padre", marcada: true, marcada_auto: true, status: "completo", n_respuestas: 23, n_unicas: 14, n_codificadas: 14,
    pareja: { child_col: "p3_otro", modo_so: "padre", dummy_col: "" },
  }),
  pregunta("D1", "select_multiple", {
    q_order: 3, marcada: true, marcada_auto: true, status: "no-iniciado", n_respuestas: 51, n_unicas: 12,
    pareja: { child_col: "D1_otro", modo_so: "", dummy_col: "" },
  }),
  pregunta("p10", "select_one", { q_order: 4, section: "laboral", section_label: "Situación laboral" }),
  pregunta("p10_otro", "text", { q_order: 6, section: "laboral", section_label: "Situación laboral", n_respuestas: 18, n_unicas: 15 }),
  pregunta("p11", "integer", { q_order: 7, section: "laboral", section_label: "Situación laboral" }),
  pregunta("p30", "text", { q_order: 8, section: "laboral", section_label: "Situación laboral", status: "no-aplica" }),
];
