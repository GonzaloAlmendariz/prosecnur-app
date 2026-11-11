import {
  BarChart2,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Compass,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  GitCompare,
  GitMerge,
  Grid3X3,
  Inbox,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  ListChecks,
  ListOrdered,
  ListTree,
  Network,
  Paintbrush,
  Palette,
  Scale,
  Table2,
  Tags,
  Wand2,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type ProcesamientoSeccionId =
  | "carga"
  | "validacion"
  | "codificacion"
  | "analitica"
  | "graficos";

export type DisponibilidadPestanaProcesamiento = "siempre" | "condicional";

/**
 * Grupo del riel: las pestañas de un mismo grupo van juntas y el riel las
 * separa de las anteriores. Hoy solo Carga lo usa (ADR 0142: Formulario y
 * Respuestas son de consulta).
 */
export type GrupoPestanaProcesamiento = "consulta";

export const ETIQUETAS_GRUPO_PESTANA: Readonly<Record<GrupoPestanaProcesamiento, string>> = {
  consulta: "Consulta",
};

export type PestanaProcesamiento<Key extends string = string> = {
  readonly id: Key;
  readonly key: Key;
  readonly label: string;
  /** Alias históricos consumidos por cada workbench; nacen de un solo copy. */
  readonly detail: string;
  readonly summary: string;
  readonly description: string;
  readonly desc: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly direccionPublicada: boolean;
  readonly disponibilidad: DisponibilidadPestanaProcesamiento;
  readonly readinessPropia?: true;
  readonly grupo?: GrupoPestanaProcesamiento;
};

function pestana<const Key extends string>(
  seccion: ProcesamientoSeccionId,
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
  opciones: {
    direccionPublicada?: boolean;
    disponibilidad?: DisponibilidadPestanaProcesamiento;
    readinessPropia?: true;
    grupo?: GrupoPestanaProcesamiento;
  } = {},
): PestanaProcesamiento<Key> {
  const direccionPublicada = opciones.direccionPublicada ?? true;
  const ruta = seccion === "carga"
    ? "/carga"
    : seccion === "validacion"
      ? "/validacion"
      : seccion === "codificacion"
        ? "/codificacion"
        : seccion === "graficos"
          ? "/graficos"
          : "/analitica";
  return {
    id: key,
    key,
    label,
    detail,
    summary: detail,
    description: detail,
    desc: detail,
    icon,
    to: direccionPublicada ? `${ruta}?pestana=${key}` : ruta,
    layoutPolicy: "viewport",
    direccionPublicada,
    disponibilidad: opciones.disponibilidad ?? "siempre",
    ...(opciones.readinessPropia ? { readinessPropia: true as const } : {}),
    ...(opciones.grupo ? { grupo: opciones.grupo } : {}),
  };
}

/** Las pestañas actuales de Carga, Validación, Codificación, Analítica y Gráficos. */
export const PROCESAMIENTO_PESTANAS = {
  // ADR 0142 (aceptado el 2026-11-11): Plan y Fuentes se funden en Bases, Estructura pasa a Formulario y Datos a
  // Respuestas. Las claves viejas se leen como alias en `features/carga/pestanaCarga.ts` y no se escriben.
  carga: [
    pestana("carga", "bases", "Bases", "Bases y fuentes del estudio", Database),
    pestana("carga", "revision", "Revisión", "Decisiones pendientes de la carga", ClipboardCheck),
    pestana("carga", "variables", "Variables", "Columnas fuera del formulario y variables calculadas", Columns3),
    pestana("carga", "equivalencias", "Equivalencias", "La misma pregunta en cada base", GitCompare, { disponibilidad: "condicional" }),
    pestana("carga", "formulario", "Formulario", "Preguntas, opciones y lógica", ListTree, { grupo: "consulta" }),
    pestana("carga", "respuestas", "Respuestas", "Respuestas en tabla", Table2, { grupo: "consulta" }),
  ],
  // ADR 0142 (rebanada V2 de P6, 2026-11-11): Reglas del formulario y Criterios de revisión se juntan en Reglas,
  // la cola de Cierre de base pasa a Hallazgos y su banda de cierre a Cierre. Las claves viejas se leen como alias
  // en `features/validacion/pestanaValidacion.ts` y no se escriben.
  validacion: [
    pestana("validacion", "explorar", "Explorar", "Distribuciones y cruces de las respuestas", Compass),
    pestana("validacion", "reglas", "Reglas", "Reglas del formulario, del operativo y propias", ListChecks),
    pestana("validacion", "hallazgos", "Hallazgos", "Inconsistencias y casos a revisar, con su decisión", Inbox),
    pestana("validacion", "cierre", "Cierre", "Efecto de las decisiones y base limpia", FileCheck2),
  ],
  codificacion: [
    pestana("codificacion", "organizar", "Preguntas", "Emparejar y decidir qué se codifica", Layers),
    pestana("codificacion", "codificar", "Codificar", "Agrupar respuestas", Tags),
    pestana("codificacion", "matrices", "Matrices", "Mapear textos abiertos", Network),
    pestana("codificacion", "adaptar", "Aplicar", "Llevar los códigos a la base", Wand2),
  ],
  analitica: [
    pestana("analitica", "datos", "Datos", "Etiquetas y variables", ClipboardList),
    pestana("analitica", "base_final", "Base final", "Tabla lista para exportar", Table2),
    pestana("analitica", "codebook", "Libro de códigos", "Diccionario del estudio", BookOpen),
    pestana("analitica", "bases", "Bases e instrumentos", "Archivos y versiones", Database),
    pestana("analitica", "ponderacion", "Ponderación", "Representar a la población", Scale),
    pestana("analitica", "frecuencias", "Frecuencias", "Distribución de respuestas", BarChart2),
    pestana("analitica", "multibase", "Tablas multibase", "Comparación entre bases", GitBranch, { disponibilidad: "condicional" }),
    // Contrato E4-E7, R4: la serie de mediciones armonizada en Carga › Equivalencias. Sólo en estudios con dos o
    // más bases. La pestaña lee la matriz aparte del `preparar`, así que publica su propia readiness.
    pestana("analitica", "comparativos", "Comparativos", "La serie de mediciones armonizada", GitCompare, {
      disponibilidad: "condicional",
      readinessPropia: true,
    }),
    pestana("analitica", "panel", "Base panel", "Personas y mediciones", GitMerge),
    pestana("analitica", "ficha", "Ficha técnica", "Metodología e informe", FileText),
    pestana("analitica", "cruces", "Cruces", "Comparaciones 2D", Grid3X3),
    pestana("analitica", "orden", "Orden de categorías", "Secuencia de respuestas ordinales", ListOrdered, { readinessPropia: true }),
    pestana("analitica", "dimensiones", "Dimensiones", "Índices y puntajes", Layers),
  ],
  // Rediseño 2026-10-14 (D1): Láminas y Word van primero, uno detrás del otro, y luego lo demás. Las claves viejas
  // (`vista-general`, `estilo`, `estilo-informe`) se leen como alias en `resolverPestanaGraficos` y no se escriben.
  graficos: [
    pestana("graficos", "laminas", "Láminas", "La lámina tal como sale, con su estructura y ajustes", LayoutTemplate),
    pestana("graficos", "word", "Word", "Cómo sale el informe en el documento Word", FileText),
    pestana("graficos", "informe", "Informe", "El informe por capítulos, para ordenarlo de un vistazo", LayoutGrid),
    // Logos, letra, íconos y colores, guardados como decisiones sobre el recetario (ADR 0094).
    pestana("graficos", "identidad", "Identidad", "Logos, letra, íconos y colores de las respuestas", Palette),
    // Texto de la base, cálculos, casos y nota al pie; también en el informe compartido (cambia su PPT consolidado).
    pestana("graficos", "reglas", "Reglas", "Redondeo, nota al pie, casos y texto de la base del informe", Paintbrush),
  ],
} as const satisfies Record<ProcesamientoSeccionId, readonly PestanaProcesamiento[]>;

export type CargaWorkspaceTab = typeof PROCESAMIENTO_PESTANAS.carga[number]["key"];
export type ValidacionTabId = typeof PROCESAMIENTO_PESTANAS.validacion[number]["key"];
export type CodificacionTabId = typeof PROCESAMIENTO_PESTANAS.codificacion[number]["key"];
export type AnaliticaTabId = typeof PROCESAMIENTO_PESTANAS.analitica[number]["key"];
export type GraficosTabId = typeof PROCESAMIENTO_PESTANAS.graficos[number]["key"];

/**
 * Cada pestaña condicional de Analítica tiene su propio predicado. Tablas
 * multibase necesita la base integrada con llave de origen. Comparativos
 * necesita una serie (dos o más bases): la falta de preguntas armonizadas no la
 * oculta, la explica en su propio vacío (C3), porque ahí se dice qué hacer.
 */
export function pestanasAnaliticaDisponibles({
  multibaseDisponible,
  basesHermanasIndependientes,
  comparativosDisponibles,
}: {
  multibaseDisponible: boolean;
  basesHermanasIndependientes: boolean;
  comparativosDisponibles: boolean;
}) {
  return PROCESAMIENTO_PESTANAS.analitica.filter((tab) => {
    if (tab.disponibilidad !== "condicional") return true;
    if (tab.id === "comparativos") return comparativosDisponibles;
    return multibaseDisponible && !basesHermanasIndependientes;
  });
}

/**
 * ADR 0062: la equivalencia entre públicos sólo tiene sentido cuando las bases
 * NO comparten instrumento — ahí un nombre de variable no identifica la misma
 * pregunta entre bases. Con una sola base, o con bases integradas, la pestaña no
 * se ofrece. Es el espejo en el cliente del predicado que el backend usa para
 * scopear la configuración de Analítica (ADR 0061): una regla, dos lados.
 */
export function pestanasCargaDisponibles({
  basesSeparadas,
}: {
  basesSeparadas: boolean;
}) {
  return PROCESAMIENTO_PESTANAS.carga.filter((tab) =>
    tab.disponibilidad !== "condicional" || basesSeparadas,
  );
}

export const TOTAL_PESTANAS_PROCESAMIENTO = Object.values(PROCESAMIENTO_PESTANAS)
  .reduce((total, pestanas) => total + pestanas.length, 0);
