import {
  Calculator,
  CirclePlay,
  FilePen,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Workflow,
  type LucideIcon,
} from "../../../vendor/lucide-react";

// Pestañas del Editor de formularios › Formularios (2026-10-15). Nacen del toggle «Constructor | Hojas» y del
// popover «Más vistas» de la banda de comandos, más «Impreso», que reemplaza al diálogo «Configurar PDF». Son
// espacios de trabajo con contenido propio; lo transitorio o lo que depende de una selección (listas de opciones,
// lógica de SurveyMonkey, campaña complementaria) sigue siendo panel (`?panel=`).
//
// Sólo existen con un formulario abierto: la biblioteca de formularios no lleva rail.

export type EditorFormulariosPestanaId =
  | "constructor"
  | "hojas"
  | "opciones"
  | "cuestionario"
  | "logica"
  | "restricciones"
  | "calculos"
  | "filtros"
  | "probar"
  | "resumen"
  | "impreso";

export type PestanaEditorFormularios = {
  readonly id: EditorFormulariosPestanaId;
  readonly key: EditorFormulariosPestanaId;
  readonly label: string;
  /** Una línea: lo que hay en la pestaña. Viaja al tooltip y al nombre accesible del rail. */
  readonly description: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly direccionPublicada: true;
};

function pestana(
  key: EditorFormulariosPestanaId,
  label: string,
  description: string,
  icon: LucideIcon,
): PestanaEditorFormularios {
  return {
    id: key,
    key,
    label,
    description,
    icon,
    to: `/editor-xlsform?pestana=${key}`,
    layoutPolicy: "viewport",
    direccionPublicada: true,
  };
}

export const EDITOR_FORMULARIOS_PESTANAS: readonly PestanaEditorFormularios[] = [
  pestana("constructor", "Constructor", "Edición guiada, pregunta por pregunta", FilePen),
  pestana("hojas", "Editor XLSForm", "Las hojas survey, choices y settings, celda por celda", Table2),
  // 2026-10-16: el catálogo de opciones deja de ser panel lateral («debería tener su subtab propio»).
  pestana("opciones", "Listas de opciones", "Las listas de respuestas, dónde se usan y cuáles se repiten", ListChecks),
  pestana("cuestionario", "Vista del cuestionario", "El formulario completo, sección por sección", Layers3),
  pestana("logica", "Mapa de lógica", "Qué pregunta depende de cuál", Workflow),
  pestana("restricciones", "Restricciones", "Qué respuesta acepta cada pregunta", ShieldCheck),
  pestana("calculos", "Cálculos", "Variables que se obtienen de otras respuestas", Calculator),
  pestana("filtros", "Filtros de opciones", "Qué respuesta habilita qué opción", SlidersHorizontal),
  pestana("probar", "Probar formulario", "Llénalo como encuestado y sigue los saltos", CirclePlay),
  pestana("resumen", "Resumen", "Tipos de pregunta, secciones y salud", Gauge),
  pestana("impreso", "Impreso", "El cuestionario en PDF y Word", FileText),
];

export const PESTANA_EDITOR_POR_DEFECTO: EditorFormulariosPestanaId = "constructor";
