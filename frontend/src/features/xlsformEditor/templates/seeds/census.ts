// =============================================================================
// templates/seeds/census.ts — censo simple con repeat por miembro
// =============================================================================
// Inspirado en HST y censos cortos. El concepto clave: hay un repeat
// "miembros" cuyo `repeat_count` se obtiene de la pregunta `num_miembros`,
// de modo que el formulario despliega una pestaña por persona del hogar.
//
// Es el ejemplo canónico para mostrar la potencia de los repeats — el
// usuario ve cómo se construye y puede adaptarlo a sus propios contextos.
// =============================================================================

import type { TemplateSeed } from "../seedHelper";

export const censusSeed: TemplateSeed = {
  id: "census",
  title: "Censo simple",
  description:
    "Cuenta personas del hogar y captura datos básicos (nombre, edad, sexo, parentesco) por cada miembro.",
  highlights: [
    "Bloque repetido por miembro (repeat_count = num_miembros)",
    "Catálogos para sexo y parentesco con jefatura de hogar",
    "Patrón canónico de censo que puedes adaptar a tu contexto",
  ],
  accent: "#db2777",
  formTitle: "Censo de personas",
  formId: "censo_personas",
  surveyRows: [
    { type: "start", name: "_start" },
    { type: "end", name: "_end" },
    { type: "today", name: "_today" },

    {
      type: "begin_group",
      name: "g_hogar",
      label: "Datos del hogar",
    },
    {
      type: "text",
      name: "informante",
      label: "Nombre del informante",
      required: "yes",
    },
    {
      type: "integer",
      name: "num_miembros",
      label: "¿Cuántas personas viven en este hogar?",
      hint: "Incluye al informante. Cada persona se registra después.",
      constraint: ". >= 1 and . <= 20",
      required: "yes",
    },
    { type: "end_group", name: "g_hogar_end" },

    {
      type: "begin_repeat",
      name: "miembros",
      label: "Datos por miembro del hogar",
      hint: "Se repite una vez por cada persona del hogar.",
      repeat_count: "${num_miembros}",
    },
    {
      type: "text",
      name: "miembro_nombre",
      label: "Nombres y apellidos",
      required: "yes",
    },
    {
      type: "integer",
      name: "miembro_edad",
      label: "Edad",
      hint: "Años cumplidos.",
      constraint: ". >= 0 and . <= 120",
      required: "yes",
    },
    {
      type: "select_one sexo",
      name: "miembro_sexo",
      label: "Sexo",
      required: "yes",
    },
    {
      type: "select_one parentesco",
      name: "miembro_parentesco",
      label: "Parentesco con la persona jefa de hogar",
      required: "yes",
    },
    { type: "end_repeat", name: "miembros_end" },
  ],
  catalogs: [
    {
      listName: "sexo",
      items: [
        { name: "femenino", label: "Femenino" },
        { name: "masculino", label: "Masculino" },
        { name: "otro", label: "Otro" },
      ],
    },
    {
      listName: "parentesco",
      items: [
        { name: "jefe", label: "Jefa o jefe de hogar" },
        { name: "pareja", label: "Esposa, esposo o pareja" },
        { name: "hijo", label: "Hija o hijo" },
        { name: "padre_madre", label: "Madre o padre" },
        { name: "hermano", label: "Hermana o hermano" },
        { name: "abuelo", label: "Abuela o abuelo" },
        { name: "nieto", label: "Nieta o nieto" },
        { name: "otro_pariente", label: "Otro pariente" },
        { name: "no_pariente", label: "No pariente" },
      ],
    },
  ],
};
