import {
  Activity,
  BarChart2,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Database,
  FileText,
  GitBranch,
  GitCompare,
  GitMerge,
  Grid3X3,
  Layers,
  ListChecks,
  ListOrdered,
  ListTree,
  Network,
  PieChart,
  PlugZap,
  Scale,
  ShieldAlert,
  Table2,
  Tags,
  Wand2,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type ProcesamientoSeccionId =
  | "carga"
  | "validacion"
  | "codificacion"
  | "analitica";

export type DisponibilidadPestanaProcesamiento = "siempre" | "condicional";

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
  } = {},
): PestanaProcesamiento<Key> {
  const direccionPublicada = opciones.direccionPublicada ?? true;
  const ruta = seccion === "carga"
    ? "/carga"
    : seccion === "validacion"
      ? "/validacion"
      : seccion === "codificacion"
        ? "/codificacion"
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
  };
}

/** Las 25 pestañas actuales de Carga, Validación, Codificación y Analítica. */
export const PROCESAMIENTO_PESTANAS = {
  carga: [
    pestana("carga", "plan", "Plan", "Organización de las bases", ClipboardCheck),
    pestana("carga", "fuentes", "Fuentes", "Formulario y respuestas", PlugZap),
    pestana("carga", "revision", "Revisión", "Incidencias de carga", ShieldAlert),
    pestana("carga", "estructura", "Estructura", "Variables y códigos", ListChecks),
    pestana("carga", "datos", "Datos", "Respuestas en tabla", Table2),
    pestana("carga", "equivalencias", "Equivalencias", "La misma pregunta en cada público", GitCompare, { disponibilidad: "condicional" }),
  ],
  validacion: [
    pestana("validacion", "explorar", "Explorar respuestas", "Distribuciones y señales de revisión", Compass),
    pestana("validacion", "instrumento", "Reglas del formulario", "Saltos, rangos y catálogos", ListTree),
    pestana("validacion", "reglas_custom", "Criterios de revisión", "Señales adicionales", PieChart),
    pestana("validacion", "limpieza", "Cierre de base", "Limpieza y normalización", Activity),
  ],
  codificacion: [
    pestana("codificacion", "organizar", "Preparar", "Emparejar y marcar", Layers),
    pestana("codificacion", "codificar", "Codificar", "Agrupar respuestas", Tags),
    pestana("codificacion", "matrices", "Matrices", "Mapear textos abiertos", Network),
    pestana("codificacion", "adaptar", "Adaptación", "Confirmar y aplicar", Wand2),
  ],
  analitica: [
    pestana("analitica", "datos", "Datos", "Etiquetas y variables", ClipboardList),
    pestana("analitica", "base_final", "Base final", "Tabla lista para exportar", Table2),
    pestana("analitica", "codebook", "Libro de códigos", "Diccionario del estudio", BookOpen),
    pestana("analitica", "bases", "Bases e instrumentos", "Archivos y versiones", Database),
    pestana("analitica", "ponderacion", "Ponderación", "Representar a la población", Scale),
    pestana("analitica", "frecuencias", "Frecuencias", "Distribución de respuestas", BarChart2),
    pestana("analitica", "multibase", "Tablas multibase", "Comparación entre bases", GitBranch, { disponibilidad: "condicional" }),
    pestana("analitica", "panel", "Base panel", "Personas y mediciones", GitMerge),
    pestana("analitica", "ficha", "Ficha técnica", "Metodología e informe", FileText),
    pestana("analitica", "cruces", "Cruces", "Comparaciones 2D", Grid3X3),
    pestana("analitica", "orden", "Orden de categorías", "Secuencia de respuestas ordinales", ListOrdered, { readinessPropia: true }),
    pestana("analitica", "dimensiones", "Dimensiones", "Índices y puntajes", Layers),
  ],
} as const satisfies Record<ProcesamientoSeccionId, readonly PestanaProcesamiento[]>;

export type CargaWorkspaceTab = typeof PROCESAMIENTO_PESTANAS.carga[number]["key"];
export type ValidacionTabId = typeof PROCESAMIENTO_PESTANAS.validacion[number]["key"];
export type CodificacionTabId = typeof PROCESAMIENTO_PESTANAS.codificacion[number]["key"];
export type AnaliticaTabId = typeof PROCESAMIENTO_PESTANAS.analitica[number]["key"];

export function pestanasAnaliticaDisponibles({
  multibaseDisponible,
  basesHermanasIndependientes,
}: {
  multibaseDisponible: boolean;
  basesHermanasIndependientes: boolean;
}) {
  return PROCESAMIENTO_PESTANAS.analitica.filter((tab) =>
    tab.disponibilidad !== "condicional"
      || (multibaseDisponible && !basesHermanasIndependientes),
  );
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
