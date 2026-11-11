import type { CSSProperties } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  DatabaseZap,
  FileSpreadsheet,
  FileText,
  Hash,
  Link2,
  LayoutGrid,
  Layers,
  Mail,
  ListChecks,
  ListOrdered,
  MapPinned,
  PhoneCall,
  PlugZap,
  Route,
  Search,
  ShieldAlert,
  Table2,
  Shuffle,
  Target,
  Users,
  type LucideIcon,
} from "../vendor/lucide-react";
import {
  IconBranching,
  IconChecklist,
  IconCollector,
  IconDashboard,
  IconEditor,
  IconFieldKit,
  IconGpsValid,
  IconMonitor,
  IconOpen,
  IconProcessing,
  IconRoutes,
  IconSample,
  IconStudyDesign,
  IconTemplate,
} from "./icons";
import { MONITOREO_PESTANAS } from "./navegacion/catalogos/monitoreo";
import {
  CALC_MUESTRA_ACREDITACION_PESTANAS,
  CALC_MUESTRA_GENERAL_PESTANAS,
  CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
} from "./navegacion/catalogos/calcMuestra";
import { PROCESAMIENTO_PESTANAS } from "./navegacion/catalogos/procesamiento";
import { DASHBOARD_PESTANAS } from "./navegacion/catalogos/dashboard";
import { EDITOR_FORMULARIOS_PESTANAS } from "./navegacion/catalogos/editorFormularios";

export type ProsecnurModuleSlug =
  | "editor-xlsform"
  | "procesamiento"
  | "dashboard"
  | "hojas-ruta"
  | "calc-muestra"
  | "plan-trabajo"
  | "diseno-estudio"
  | "material-campo"
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
  /** `false`: identidad auditable sin prometer una URL de pestaña inexistente. */
  direccionPublicada?: boolean;
};

export type ProsecnurModuleSectionMeta = ProsecnurNavigationLeafMeta & {
  tabs?: readonly ProsecnurNavigationLeafMeta[];
  /**
   * Rótulo de la sección según una variante del modo que decide el estudio, no un
   * click: en Material territorial, el tipo de envío (`cuotas` → «Zonas»). La
   * dirección (`seccion=`) no cambia; sólo lo que se lee en la píldora.
   */
  labelsPorVariante?: Readonly<Record<string, string>>;
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

/**
 * Qué muestra la ruta del módulo (`to`):
 * - `section`: una de sus secciones, la que comparte esa ruta.
 * - `entrypoint`: la ruta no es de ninguna sección y la página resuelve cuál abrir
 *   (Hojas de ruta abre la sección por `?seccion=`).
 * - `overview`: una vista propia del módulo, que no es sección ni redirige. Es
 *   "Estado del estudio" en `/procesamiento` (ADR 0142, decisión D7).
 */
export type ProsecnurNavigationLandingKind = "section" | "entrypoint" | "overview";

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
  /** El módulo tiene rail de pestañas (cuarta dimensión) además de secciones. */
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
  modosCoverage: "monitoring-profiles-v1+calc-muestra-v1+material-campo-v1",
  tabsCoverage: "all-current-tabsets-v1",
  shellCoverage: "hojas-ruta-v1",
  consumableByShell: true,
  addressable: true,
} as const;

export type ProsecnurModuleMeta = {
  slug: ProsecnurModuleSlug;
  title: string;
  shortLabel: string;
  /** Nombre en la tarjeta del home cuando `shortLabel` lo recorta más de la
      cuenta. `shortLabel` sigue gobernando el rail y los tiles del chrome,
      donde el ancho sí manda; la tarjeta tiene sitio para el nombre entero. */
  cardTitle?: string;
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
  // ADR 0124: el Planner (antes Bitácora) dejó de ser módulo; el slug queda
  // por los .pulso que lo traen en sus módulos agregados.
  "diseno-estudio": {
    accent: "var(--pulso-module-encyclopedia)",
    accentSoft: "var(--pulso-module-encyclopedia-soft)",
    accentBorder: "var(--pulso-module-encyclopedia-border)",
  },
  // Musgo #4F752C (ADR 0108 §7, decisión dec-acento-material-campo-musgo).
  "material-campo": {
    accent: "var(--pulso-module-fieldkit)",
    accentSoft: "var(--pulso-module-fieldkit-soft)",
    accentBorder: "var(--pulso-module-fieldkit-border)",
  },
  monitoreo: {
    accent: "var(--pulso-module-monitoring)",
    accentSoft: "var(--pulso-module-monitoring-soft)",
    accentBorder: "var(--pulso-module-monitoring-border)",
  },
};

