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
  IconWorkPlan,
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
    title: "Diseño del estudio",
    shortLabel: "Diseño",
    tagline: "Bitácora viva y protocolo metodológico",
    blurb:
      "Expediente profesional del proyecto: lee el avance de todos los módulos, consolida evidencia metodológica, muestra riesgos de completitud y permite registrar notas de bitácora durante el trabajo.",
    features: [
      "Bitácora editable por módulo, decisión, riesgo o avance",
      "Lectura viva de Carga, Validación, Analítica, Campo y Monitoreo",
      "Semáforo profesional de fuentes, evidencias y próximos pasos",
      "Resumen metodológico para ficha técnica y entregables",
      "Biblioteca metodológica integrada como referencia secundaria",
    ],
    icon: IconStudyDesign,
    tone: MODULE_TONES["diseno-estudio"],
    to: "/diseno-estudio",
  },
  {
    slug: "plan-trabajo",
    title: "Cronograma del proyecto",
    shortLabel: "Cronograma",
    tagline: "Actividades, hitos y ventanas sincronizadas",
    blurb:
      "Importa cronogramas operativos, normaliza actividades, responsables, productos e hitos, y compara lo planificado con la evidencia real de Monitoreo, Reportes y otros módulos.",
    features: [
      "Importación de cronogramas Excel con grilla diaria",
      "Vista Gantt y edición de actividades clave",
      "Hitos de entrega y ventanas esperadas por módulo",
      "Exportación XLSX profesional",
      "Contrato síncrono con Monitoreo y Reportes",
    ],
    icon: IconWorkPlan,
    tone: MODULE_TONES["plan-trabajo"],
    to: "/plan-trabajo",
  },
  {
    slug: "calc-muestra",
    title: "Cálculo de muestra y marco muestral",
    shortLabel: "Cálculo de muestra",
    tagline: "Marcos, escenarios y selección de unidades",
    blurb:
      "Diseña el marco muestral, calcula escenarios y prepara la selección operativa de unidades: estudiantes, aulas, actores, manzanas, viviendas o marcos generales. Para el seguimiento del trabajo de campo, el plan se conecta con Monitoreo.",
    features: [
      "Construcción y auditoría del marco muestral",
      "Escenarios de n, cuotas, estratos y conglomerados",
      "Selección aleatoria, sistemática o por reglas operativas",
      "Rutas específicas para estudiantes, aulas, actores y territorio",
      "Reporte metodológico y conexión con Monitoreo",
    ],
    icon: IconSample,
    tone: MODULE_TONES["calc-muestra"],
    to: "/calc-muestra",
  },
  {
    slug: "editor-xlsform",
    title: "Editor de formularios",
    shortLabel: "Formularios",
    tagline: "Diseña, importa o traduce tu cuestionario",
    blurb:
      "Arma un formulario desde cero, importa uno existente para editarlo, o traduce automáticamente un cuestionario de SurveyMonkey al formato XLSForm.",
    features: [
      "Crear desde cero con asistente visual",
      "Importar XLSX existente y editar celdas",
      "Traducir cuestionarios de SurveyMonkey",
      "Wizard de lógica y saltos condicionales",
      "Diagnósticos del formulario en vivo",
    ],
    icon: IconEditor,
    tone: MODULE_TONES["editor-xlsform"],
    to: "/editor-xlsform",
  },
  {
    slug: "hojas-ruta",
    title: "Hojas de ruta para campo",
    shortLabel: "Hojas de ruta",
    tagline: "Cuotas, rutas y mapas para enumeradores",
    blurb:
      "Genera hojas de ruta imprimibles para enumeradores: cuotas por conglomerado, rutas de visita y puntos de muestra georeferenciados. Entrega un ZIP listo para impresión.",
    features: [
      "Cuotas por conglomerado (UMP)",
      "Rutas de visita imprimibles",
      "Puntos de muestra georeferenciados",
      "Validación de territorio (UBIGEO Lima)",
      "ZIP con PDFs listos para imprimir",
    ],
    icon: IconRoutes,
    tone: MODULE_TONES["hojas-ruta"],
    to: "/hojas-ruta",
  },
  {
    slug: "recopiladores",
    title: "Fichas QR para aulas",
    shortLabel: "Fichas QR",
    tagline: "Material imprimible para hostigamiento en aulas",
    blurb:
      "Convierte el plan de aulas del cálculo de muestra en fichas imprimibles con QR, enlace de Kobo y datos mínimos de aplicación. Sirve como puente operativo entre el estudio de hostigamiento, la coordinación docente y el monitoreo de aulas.",
    features: [
      "Una ficha por curso-horario del plan de aulas",
      "QR, enlace corto y datos de curso en una sola hoja",
      "Vista previa antes de imprimir o consolidar PDF/Word",
      "Agrupación por facultad, selección o estado de enlace",
      "Devolución de enlaces a Monitoreo de aplicación en aulas",
    ],
    icon: IconCollector,
    tone: MODULE_TONES.recopiladores,
    to: "/recopiladores",
  },
  {
    slug: "monitoreo",
    title: "Monitoreo de campo",
    shortLabel: "Monitoreo",
    tagline: "Tablero en vivo del avance de campo",
    blurb:
      "Tablero operativo del avance de campo desde Kobo y SurveyMonkey: metas, calidad, producción y supervisión durante la encuesta.",
    features: [
      "Sincronización con Kobo y SurveyMonkey",
      "Metas por variables de control",
      "Inconsistencias y tiempos atípicos",
      "Muestra para llamadas de supervisión",
    ],
    icon: IconMonitor,
    tone: MODULE_TONES.monitoreo,
    to: "/monitoreo",
  },
  {
    slug: "procesamiento",
    title: "Procesamiento",
    shortLabel: "Procesamiento",
    tagline: "Carga, valida, codifica, analiza y reporta",
    blurb:
      "Tramo de procesamiento posterior al levantamiento: carga bases recibidas o sincronizadas, normaliza el estudio multibase, valida y limpia, codifica abiertas, prepara analítica y genera gráficos PPT/Word.",
    features: [
      "Carga y normalización multibase",
      "Validación, reglas y decisiones de limpieza",
      "Codificación de respuestas abiertas",
      "Codebook, frecuencias, cruces y dimensiones",
      "Gráficos y reportes en PowerPoint y Word",
    ],
    icon: IconProcessing,
    tone: MODULE_TONES.procesamiento,
    to: "/procesamiento",
  },
  {
    slug: "dashboard",
    title: "Dashboard interactivo",
    shortLabel: "Dashboard",
    tagline: "Explora cruces, relaciones y base de datos",
    blurb:
      "Dashboard interactivo del cuestionario para entregar a tu cliente: resumen por sección, relaciones (cruces) y base de datos. Personaliza logo, paleta y título.",
    features: [
      "Resumen por sección del cuestionario",
      "Cruces 2D filtrados con semáforo",
      "Base de datos descargable",
      "Personaliza logo, paleta y título",
      "Exporta como HTML autosuficiente (WebR)",
    ],
    icon: IconDashboard,
    tone: MODULE_TONES.dashboard,
    to: "/tablero",
  },
];

export const PROSECNUR_PRIMARY_MODULES: ProsecnurModuleMeta[] =
  PROSECNUR_MODULES.filter((module) => module.slug !== "plan-trabajo");

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
