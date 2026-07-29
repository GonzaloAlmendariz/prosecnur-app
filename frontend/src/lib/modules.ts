import type { CSSProperties } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Link2,
  ListChecks,
  MapPinned,
  Network,
  PhoneCall,
  PlugZap,
  Route,
  Search,
  ShieldAlert,
  Table2,
  Shuffle,
  Target,
  type LucideIcon,
} from "../vendor/lucide-react";
import {
  IconBranching,
  IconChecklist,
  IconCollector,
  IconDashboard,
  IconEditor,
  IconEncyclopedia,
  IconGpsValid,
  IconMonitor,
  IconOpen,
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

export type ProsecnurNavigationLayoutPolicy = "viewport" | "legacy-scroll";

export type ProsecnurNavigationLeafMeta = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  to: string;
  layoutPolicy: ProsecnurNavigationLayoutPolicy;
};

export type ProsecnurModuleSectionMeta = ProsecnurNavigationLeafMeta & {
  tabs?: readonly ProsecnurNavigationLeafMeta[];
};

/**
 * Un **modo** es una variante del módulo que reescribe su juego de secciones.
 * Solo algunos módulos tienen modos y el modo activo lo determina el estudio
 * del proyecto, no un click: por eso no se navega entre modos, se aterriza en
 * el que corresponde. Jerarquía completa en `lib/navegacion/direccion.ts`.
 */
export type ProsecnurModuleModoMeta = {
  id: string;
  label: string;
  sections: readonly ProsecnurModuleSectionMeta[];
};

export type ResolvedProsecnurNavigationItem = ProsecnurNavigationLeafMeta & {
  lockedReason?: string;
};

export type ProsecnurNavigationLandingKind = "section" | "entrypoint";

/**
 * Cómo se comporta el chrome de un módulo.
 *
 * Cuatro perillas y una escotilla, deliberadamente pocas. El ADR 0042 pide que
 * las variaciones estén «declaradas en el manifiesto, nunca ad-hoc en el
 * page-file», y la lección de la divergencia anterior es que cada perilla que
 * existe se usa: cuando la banda tenía `--command-bar-accent-mix`, cinco
 * módulos eligieron cinco intensidades distintas. Por eso no hay perilla de
 * alto, de radio ni de mezcla de acento: esos salen del token, siempre.
 */
export type ProsecnurModuleChromeMeta = {
  /**
   * Numerar las secciones. Hoy ningún módulo lo pide: los numerales costaban
   * ~22px por píldora y ese ancho es justo lo que el rail necesita para caber
   * junto a los indicadores de los lados. El orden de un pipeline ya se lee de
   * izquierda a derecha.
   */
  progreso: "none" | "numbered";
  densidad: "normal" | "compact";
  /** El módulo tiene rail de pestañas (tercer nivel) además de secciones. */
  rail: boolean;
  /**
   * Quién dibuja la banda. `shell` es la familia Procesamiento, cuyas secciones
   * son rutas hermanas y comparten una sola barra montada en el layout: si cada
   * página dibujara la suya habría dos bandas, que es lo que pasaba.
   */
  chromeOwner: "page" | "shell";
  /**
   * Excepción a la fila única, con su razón y el ADR que la respalda. Es la
   * única vía legítima para que un módulo se salga del canon, y existe para que
   * la excepción sea auditable en vez de ser deriva: el detector verifica que el
   * ADR citado exista de verdad.
   */
  chromeExcepcion?: {
    adr: string;
    motivo: string;
  };
};