/** Hojas de ruta por UMP (aleatorio): el juego completo, con el sorteo de manzanas y la selección. */
const HOJAS_RUTA_SECCIONES_UMP: readonly ProsecnurModuleSectionMeta[] = [
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
    id: "seleccion",
    label: "Selección",
    icon: FileText,
    to: "/hojas-ruta?seccion=seleccion",
    layoutPolicy: "viewport",
    tabs: [
      {
        id: "cuotas",
        label: "Cuotas",
        icon: BarChart3,
        to: "/hojas-ruta?seccion=seleccion&pestana=cuotas",
        layoutPolicy: "viewport",
      },
      {
        id: "titulares",
        label: "Titulares",
        icon: MapPinned,
        to: "/hojas-ruta?seccion=seleccion&pestana=titulares",
        layoutPolicy: "viewport",
      },
      {
        id: "reemplazos",
        label: "Reemplazos",
        icon: Shuffle,
        to: "/hojas-ruta?seccion=seleccion&pestana=reemplazos",
        layoutPolicy: "viewport",
      },
      {
        // Cada UMP cruzada con las viviendas censales de su manzana.
        id: "revision",
        label: "Revisión",
        icon: ShieldAlert,
        to: "/hojas-ruta?seccion=seleccion&pestana=revision",
        layoutPolicy: "viewport",
      },
    ],
  },
];

