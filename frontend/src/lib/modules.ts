import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  IconCollector,
  IconDashboard,
  IconEditor,
  IconMonitor,
  IconProcessing,
  IconRoutes,
  IconSample,
  IconStudyDesign,
} from "./icons";

export type ProsecnurModuleSlug =
  | "editor-xlsform"
  | "procesamiento"
  | "dashboard"
  | "hojas-ruta"
  | "calc-muestra"
  | "plan-trabajo"
  | "diseno-estudio"
  | "recopiladores"
  | "monitoreo";

export type ProsecnurModuleTone = {
  accent: string;
  accentSoft: string;
  accentBorder: string;
};

export type ProsecnurModuleMeta = {
  slug: ProsecnurModuleSlug;
  title: string;
  shortLabel: string;
  tagline: string;
  blurb: string;
  features: string[];
  icon: LucideIcon;
  tone: ProsecnurModuleTone;
  to?: string;
};

export type ActiveProsecnurModuleMeta = ProsecnurModuleMeta & { to: string };

export const MODULE_TONES: Record<ProsecnurModuleSlug, ProsecnurModuleTone> = {
  "editor-xlsform": {
    accent: "var(--pulso-module-editor)",
    accentSoft: "var(--pulso-module-editor-soft)",
    accentBorder: "var(--pulso-module-editor-border)",
  },
  procesamiento: {
    accent: "var(--pulso-module-processing)",
    accentSoft: "var(--pulso-module-processing-soft)",
    accentBorder: "var(--pulso-module-processing-border)",
  },
  dashboard: {
    accent: "var(--pulso-module-dashboard)",
    accentSoft: "var(--pulso-module-dashboard-soft)",
    accentBorder: "var(--pulso-module-dashboard-border)",
  },
  "hojas-ruta": {
    accent: "var(--pulso-module-routes)",
    accentSoft: "var(--pulso-module-routes-soft)",
    accentBorder: "var(--pulso-module-routes-border)",
  },
  "calc-muestra": {
    accent: "var(--pulso-module-sample)",
    accentSoft: "var(--pulso-module-sample-soft)",
    accentBorder: "var(--pulso-module-sample-border)",
  },
  "plan-trabajo": {
    accent: "var(--pulso-module-workplan)",
    accentSoft: "var(--pulso-module-workplan-soft)",
    accentBorder: "var(--pulso-module-workplan-border)",
  },
  "diseno-estudio": {
    accent: "var(--pulso-module-encyclopedia)",
    accentSoft: "var(--pulso-module-encyclopedia-soft)",
    accentBorder: "var(--pulso-module-encyclopedia-border)",
  },
  recopiladores: {
    accent: "var(--pulso-module-collectors)",
    accentSoft: "var(--pulso-module-collectors-soft)",
    accentBorder: "var(--pulso-module-collectors-border)",
  },
  monitoreo: {
    accent: "var(--pulso-module-monitoring)",
    accentSoft: "var(--pulso-module-monitoring-soft)",
    accentBorder: "var(--pulso-module-monitoring-border)",
  },
};