export const PROSECNUR_NAVIGATION_CONTRACT = {
  version: 3,
  grammar: "modulo/modo/seccion/pestana/panel",
  coverage: "primary-routes-v1",
  modosCoverage: "monitoring-profiles-v1+calc-muestra-v1",
  tabsCoverage: "hojas-ruta-v1",
  shellCoverage: "hojas-ruta-v1",
  consumableByShell: true,
  addressable: true,
} as const;

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
  landingKind: ProsecnurNavigationLandingKind;
  chrome: ProsecnurModuleChromeMeta;
  sections: readonly ProsecnurModuleSectionMeta[];
  modos?: readonly ProsecnurModuleModoMeta[];
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
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: false,
      chromeOwner: "page",
    },
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
    landingKind: "section",
    sections: [
      {
        id: "bitacora",
        label: "Bitácora",
        icon: IconStudyDesign,
        to: "/bitacora",
        layoutPolicy: "viewport",
      },
      {
        id: "cronograma",
        label: "Cronograma",
        icon: IconWorkPlan,
        to: "/bitacora?seccion=cronograma",
        layoutPolicy: "viewport",
      },
      {
        id: "calendario",
        label: "Calendario",
        icon: CalendarDays,
        to: "/bitacora?seccion=calendario",
        layoutPolicy: "viewport",
      },
      {
        id: "canvas",
        label: "Lienzo",
        icon: Network,
        to: "/bitacora?seccion=canvas",
        layoutPolicy: "viewport",
      },
    ],
  },
  {
    slug: "calc-muestra",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: true,
      chromeOwner: "page",
    },
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
    landingKind: "section",
    sections: [
      {
        id: "calc-muestra",
        label: "Cálculo de muestra",
        icon: IconSample,
        to: "/calc-muestra",
        layoutPolicy: "viewport",
      },
    ],
    // La "mesa" del módulo es un MODO de la gramática: lo determina el estudio
    // del proyecto, no un click, y reescribe el juego de secciones. Declararlo
    // aquí es lo que permite que `useSeccion` resuelva el default por modo y que
    // la dirección sobreviva a un enlace pegado. El catálogo de PESTAÑAS se
    // queda en la feature (`universidad/universidadTabs.ts`), que ya resuelve
    // sus alias históricos: duplicarlo aquí crearía dos fuentes que derivan.
    modos: [
      {
        id: "opinion-universitaria",
        label: "Muestra de cursos-horario",
        sections: [
          { id: "definicion", label: "Datos", icon: IconStudyDesign, to: "/calc-muestra?modo=opinion-universitaria&seccion=definicion", layoutPolicy: "viewport" },
          { id: "marco", label: "Marco", icon: ClipboardList, to: "/calc-muestra?modo=opinion-universitaria&seccion=marco", layoutPolicy: "viewport" },
          { id: "calculo", label: "Cálculo", icon: IconSample, to: "/calc-muestra?modo=opinion-universitaria&seccion=calculo", layoutPolicy: "viewport" },
          { id: "aulas", label: "Selección", icon: Shuffle, to: "/calc-muestra?modo=opinion-universitaria&seccion=aulas", layoutPolicy: "viewport" },
          { id: "salidas", label: "Entrega", icon: Route, to: "/calc-muestra?modo=opinion-universitaria&seccion=salidas", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "marco-disponible",
        label: "Muestra general",
        sections: [
          { id: "marco", label: "Marco", icon: IconStudyDesign, to: "/calc-muestra?modo=marco-disponible&seccion=marco", layoutPolicy: "viewport" },
          { id: "metodo", label: "Método", icon: ListChecks, to: "/calc-muestra?modo=marco-disponible&seccion=metodo", layoutPolicy: "viewport" },
          { id: "resultados", label: "Resultados", icon: BarChart3, to: "/calc-muestra?modo=marco-disponible&seccion=resultados", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "acreditacion",
        label: "Acreditación",
        sections: [
          { id: "actores", label: "Actores", icon: ClipboardList, to: "/calc-muestra?modo=acreditacion&seccion=actores", layoutPolicy: "viewport" },
          { id: "contexto", label: "Contexto", icon: IconStudyDesign, to: "/calc-muestra?modo=acreditacion&seccion=contexto", layoutPolicy: "viewport" },
          { id: "resultados", label: "Resultados", icon: BarChart3, to: "/calc-muestra?modo=acreditacion&seccion=resultados", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "territorial-handoff",
        label: "Territorial",
        sections: [
          { id: "hojas-ruta", label: "Diseño de rutas", icon: MapPinned, to: "/calc-muestra?modo=territorial-handoff&seccion=hojas-ruta", layoutPolicy: "viewport" },
        ],
      },
      {
        // El selector de tipo de estudio. Es un modo real —tiene su propia
        // sección— y no un estado vacío: se aterriza en él cuando el proyecto
        // todavía no declaró qué muestra necesita.
        id: "sin-definir",
        label: "Tipo de estudio",
        sections: [
          { id: "pathways", label: "Tipo de estudio", icon: IconSample, to: "/calc-muestra?seccion=pathways", layoutPolicy: "viewport" },
        ],
      },
    ],
  },
  {
    slug: "editor-xlsform",
    chrome: {
      progreso: "none",
      densidad: "compact",
      rail: true,
      chromeOwner: "page",
      chromeExcepcion: {
        adr: "0042-chrome-modulo-uniforme-topbar.md",
        motivo:
          "Su banda no cabe en una fila: selector de formulario, tres metricas, " +
          "dos chips de estado, el toggle Constructor/Hojas, «Mas vistas», el chip " +
          "de avisos y seis acciones. Reducirla exige decidir que se recoge, y esa " +
          "es una decision de producto, no de layout. Conserva el material, el " +
          "radio, el acento y los estados del canon.",
      },
    },
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
    landingKind: "section",
    sections: [
      {
        id: "formularios",
        label: "Formularios",
        icon: IconEditor,
        to: "/editor-xlsform",
        layoutPolicy: "viewport",
      },
    ],
  },
  {
    slug: "hojas-ruta",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: false,
      chromeOwner: "page",
    },
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
    landingKind: "entrypoint",
    sections: [
      {
        id: "territorio",
        label: "Territorio",
        icon: MapPinned,
        to: "/hojas-ruta?seccion=territorio",
        layoutPolicy: "viewport",
      },
      {
        id: "poblacion",
        label: "Población",
        icon: BarChart3,
        to: "/hojas-ruta?seccion=poblacion",
        layoutPolicy: "viewport",
      },
      {
        id: "muestra",
        label: "Muestra",
        icon: Target,
        to: "/hojas-ruta?seccion=muestra",
        layoutPolicy: "viewport",
      },
      {
        id: "manzanas",
        label: "Manzanas",
        icon: Shuffle,
        to: "/hojas-ruta?seccion=manzanas",
        layoutPolicy: "viewport",
      },
      {
        id: "entrega",
        label: "Entrega",
        icon: FileText,
        to: "/hojas-ruta?seccion=entrega",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "cuotas",
            label: "Cuotas",
            icon: BarChart3,
            to: "/hojas-ruta?seccion=entrega&pestana=cuotas",
            layoutPolicy: "viewport",
          },
          {
            id: "titulares",
            label: "Titulares",
            icon: MapPinned,
            to: "/hojas-ruta?seccion=entrega&pestana=titulares",
            layoutPolicy: "viewport",
          },
          {
            id: "reemplazos",
            label: "Reemplazos",
            icon: Shuffle,
            to: "/hojas-ruta?seccion=entrega&pestana=reemplazos",
            layoutPolicy: "viewport",
          },
        ],
      },
    ],
  },
  {
    slug: "recopiladores",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: true,
      chromeOwner: "page",
    },
    title: "Recopiladores",
    shortLabel: "Recopiladores",
    tagline: "Canales, accesos y materiales de recolección",
    blurb:
      "Prepara el despliegue de la recolección: toma el plan ya decidido y la revisión publicada del instrumento, y produce los accesos, los enlaces con QR y los materiales de aplicación que el campo necesita, con trazabilidad de qué unidad recibió qué.",
    features: [
      "Un acceso trazable por unidad de aplicación",
      "Enlace personalizado y QR sin pedir códigos al encuestado",
      "Materiales imprimibles con los datos de la unidad",
      "Agrupación por bloque de reparto para el trabajo de campo",
      "Entrega auditable de los accesos a Monitoreo",
    ],
    icon: IconCollector,
    tone: MODULE_TONES.recopiladores,
    to: "/recopiladores",
    landingKind: "section",
    // Las cuatro secciones canónicas del ADR 0046. El recorrido vive aquí y solo
    // aquí: la página no vuelve a dibujar esta secuencia como barra de pasos.
    sections: [
      {
        id: "plan-recoleccion",
        // Plan es el aterrizaje del módulo: su `to` es la ruta desnuda, como en
        // el resto de módulos con landing de sección.
        label: "Plan",
        icon: ClipboardList,
        to: "/recopiladores",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "unidades",
            label: "Unidades",
            icon: ClipboardList,
            to: "/recopiladores?seccion=plan-recoleccion&pestana=unidades",
            layoutPolicy: "viewport",
          },
        ],
      },
      {
        id: "accesos",
        label: "Accesos",
        icon: Link2,
        to: "/recopiladores?seccion=accesos",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "canales",
            label: "Canales",
            icon: Link2,
            to: "/recopiladores?seccion=accesos&pestana=canales",
            layoutPolicy: "viewport",
          },
          {
            id: "vinculacion",
            label: "Vinculación",
            icon: Search,
            to: "/recopiladores?seccion=accesos&pestana=vinculacion",
            layoutPolicy: "viewport",
          },
        ],
      },
      {
        id: "materiales",
        label: "Materiales",
        icon: IconCollector,
        to: "/recopiladores?seccion=materiales",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "vista",
            label: "Vista previa",
            icon: IconCollector,
            to: "/recopiladores?seccion=materiales&pestana=vista",
            layoutPolicy: "viewport",
          },
          {
            id: "paquetes",
            label: "Paquetes",
            icon: Archive,
            to: "/recopiladores?seccion=materiales&pestana=paquetes",
            layoutPolicy: "viewport",
          },
        ],
      },
      {
        id: "entrega-campo",
        label: "Entrega",
        icon: CheckCircle2,
        to: "/recopiladores?seccion=entrega-campo",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "traspaso",
            label: "Monitoreo",
            icon: CalendarDays,
            to: "/recopiladores?seccion=entrega-campo&pestana=traspaso",
            layoutPolicy: "viewport",
          },
        ],
      },
    ],
  },
  {
    slug: "monitoreo",
    chrome: {
      // Sus secciones no son pasos: se visitan en cualquier orden segun lo que
      // el campo necesite hoy. Numerarlas prometeria una secuencia que no hay.
      progreso: "none",
      densidad: "normal",
      rail: true,
      chromeOwner: "page",
    },
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
    landingKind: "section",
    sections: [
      {
        id: "monitoreo",
        label: "Monitoreo",
        icon: IconMonitor,
        to: "/monitoreo",
        layoutPolicy: "viewport",
      },
    ],
    modos: [
      {
        id: "acreditacion",
        label: "Acreditación",
        sections: [
          { id: "fuentes", label: "Fuentes", icon: PlugZap, to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo operativo", icon: ListChecks, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", icon: Search, to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
          { id: "telefonico", label: "Monitoreo telefónico", icon: PhoneCall, to: "/monitoreo?seccion=telefonico", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "telefonico",
        label: "Telefónico",
        sections: [
          { id: "fuentes", label: "Fuentes", icon: PlugZap, to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo operativo", icon: ListChecks, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "telefonico", label: "Llamadas", icon: PhoneCall, to: "/monitoreo?seccion=telefonico", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", icon: Search, to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "territorial",
        label: "Territorial",
        sections: [
          { id: "fuentes", label: "Fuente", icon: PlugZap, to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "UMPs", icon: Route, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "calidad", label: "Validación", icon: ShieldAlert, to: "/monitoreo?seccion=calidad", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas internas", icon: Search, to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance territorial", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
          { id: "ocurrencias", label: "Ocurrencias de campo", icon: ClipboardCheck, to: "/monitoreo?seccion=ocurrencias", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "aulas",
        label: "Cursos-horario",
        sections: [
          { id: "fuentes", label: "Fuentes", icon: PlugZap, to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Agenda de cursos-horario", icon: CalendarRange, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
          { id: "calidad", label: "Validación", icon: ShieldAlert, to: "/monitoreo?seccion=calidad", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", icon: Search, to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
        ],
      },
    ],
  },
  {
    slug: "procesamiento",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: true,
      // Sus secciones son rutas hermanas (/carga, /validacion...) y comparten
      // una sola barra montada en el layout. Cuando cada pagina dibujaba tambien
      // la suya, la familia arrastraba dos bandas y ~100px de chrome en 6 rutas.
      chromeOwner: "shell",
    },
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
    landingKind: "entrypoint",
    sections: [
      {
        id: "carga",
        label: "Carga",
        icon: IconOpen,
        to: "/carga",
        layoutPolicy: "viewport",
        tabs: [
          {
            id: "plan",
            label: "Plan",
            icon: ClipboardCheck,
            to: "/carga?pestana=plan",
            layoutPolicy: "viewport",
          },
          {
            id: "fuentes",
            label: "Fuentes",
            icon: PlugZap,
            to: "/carga?pestana=fuentes",
            layoutPolicy: "viewport",
          },
          {
            id: "revision",
            label: "Revisión",
            icon: ShieldAlert,
            to: "/carga?pestana=revision",
            layoutPolicy: "viewport",
          },
          {
            id: "estructura",
            label: "Estructura",
            icon: ListChecks,
            to: "/carga?pestana=estructura",
            layoutPolicy: "viewport",
          },
          {
            id: "datos",
            label: "Datos",
            icon: Table2,
            to: "/carga?pestana=datos",
            layoutPolicy: "viewport",
          },
        ],
      },
      {
        id: "validacion",
        label: "Validación",
        icon: IconGpsValid,
        to: "/validacion",
        layoutPolicy: "viewport",
      },
      {
        id: "codificacion",
        label: "Codificación",
        icon: IconChecklist,
        to: "/codificacion",
        layoutPolicy: "viewport",
      },
      {
        id: "analitica",
        label: "Analítica",
        icon: IconBranching,
        to: "/analitica",
        layoutPolicy: "viewport",
      },
      {
        id: "graficos",
        label: "Gráficos",
        icon: IconDashboard,
        to: "/graficos",
        layoutPolicy: "viewport",
      },
    ],
  },
  {
    slug: "dashboard",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: true,
      chromeOwner: "page",
      chromeExcepcion: {
        adr: "0042-chrome-modulo-uniforme-topbar.md",
        motivo:
          "El tablero publicado es un artefacto que ve el cliente y lleva su " +
          "propia cabecera de identidad, que no es chrome de la app. Conserva su " +
          "capa de nombres `dash-*` (excepcion ya documentada en " +
          "docs/ui-layout-grammar.md) con los valores reasignados a los tokens " +
          "compartidos, asi que no divergen aunque se llamen distinto.",
      },
    },
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
    landingKind: "section",
    sections: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: IconDashboard,
        to: "/tablero",
        layoutPolicy: "viewport",
      },
    ],
  },
];

export const PROSECNUR_GLOBAL_NAV_ITEMS: readonly ProsecnurNavigationLeafMeta[] = [
  {
    id: "enciclopedia",
    label: "Enciclopedia metodológica",
    shortLabel: "Enciclopedia",
    icon: IconEncyclopedia,
    to: "/enciclopedia",
    layoutPolicy: "legacy-scroll",
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
