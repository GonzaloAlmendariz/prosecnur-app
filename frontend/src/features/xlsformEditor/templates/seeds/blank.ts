// =============================================================================
// templates/seeds/blank.ts — esqueleto mínimo
// =============================================================================
// El template "en blanco" no es realmente vacío: incluye start/end (auto-meta
// recomendado para todo formulario) y una pregunta de texto inicial para que
// el usuario tenga algo que editar de inmediato. Todo formulario nuevo
// generado desde la galería arranca aquí cuando el usuario elige "Empezar de
// cero".
// =============================================================================

import type { TemplateSeed } from "../seedHelper";

export const blankSeed: TemplateSeed = {
  id: "blank",
  title: "Empezar de cero",
  description:
    "Un esqueleto mínimo con metadatos auto y una pregunta para empezar a personalizar.",
  highlights: [
    "Auto-meta start/end (timestamp del envío)",
    "1 pregunta de texto editable",
    "Sin catálogos predefinidos",
  ],
  accent: "#2457d6",
  formTitle: "Formulario nuevo",
  formId: "formulario_nuevo",
  surveyRows: [
    { type: "start", name: "_start" },
    { type: "end", name: "_end" },
    {
      type: "text",
      name: "p1_intro",
      label: "Tu primera pregunta",
      hint: "Reemplaza este texto con la pregunta que quieras hacer.",
    },
  ],
  catalogs: [],
};
