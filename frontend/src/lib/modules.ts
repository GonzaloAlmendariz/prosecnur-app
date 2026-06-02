import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  IconCollector,
  IconDashboard,
  IconEditor,
  IconEncyclopedia,
  IconMonitor,
  IconProcessing,
  IconRoutes,
  IconSample,
} from "./icons";

export type ProsecnurModuleSlug =
  | "editor-xlsform"
  | "procesamiento"
  | "dashboard"
  | "hojas-ruta"
  | "calc-muestra"
  | "enciclopedia"
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
  enciclopedia: {
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
    slug: "editor-xlsform",
    title: "Editor de formularios",
    shortLabel: "Editor",
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
    slug: "procesamiento",
    title: "Procesamiento y reportes",
    shortLabel: "Proceso",
    tagline: "Pipeline completo en 5 fases",
    blurb:
      "Flujo completo de 5 fases: carga de data, validación, codificación de abiertas, preparación analítica y generación de reportes PPT/Word listos para entregar.",
    features: [
      "Carga y normalización de data + XLSForm",
      "Validación con reglas y limpieza personalizada",
      "Codificación de respuestas abiertas",
      "Frecuencias, cruces y dimensiones",
      "Reportes en PowerPoint y Word",
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
  {
    slug: "hojas-ruta",
    title: "Hojas de ruta para campo",
    shortLabel: "Rutas",
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
    slug: "calc-muestra",
    title: "Cálculo de muestra para propuestas",
    shortLabel: "Muestra",
    tagline: "Diseño metodológico multi-componente",
    blurb:
      "Calcula el diseño muestral de una propuesta: cada actor puede tener su propia técnica, el marco se distingue en tres niveles (bruto, validado, contactable) y el sistema bloquea margen de error cuando el diseño no lo sostiene. Para el seguimiento del trabajo de campo usar el módulo de Monitoreo.",
    features: [
      "Cuatro técnicas iniciales: conglomerados multietápico, intención censal, cuotas y listado externo",
      "Plantilla de acreditación universitaria con reglas por umbral de marco",
      "Bloqueo automático de margen de error en diseños no inferenciales",
      "Dos fases: estimación preliminar y diseño validado",
      "Reporte metodológico generado en Quarto",
    ],
    icon: IconSample,
    tone: MODULE_TONES["calc-muestra"],
    to: "/calc-muestra",
  },
  {
    slug: "enciclopedia",
    title: "Enciclopedia metodológica",
    shortLabel: "Guía",
    tagline: "Manual técnico de métodos estadísticos de muestreo",
    blurb:
      "Catálogo técnico de los métodos estadísticos de muestreo cuantitativo. Cada ficha documenta definición formal, supuestos, fórmulas aplicables, escenarios de uso, decisiones técnicas y trade-offs frente a alternativas. Cross-link bidireccional con el módulo de Cálculo.",
    features: [
      "Fichas técnicas por método (probabilísticas · operativas · no probabilísticas)",
      "Definiciones formales, supuestos y fórmulas con referencias bibliográficas",
      "Decisiones técnicas a considerar y variantes operativas",
      "Filtros por naturaleza inferencial, unidad, marco y modalidad",
      "CTA 'Aplicar esta metodología' que abre el Cálculo configurado",
    ],
    icon: IconEncyclopedia,
    tone: MODULE_TONES.enciclopedia,
    to: "/enciclopedia",
  },
  {
    slug: "recopiladores",
    title: "Generador de recopiladores",
    shortLabel: "QR",
    tagline: "Fichas QR + enlaces a KoboCollect",
    blurb:
      "Genera fichas imprimibles con códigos QR y enlaces personalizados a KoboCollect — una por enumerador, conglomerado o punto de muestreo para autenticar la captura.",
    features: [
      "Una ficha por enumerador, conglomerado o punto",
      "QR + enlace personalizado a KoboCollect",
      "Autenticación de captura en campo",
      "Layout imprimible y compartible",
    ],
    icon: IconCollector,
    tone: MODULE_TONES.recopiladores,
  },
  {
    slug: "monitoreo",
    title: "Monitoreo de campo",
    shortLabel: "Campo",
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
];

export const PROSECNUR_ACTIVE_MODULES: ActiveProsecnurModuleMeta[] =
  PROSECNUR_MODULES.filter(hasModuleRoute);

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
