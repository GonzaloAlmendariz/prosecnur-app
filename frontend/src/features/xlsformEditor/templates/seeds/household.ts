// =============================================================================
// templates/seeds/household.ts — encuesta de hogar simple
// =============================================================================
// Inspirado en una versión simplificada de ESPP / encuestas de hogar
// estándar. Cubre los bloques mínimos para perfilar un hogar:
//   - Identificación del informante.
//   - Composición del hogar (cantidad, jefatura).
//   - Vivienda (tipo, cuartos, materiales).
// Pensado como punto de partida que el usuario customiza.
// =============================================================================

import type { TemplateSeed } from "../seedHelper";

export const householdSeed: TemplateSeed = {
  id: "household",
  title: "Encuesta de hogar",
  description:
    "Identificación del informante, composición del hogar y características básicas de la vivienda.",
  highlights: [
    "3 secciones (Informante · Hogar · Vivienda)",
    "8 preguntas con catálogos para sexo, jefatura y tipo de vivienda",
    "Listo para tropicalizar a tu instrumento",
  ],
  accent: "#0f766e",
  formTitle: "Encuesta de hogar",
  formId: "encuesta_hogar",
  surveyRows: [
    { type: "start", name: "_start" },
    { type: "end", name: "_end" },
    { type: "today", name: "_today" },

    // -------- Identificación del informante --------
    {
      type: "begin_group",
      name: "g_informante",
      label: "Identificación del informante",
    },
    {
      type: "text",
      name: "informante_nombre",
      label: "Nombres y apellidos del informante",
      required: "yes",
    },
    {
      type: "integer",
      name: "informante_edad",
      label: "Edad del informante",
      hint: "Años cumplidos.",
      constraint: ". >= 0 and . <= 120",
      required: "yes",
    },
    {
      type: "select_one sexo",
      name: "informante_sexo",
      label: "Sexo del informante",
      required: "yes",
    },
    { type: "end_group", name: "g_informante_end" },

    // -------- Composición del hogar --------
    {
      type: "begin_group",
      name: "g_hogar",
      label: "Composición del hogar",
    },
    {
      type: "integer",
      name: "num_miembros",
      label: "¿Cuántas personas viven en este hogar?",
      hint: "Incluye al informante.",
      constraint: ". >= 1 and . <= 30",
      required: "yes",
    },
    {
      type: "select_one sexo",
      name: "jefe_hogar_sexo",
      label: "Sexo de la persona que es jefa o jefe de hogar",
      required: "yes",
    },
    { type: "end_group", name: "g_hogar_end" },

    // -------- Vivienda --------
    {
      type: "begin_group",
      name: "g_vivienda",
      label: "Características de la vivienda",
    },
    {
      type: "select_one tipo_vivienda",
      name: "vivienda_tipo",
      label: "Tipo de vivienda",
    },
    {
      type: "integer",
      name: "vivienda_cuartos",
      label: "Número de cuartos (sin contar baño ni cocina)",
      constraint: ". >= 0 and . <= 50",
    },
    {
      type: "select_multiple servicios_basicos",
      name: "vivienda_servicios",
      label: "¿Con qué servicios cuenta esta vivienda?",
      hint: "Marca todas las opciones que correspondan.",
    },
    { type: "end_group", name: "g_vivienda_end" },
  ],
  catalogs: [
    {
      listName: "sexo",
      items: [
        { name: "femenino", label: "Femenino" },
        { name: "masculino", label: "Masculino" },
        { name: "otro", label: "Otro" },
        { name: "prefiero_no_decir", label: "Prefiero no decirlo" },
      ],
    },
    {
      listName: "tipo_vivienda",
      items: [
        { name: "casa_independiente", label: "Casa independiente" },
        { name: "departamento", label: "Departamento en edificio" },
        { name: "vivienda_en_quinta", label: "Vivienda en quinta o callejón" },
        { name: "casa_vecindad", label: "Casa de vecindad / solar" },
        { name: "improvisada", label: "Vivienda improvisada" },
        { name: "otro", label: "Otro" },
      ],
    },
    {
      listName: "servicios_basicos",
      items: [
        { name: "agua", label: "Agua potable de red pública" },
        { name: "desague", label: "Desagüe / alcantarillado" },
        { name: "electricidad", label: "Electricidad" },
        { name: "internet", label: "Internet" },
        { name: "gas_natural", label: "Gas natural" },
      ],
    },
  ],
};