export const PROSECNUR_MODULES: ProsecnurModuleMeta[] = [
  {
    slug: "diseno-estudio",
    title: "Bitácora",
    shortLabel: "Bitácora",
    tagline: "Bitácora, cronograma y calendario del estudio",
    blurb:
      "Registro operativo del estudio en un solo lugar: decisiones, riesgos, bloqueos y avances, con el cronograma de actividades y entregables organizado en un calendario mensual.",
    features: [
      "Registro editable por módulo, decisión, riesgo o avance",
      "Cronograma con diagrama de Gantt e hitos",
      "Calendario mensual de actividades y entregables",
      "Importación de cronogramas en Excel",
      "Exportación del plan a formato XLSX",
    ],
    icon: IconStudyDesign,
    tone: MODULE_TONES["diseno-estudio"],
    to: "/bitacora",
  },
  {
    slug: "calc-muestra",
    title: "Cálculo de muestra y marco muestral",
    shortLabel: "Cálculo de muestra",
    tagline: "Marco muestral, escenarios y selección de unidades",
    blurb:
      "Construcción del marco muestral, cálculo de escenarios de tamaño y selección de unidades —estudiantes, cursos-horario, actores, manzanas o viviendas—. El plan resultante se enlaza con Monitoreo para el seguimiento de campo.",
    features: [
      "Construcción y auditoría del marco muestral",
      "Escenarios de tamaño, cuotas, estratos y conglomerados",
      "Selección aleatoria, sistemática o por reglas operativas",
      "Procedimientos por estudiantes, cursos-horario, actores y territorio",
      "Reporte metodológico y enlace con Monitoreo",
    ],
    icon: IconSample,
    tone: MODULE_TONES["calc-muestra"],
    to: "/calc-muestra",
  },
  {
    slug: "editor-xlsform",
    title: "Editor de formularios",
    shortLabel: "Formularios",
    tagline: "Diseño, importación y conversión de cuestionarios",
    blurb:
      "Construcción de cuestionarios desde cero, edición de instrumentos existentes y conversión de formularios de SurveyMonkey al formato XLSForm.",
    features: [
      "Construcción con asistente visual",
      "Importación y edición de un XLSX existente",
      "Conversión de cuestionarios de SurveyMonkey",
      "Asistente de lógica y saltos condicionales",
      "Diagnóstico del instrumento en tiempo real",
    ],
    icon: IconEditor,
    tone: MODULE_TONES["editor-xlsform"],
    to: "/editor-xlsform",
  },
  {
    slug: "hojas-ruta",
    title: "Hojas de ruta para campo",
    shortLabel: "Hojas de ruta",
    tagline: "Cuotas, rutas y cartografía para el equipo de campo",
    blurb:
      "Hojas de ruta imprimibles para el equipo de campo: cuotas por conglomerado, rutas de visita y puntos de muestra georreferenciados, consolidados en un paquete listo para impresión.",
    features: [
      "Cuotas por conglomerado (UPM)",
      "Rutas de visita imprimibles",
      "Puntos de muestra georreferenciados",
      "Validación de territorio (UBIGEO)",
      "Paquete de PDF listo para impresión",
    ],
    icon: IconRoutes,
    tone: MODULE_TONES["hojas-ruta"],
    to: "/hojas-ruta",
  },
  {
    slug: "recopiladores",
    title: "Fichas QR para cursos-horario",
    shortLabel: "Fichas QR",
    tagline: "Material imprimible para intervenciones por cursos-horario",
    blurb:
      "Genera fichas imprimibles con código QR, enlace de Kobo y los datos de aplicación a partir del plan de cursos-horario. Articula la coordinación docente con el monitoreo de la intervención.",
    features: [
      "Una ficha por curso-horario del plan",
      "QR, enlace y datos del curso en una sola hoja",
      "Vista previa previa a la impresión o consolidación",
      "Agrupación por facultad, selección o estado de enlace",
      "Devolución de enlaces al monitoreo de cursos-horario",
    ],
    icon: IconCollector,
    tone: MODULE_TONES.recopiladores,
    to: "/recopiladores",
  },
  {
    slug: "monitoreo",
    title: "Monitoreo de campo",
    shortLabel: "Monitoreo",
    tagline: "Seguimiento del trabajo de campo",
    blurb:
      "Seguimiento del trabajo de campo a partir de Kobo y SurveyMonkey: cumplimiento de metas, control de calidad, producción y supervisión durante el levantamiento.",
    features: [
      "Sincronización con Kobo y SurveyMonkey",
      "Cumplimiento de metas por variables de control",
      "Detección de inconsistencias y tiempos atípicos",
      "Muestra para supervisión telefónica",
    ],
    icon: IconMonitor,
    tone: MODULE_TONES.monitoreo,
    to: "/monitoreo",
  },
  {
    slug: "procesamiento",
    title: "Procesamiento",
    shortLabel: "Procesamiento",
    tagline: "Carga, validación, codificación, análisis y reporte",
    blurb:
      "Procesamiento posterior al levantamiento: carga y normalización de bases multibase, validación y limpieza, codificación de preguntas abiertas, analítica y generación de reportes en PowerPoint y Word.",
    features: [
      "Carga y normalización multibase",
      "Validación, reglas y decisiones de limpieza",
      "Codificación de respuestas abiertas",
      "Codebook, frecuencias, cruces y dimensiones",
      "Reportes y gráficos en PowerPoint y Word",
    ],
    icon: IconProcessing,
    tone: MODULE_TONES.procesamiento,
    to: "/procesamiento",
  },
  {
    slug: "dashboard",
    title: "Dashboard interactivo",
    shortLabel: "Dashboard",
    tagline: "Exploración de resultados, cruces y base de datos",
    blurb:
      "Tablero interactivo de resultados como entregable final: resumen por sección, cruces de variables y base de datos consultable, con identidad visual personalizable.",
    features: [
      "Resumen por sección del cuestionario",
      "Cruces bivariados con filtros",
      "Base de datos consultable y descargable",
      "Logo, paleta y título personalizables",
      "Exportación como HTML autosuficiente (WebR)",
    ],
    icon: IconDashboard,
    tone: MODULE_TONES.dashboard,
    to: "/tablero",
  },
];

// Cronograma se fusionó dentro de Bitácora; ya no hay módulos secundarios.
export const PROSECNUR_PRIMARY_MODULES: ProsecnurModuleMeta[] = PROSECNUR_MODULES;

export const PROSECNUR_ACTIVE_MODULES: ActiveProsecnurModuleMeta[] =
  PROSECNUR_MODULES.filter(hasModuleRoute);

export const PROSECNUR_PRIMARY_ACTIVE_MODULES: ActiveProsecnurModuleMeta[] =
  PROSECNUR_PRIMARY_MODULES.filter(hasModuleRoute);

export function hasModuleRoute(
  module: ProsecnurModuleMeta,
): module is ActiveProsecnurModuleMeta {
  return typeof module.to === "string" && module.to.length > 0;
}

export function moduleChromeVars(module: ProsecnurModuleMeta): CSSProperties {
  return {
    "--module-accent": module.tone.accent,
    "--module-accent-soft": module.tone.accentSoft,
    "--module-accent-border": module.tone.accentBorder,
  } as CSSProperties;
}

export function homeModuleVars(module: ProsecnurModuleMeta): CSSProperties {
  return {
    "--home-mod-accent": module.tone.accent,
    "--home-mod-accent-soft": module.tone.accentSoft,
    "--home-mod-accent-border": module.tone.accentBorder,
  } as CSSProperties;
}