export const PROSECNUR_MODULES: ProsecnurModuleMeta[] = [
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
      "Construcción del marco muestral, cálculo de escenarios de tamaño y selección de unidades —estudiantes, cursos-horario o actores—. El muestreo territorial aleatorio (zonas, manzanas y viviendas) se hace en Hojas de ruta. La selección pasa a Material de campo y las metas, a Monitoreo.",
    features: [
      "Construcción y auditoría del marco muestral",
      "Escenarios de tamaño, cuotas, estratos y conglomerados",
      "Selección aleatoria, sistemática o por reglas operativas",
      "Procedimientos por estudiantes, cursos-horario y actores",
      "Reporte metodológico; la selección pasa a Material y las metas a Monitoreo",
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
    // la dirección sobreviva a un enlace pegado. Las pestañas universitarias
    // vienen del mismo catálogo que consume su página; los alias históricos
    // siguen resolviéndose dentro de la feature.
    modos: [
      {
        id: "opinion-universitaria",
        label: "Muestra de cursos-horario",
        sections: [
          { id: "definicion", label: "Datos", icon: IconStudyDesign, to: "/calc-muestra?modo=opinion-universitaria&seccion=definicion", layoutPolicy: "viewport", tabs: CALC_MUESTRA_UNIVERSIDAD_PESTANAS.definicion },
          { id: "marco", label: "Marco", icon: ClipboardList, to: "/calc-muestra?modo=opinion-universitaria&seccion=marco", layoutPolicy: "viewport", tabs: CALC_MUESTRA_UNIVERSIDAD_PESTANAS.marco },
          { id: "calculo", label: "Cálculo", icon: IconSample, to: "/calc-muestra?modo=opinion-universitaria&seccion=calculo", layoutPolicy: "viewport", tabs: CALC_MUESTRA_UNIVERSIDAD_PESTANAS.calculo },
          { id: "aulas", label: "Selección", icon: Shuffle, to: "/calc-muestra?modo=opinion-universitaria&seccion=aulas", layoutPolicy: "viewport", tabs: CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas },
          { id: "salidas", label: "Entrega", icon: Route, to: "/calc-muestra?modo=opinion-universitaria&seccion=salidas", layoutPolicy: "viewport", tabs: CALC_MUESTRA_UNIVERSIDAD_PESTANAS.salidas },
        ],
      },
      {
        id: "marco-disponible",
        label: "Muestra general",
        sections: [
          { id: "marco", label: "Marco", icon: IconStudyDesign, to: "/calc-muestra?modo=marco-disponible&seccion=marco", layoutPolicy: "viewport", tabs: CALC_MUESTRA_GENERAL_PESTANAS.marco },
          { id: "metodo", label: "Método", icon: ListChecks, to: "/calc-muestra?modo=marco-disponible&seccion=metodo", layoutPolicy: "viewport", tabs: CALC_MUESTRA_GENERAL_PESTANAS.metodo },
          { id: "seleccion", label: "Selección", icon: Shuffle, to: "/calc-muestra?modo=marco-disponible&seccion=seleccion", layoutPolicy: "viewport", tabs: CALC_MUESTRA_GENERAL_PESTANAS.seleccion },
          { id: "resultados", label: "Resultados", icon: BarChart3, to: "/calc-muestra?modo=marco-disponible&seccion=resultados", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "acreditacion",
        label: "Acreditación",
        sections: [
          { id: "actores", label: "Actores", icon: ClipboardList, to: "/calc-muestra?modo=acreditacion&seccion=actores", layoutPolicy: "viewport" },
          { id: "contexto", label: "Contexto", icon: IconStudyDesign, to: "/calc-muestra?modo=acreditacion&seccion=contexto", layoutPolicy: "viewport" },
          { id: "seleccion", label: "Selección", icon: Shuffle, to: "/calc-muestra?modo=acreditacion&seccion=seleccion", layoutPolicy: "viewport", tabs: CALC_MUESTRA_ACREDITACION_PESTANAS.seleccion },
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
        // Con un formulario abierto: rail de pestañas (la biblioteca no lo lleva).
        tabs: EDITOR_FORMULARIOS_PESTANAS,
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
      "Muestreo territorial aleatorio: sortea zonas, manzanas y viviendas sobre la cartografía, arma cuotas y rutas por conglomerado y envía la selección a Material de campo, que imprime las hojas de zona. Monitoreo recibe las metas.",
    features: [
      "Cuotas por conglomerado (UPM)",
      "Rutas de visita por conglomerado",
      "Puntos de muestra georreferenciados",
      "Validación de territorio (UBIGEO)",
      "Envío de la selección a Material de campo",
    ],
    icon: IconRoutes,
    tone: MODULE_TONES["hojas-ruta"],
    to: "/hojas-ruta",
    landingKind: "entrypoint",
    sections: HOJAS_RUTA_SECCIONES_UMP,
    // ADR 0125 §2: el Planner fija el modo. Por cuotas no hay sorteo de manzanas: la cuarta sección es la
    // entrega de las zonas a Material (id `seleccion`, el canónico de la entrega; `entrega` es su alias viejo).
    modos: [
      { id: "ump", label: "Muestra por manzanas", sections: HOJAS_RUTA_SECCIONES_UMP },
      {
        id: "cuotas",
        label: "Muestra por cuotas",
        sections: [
          { id: "territorio", label: "Territorio", icon: MapPinned, to: "/hojas-ruta?modo=cuotas&seccion=territorio", layoutPolicy: "viewport" },
          { id: "poblacion", label: "Población", icon: BarChart3, to: "/hojas-ruta?modo=cuotas&seccion=poblacion", layoutPolicy: "viewport" },
          { id: "muestra", label: "Muestra", icon: Target, to: "/hojas-ruta?modo=cuotas&seccion=muestra", layoutPolicy: "viewport" },
          { id: "seleccion", label: "Entrega", icon: FileText, to: "/hojas-ruta?modo=cuotas&seccion=seleccion", layoutPolicy: "viewport" },
        ],
      },
    ],
  },
  {
    slug: "material-campo",
    chrome: {
      progreso: "none",
      densidad: "normal",
      rail: true,
      chromeOwner: "page",
    },
    title: "Material de campo",
    shortLabel: "Material",
    cardTitle: "Material de campo",
    tagline: "Fichas, accesos y paquetes",
    blurb:
      "Produce el material de campo de cada unidad que decidieron Cálculo de muestra u Hojas de ruta: accesos, fichas imprimibles, paquetes y las tablas de seguimiento en el Sheets del estudio, que campo llena al inicio. No hace seguimiento: entrega a Monitoreo, con constancia de qué recibió cada unidad.",
    features: [
      "Lista de unidades tomada de la muestra decidida",
      "Un acceso trazable por unidad",
      "Fichas imprimibles con los datos de cada unidad",
      "Paquetes agrupados para el reparto en campo",
      "Tablas de seguimiento en el Sheets del estudio",
      "Entrega registrada para Monitoreo",
    ],
    icon: IconFieldKit,
    tone: MODULE_TONES["material-campo"],
    to: "/material-campo",
    landingKind: "section",
    // ADR 0111: el módulo aterriza en la lista de campañas y el MODO es el tipo
    // de la campaña abierta (`?modo=aulas&campana=aulas.principal`). La sección
    // de primer nivel es la lista: es el landing, como «Monitoreo» lo es de su
    // módulo. `territorial` (ADR 0118, F2) se abre cuando Hojas de ruta envió su
    // muestra; antes aparece deshabilitado en «Nueva campaña» con su motivo.
    sections: [
      {
        id: "campanas",
        label: "Campañas",
        icon: Layers,
        to: "/material-campo",
        layoutPolicy: "viewport",
      },
    ],
    modos: [
      {
        // Las secciones del ADR 0108 §5, sin Catálogo › Correos: el correo es
        // una campaña propia. El recorrido vive aquí y solo aquí.
        id: "aulas",
        label: "Campo en aulas",
        sections: [
          {
            id: "unidades",
            label: "Unidades",
            icon: ClipboardList,
            to: "/material-campo?modo=aulas&seccion=unidades",
            layoutPolicy: "viewport",
            tabs: [
              { id: "lista", label: "Lista", icon: ClipboardList, to: "/material-campo?modo=aulas&seccion=unidades&pestana=lista", layoutPolicy: "viewport" },
              // De qué fuente sale la lista y qué cambió en ella (E1e).
              { id: "origen", label: "Origen", icon: DatabaseZap, to: "/material-campo?modo=aulas&seccion=unidades&pestana=origen", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "accesos",
            label: "Accesos",
            icon: IconCollector,
            to: "/material-campo?modo=aulas&seccion=accesos",
            layoutPolicy: "viewport",
            tabs: [
              { id: "canales", label: "Canales", icon: Link2, to: "/material-campo?modo=aulas&seccion=accesos&pestana=canales", layoutPolicy: "viewport" },
              { id: "vinculacion", label: "Vinculación", icon: Search, to: "/material-campo?modo=aulas&seccion=accesos&pestana=vinculacion", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "catalogo",
            label: "Catálogo",
            icon: IconTemplate,
            to: "/material-campo?modo=aulas&seccion=catalogo",
            layoutPolicy: "viewport",
            // Tipos es el aterrizaje de Catálogo: la galería de materiales con su
            // página real (ADR 0109 §3). El editor trabaja sobre el tipo en uso.
            tabs: [
              { id: "tipos", label: "Tipos", icon: LayoutGrid, to: "/material-campo?modo=aulas&seccion=catalogo&pestana=tipos", layoutPolicy: "viewport" },
              { id: "editor", label: "Editor", icon: IconTemplate, to: "/material-campo?modo=aulas&seccion=catalogo&pestana=editor", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "paquetes",
            label: "Paquetes",
            icon: Archive,
            to: "/material-campo?modo=aulas&seccion=paquetes",
            layoutPolicy: "viewport",
            tabs: [
              { id: "armado", label: "Armado", icon: Archive, to: "/material-campo?modo=aulas&seccion=paquetes&pestana=armado", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "entrega",
            label: "Entrega",
            icon: CheckCircle2,
            to: "/material-campo?modo=aulas&seccion=entrega",
            layoutPolicy: "viewport",
            tabs: [
              { id: "traspaso", label: "Monitoreo", icon: CalendarDays, to: "/material-campo?modo=aulas&seccion=entrega&pestana=traspaso", layoutPolicy: "viewport" },
              // Etapa 3: las plantillas del equipo de aulas salen de Material (ADR 0122 §11).
              { id: "plantillas", label: "Plantillas del equipo", icon: FileSpreadsheet, to: "/material-campo?modo=aulas&seccion=entrega&pestana=plantillas", layoutPolicy: "viewport" },
            ],
          },
        ],
      },
      {
        // ADR 0118 §1 y §4: la campaña territorial lee la foto de la muestra que
        // Hojas de ruta envió (`ump_territorial_v1`). Sin Accesos: la UMP se
        // recorre con la hoja impresa. El traspaso a Monitoreo no aplica todavía
        // (Monitoreo territorial sigue leyendo la muestra viva, ADR 0118 §3).
        id: "territorial",
        label: "Territorial",
        sections: [
          {
            id: "unidades",
            label: "Unidades",
            // Revamp v5: con envío por cuotas la unidad es la zona (ADR 0125 A1), no la UMP.
            labelsPorVariante: { cuotas: "Zonas" },
            icon: ClipboardList,
            to: "/material-campo?modo=territorial&seccion=unidades",
            layoutPolicy: "viewport",
            tabs: [
              { id: "lista", label: "Lista", icon: ClipboardList, to: "/material-campo?modo=territorial&seccion=unidades&pestana=lista", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "catalogo",
            label: "Catálogo",
            icon: IconTemplate,
            to: "/material-campo?modo=territorial&seccion=catalogo",
            layoutPolicy: "viewport",
            tabs: [
              { id: "fichas", label: "Ficha por UMP", icon: FileText, to: "/material-campo?modo=territorial&seccion=catalogo&pestana=fichas", layoutPolicy: "viewport" },
              { id: "zonas", label: "Hoja de zona", icon: MapPinned, to: "/material-campo?modo=territorial&seccion=catalogo&pestana=zonas", layoutPolicy: "viewport" },
              // D1: el papel que campo llena, con los códigos de resultado del estudio.
              { id: "ruteo", label: "Hoja de ruteo", icon: ListOrdered, to: "/material-campo?modo=territorial&seccion=catalogo&pestana=ruteo", layoutPolicy: "viewport" },
              { id: "consolidados", label: "Hoja de consolidados", icon: Table2, to: "/material-campo?modo=territorial&seccion=catalogo&pestana=consolidados", layoutPolicy: "viewport" },
              { id: "codigos", label: "Códigos de resultado", icon: Hash, to: "/material-campo?modo=territorial&seccion=catalogo&pestana=codigos", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "paquetes",
            label: "Paquetes",
            icon: Archive,
            to: "/material-campo?modo=territorial&seccion=paquetes",
            layoutPolicy: "viewport",
            tabs: [
              { id: "armado", label: "Armado", icon: Archive, to: "/material-campo?modo=territorial&seccion=paquetes&pestana=armado", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "entrega",
            label: "Entrega",
            icon: CheckCircle2,
            to: "/material-campo?modo=territorial&seccion=entrega",
            layoutPolicy: "viewport",
            tabs: [
              { id: "plan", label: "Plan de campo", icon: CalendarDays, to: "/material-campo?modo=territorial&seccion=entrega&pestana=plan", layoutPolicy: "viewport" },
            ],
          },
        ],
      },
      {
        // P10 (etapa 4): el barrido telefónico de un listado de casos. Material
        // guarda sólo la configuración; nombres y teléfonos viven en el archivo
        // del operativo, que Monitoreo telefónico sigue leyendo como hoy.
        id: "telefonica",
        label: "Telefónica",
        sections: [
          {
            id: "casos",
            label: "Casos",
            icon: ClipboardList,
            to: "/material-campo?modo=telefonica&seccion=casos",
            layoutPolicy: "viewport",
            tabs: [
              { id: "configuracion", label: "Configuración", icon: ClipboardList, to: "/material-campo?modo=telefonica&seccion=casos&pestana=configuracion", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "barrido",
            label: "Barrido",
            icon: PhoneCall,
            to: "/material-campo?modo=telefonica&seccion=barrido",
            layoutPolicy: "viewport",
            tabs: [
              { id: "plantilla", label: "Plantilla", icon: Table2, to: "/material-campo?modo=telefonica&seccion=barrido&pestana=plantilla", layoutPolicy: "viewport" },
              { id: "status", label: "Status", icon: ListChecks, to: "/material-campo?modo=telefonica&seccion=barrido&pestana=status", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "entrega",
            label: "Entrega",
            icon: CheckCircle2,
            to: "/material-campo?modo=telefonica&seccion=entrega",
            layoutPolicy: "viewport",
            tabs: [
              { id: "monitoreo", label: "Monitoreo", icon: CalendarDays, to: "/material-campo?modo=telefonica&seccion=entrega&pestana=monitoreo", layoutPolicy: "viewport" },
            ],
          },
        ],
      },
      {
        // ADR 0125 A3: la supervisión de un lote que arma Monitoreo. Material elige las columnas del
        // barrido y de los resultados, añade las tres que lee Monitoreo y entrega la base del lote.
        id: "supervision",
        label: "Supervisión",
        sections: [
          {
            id: "columnas",
            label: "Columnas",
            icon: ListChecks,
            to: "/material-campo?modo=supervision&seccion=columnas",
            layoutPolicy: "viewport",
            tabs: [
              { id: "seleccion", label: "Selección", icon: ListChecks, to: "/material-campo?modo=supervision&seccion=columnas&pestana=seleccion", layoutPolicy: "viewport" },
            ],
          },
          {
            id: "entrega",
            label: "Entrega",
            icon: CheckCircle2,
            to: "/material-campo?modo=supervision&seccion=entrega",
            layoutPolicy: "viewport",
            tabs: [
              { id: "base", label: "Base del lote", icon: CalendarDays, to: "/material-campo?modo=supervision&seccion=entrega&pestana=base", layoutPolicy: "viewport" },
            ],
          },
        ],
      },
      {
        // El correo de una campaña, con identidad, destinatarios, plataforma,
        // envíos, revisión e importar como paneles (ADR 0111 §3), y el
        // seguimiento de todas las campañas de Mailchimp del estudio.
        id: "correo",
        label: "Correo",
        sections: [
          {
            id: "correo",
            label: "Correo",
            icon: Mail,
            to: "/material-campo?modo=correo&seccion=correo",
            layoutPolicy: "viewport",
            tabs: [
              { id: "editor", label: "Editor", icon: Mail, to: "/material-campo?modo=correo&seccion=correo&pestana=editor", layoutPolicy: "viewport" },
              // Quién está en la lista, cómo se reparte por perfil y quién
              // respondió; el enlace personal a la encuesta (ADR 0112 §2 y §4).
              { id: "contactos", label: "Contactos", icon: Users, to: "/material-campo?modo=correo&seccion=correo&pestana=contactos", layoutPolicy: "viewport" },
            ],
          },
          {
            // Operaciones del estudio entero sobre todas sus campañas de Mailchimp a la vez
            // (una por público): quién respondió, la prueba de horarios A/B y el correo personal.
            // No es de una campaña: su dirección no lleva `campana`.
            id: "seguimiento",
            label: "Seguimiento",
            icon: Activity,
            to: "/material-campo?modo=correo&seccion=seguimiento",
            layoutPolicy: "viewport",
            tabs: [
              { id: "respondieron", label: "Quién respondió", icon: CheckCheck, to: "/material-campo?modo=correo&seccion=seguimiento&pestana=respondieron", layoutPolicy: "viewport" },
              { id: "horarios", label: "Prueba de horarios", icon: Clock, to: "/material-campo?modo=correo&seccion=seguimiento&pestana=horarios", layoutPolicy: "viewport" },
              { id: "correo-personal", label: "Correo personal", icon: Contact, to: "/material-campo?modo=correo&seccion=seguimiento&pestana=correo-personal", layoutPolicy: "viewport" },
            ],
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
      "Seguimiento del trabajo de campo: avance contra las metas, control del equipo y de calidad, ritmo y reporte de avance. Lee las respuestas de Kobo y SurveyMonkey y las tablas que Material de campo dejó en el Sheets del estudio.",
    features: [
      "Sincronización con Kobo, SurveyMonkey y el Sheets de Material",
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
          // Esqueleto común de cuatro secciones (revamp, 2026-10-23). Las
          // direcciones anteriores (`fuentes`, `consultas`, `telefonico`) se
          // leen como alias en `direccionAcreditacion.ts`; nunca se escriben.
          { id: "insumos", label: "Insumos", icon: PlugZap, to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.acreditacion.insumos },
          { id: "modelo", label: "Modelo", icon: ListChecks, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.acreditacion.modelo },
          { id: "control", label: "Control", icon: Search, to: "/monitoreo?seccion=control", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.acreditacion.control },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.acreditacion.avance },
        ],
      },
      {
        id: "telefonico",
        label: "Telefónico",
        sections: [
          // Esqueleto común de cuatro secciones (revamp, 2026-10-23). Las
          // direcciones anteriores (`fuentes`, `telefonico`, `consultas`) se
          // leen como alias en `direccionTelefonica.ts`; nunca se escriben.
          { id: "insumos", label: "Insumos", icon: PlugZap, to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.telefonico.insumos },
          { id: "modelo", label: "Modelo", icon: ListChecks, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.telefonico.modelo },
          { id: "control", label: "Control", icon: PhoneCall, to: "/monitoreo?seccion=control", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.telefonico.control },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.telefonico.avance },
        ],
      },
      {
        id: "territorial",
        label: "Territorial",
        sections: [
          // Esqueleto común de cuatro secciones (revamp, 2026-10-23). Las
          // direcciones anteriores (`fuentes`, `calidad`, `consultas`,
          // `ocurrencias`) se leen como alias en `direccionTerritorial.ts`;
          // nunca se escriben.
          { id: "insumos", label: "Insumos", icon: PlugZap, to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.territorial.insumos },
          { id: "modelo", label: "Modelo", icon: Route, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.territorial.modelo },
          { id: "control", label: "Control", icon: ShieldAlert, to: "/monitoreo?seccion=control", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.territorial.control },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.territorial.avance },
        ],
      },
      {
        id: "aulas",
        label: "Cursos-horario",
        sections: [
          // Esqueleto común de cuatro secciones (revamp, 2026-10-23). Las
          // direcciones anteriores (`fuentes`, `calidad`, `consultas` y las
          // pestañas viejas de `modelo` y `avance`) se leen como alias en
          // `direccionAulas.ts`; nunca se escriben.
          { id: "insumos", label: "Insumos", icon: PlugZap, to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.aulas.insumos },
          { id: "modelo", label: "Modelo", icon: ListChecks, to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.aulas.modelo },
          { id: "control", label: "Control", icon: ShieldAlert, to: "/monitoreo?seccion=control", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.aulas.control },
          { id: "avance", label: "Avance", icon: BarChart3, to: "/monitoreo?seccion=avance", layoutPolicy: "viewport", tabs: MONITOREO_PESTANAS.aulas.avance },
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
    // "Estado del estudio": vista de conjunto, no una de las cinco secciones.
    landingKind: "overview",
    sections: [
      {
        id: "carga",
        label: "Carga",
        icon: IconOpen,
        to: "/carga",
        layoutPolicy: "viewport",
        tabs: PROCESAMIENTO_PESTANAS.carga,
      },
      {
        id: "validacion",
        label: "Validación",
        icon: IconGpsValid,
        to: "/validacion",
        layoutPolicy: "viewport",
        tabs: PROCESAMIENTO_PESTANAS.validacion,
      },
      {
        id: "codificacion",
        label: "Codificación",
        icon: IconChecklist,
        to: "/codificacion",
        layoutPolicy: "viewport",
        tabs: PROCESAMIENTO_PESTANAS.codificacion,
      },
      {
        id: "analitica",
        label: "Analítica",
        icon: IconBranching,
        to: "/analitica",
        layoutPolicy: "viewport",
        tabs: PROCESAMIENTO_PESTANAS.analitica,
      },
      {
        id: "graficos",
        label: "Gráficos",
        icon: IconDashboard,
        to: "/graficos",
        layoutPolicy: "viewport",
        tabs: PROCESAMIENTO_PESTANAS.graficos,
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
        tabs: DASHBOARD_PESTANAS,
      },
    ],
  },
];

// Vacío desde el retiro de Enciclopedia. Se conserva la lista —y no se borra el
// concepto— porque el contrato de navegación distingue módulo de utilidad
// global, y esa distinción sigue siendo cierta aunque hoy no haya ninguna.
export const PROSECNUR_GLOBAL_NAV_ITEMS: readonly ProsecnurNavigationLeafMeta[] = [];

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
