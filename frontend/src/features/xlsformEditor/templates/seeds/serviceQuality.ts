// =============================================================================
// templates/seeds/serviceQuality.ts — encuesta de calidad de servicio
// =============================================================================
// Inspirado en encuestas de satisfacción tipo GIZ / sector público. Cubre:
//   - Tipo de servicio recibido.
//   - Frecuencia de uso.
//   - Likert de satisfacción (5 niveles).
//   - Recomendación (sí / no / tal vez).
//   - Comentario abierto multilínea.
// Es el caso clásico de feedback post-atención: rápido de responder y con
// catálogos cortos y reutilizables.
// =============================================================================

import type { TemplateSeed } from "../seedHelper";

export const serviceQualitySeed: TemplateSeed = {
  id: "service-quality",
  title: "Calidad de servicio",
  description:
    "Encuesta de satisfacción con escala Likert, recomendación y comentario abierto.",
  highlights: [
    "5 preguntas estándar de calidad de servicio",
    "Escala Likert de 5 niveles incluida",
    "Catálogos compactos (frecuencia, recomendación, satisfacción)",
  ],
  accent: "#7c3aed",
  formTitle: "Encuesta de calidad de servicio",
  formId: "calidad_servicio",
  surveyRows: [
    { type: "start", name: "_start" },
    { type: "end", name: "_end" },
    { type: "today", name: "_today" },

    {
      type: "select_one tipo_servicio",
      name: "p1_servicio",
      label: "¿Qué servicio acabas de recibir?",
      required: "yes",
    },
    {
      type: "select_one frecuencia_uso",
      name: "p2_frecuencia",
      label: "¿Con qué frecuencia usas este servicio?",
      required: "yes",
    },
    {
      type: "select_one likert_satisfaccion",
      name: "p3_satisfaccion",
      label: "Considerando la atención recibida hoy, ¿qué tan satisfecho estás?",
      hint: "1 = Muy insatisfecho, 5 = Muy satisfecho.",
      appearance: "likert",
      required: "yes",
    },
    {
      type: "select_one recomendacion",
      name: "p4_recomienda",
      label: "¿Recomendarías este servicio a alguien que conoces?",
      required: "yes",
    },
    {
      type: "text",
      name: "p5_comentario",
      label: "¿Hay algo que te gustaría comentar para mejorar el servicio?",
      hint: "Opcional. Tu comentario nos ayuda a identificar puntos de mejora.",
      appearance: "multiline",
    },
  ],
  catalogs: [
    {
      listName: "tipo_servicio",
      items: [
        { name: "atencion_presencial", label: "Atención presencial" },
        { name: "telefono", label: "Atención por teléfono" },
        { name: "web", label: "Trámite web / app" },
        { name: "otro", label: "Otro" },
      ],
    },
    {
      listName: "frecuencia_uso",
      items: [
        { name: "primera_vez", label: "Es mi primera vez" },
        { name: "ocasional", label: "Lo uso ocasionalmente" },
        { name: "frecuente", label: "Lo uso con frecuencia" },
        { name: "muy_frecuente", label: "Lo uso muy frecuentemente" },
      ],
    },
    {
      listName: "likert_satisfaccion",
      items: [
        { name: "1", label: "Muy insatisfecho" },
        { name: "2", label: "Insatisfecho" },
        { name: "3", label: "Ni satisfecho ni insatisfecho" },
        { name: "4", label: "Satisfecho" },
        { name: "5", label: "Muy satisfecho" },
      ],
    },
    {
      listName: "recomendacion",
      items: [
        { name: "si", label: "Sí" },
        { name: "tal_vez", label: "Tal vez" },
        { name: "no", label: "No" },
      ],
    },
  ],
};
