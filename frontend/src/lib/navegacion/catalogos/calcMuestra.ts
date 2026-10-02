import {
  BarChart3,
  Calculator,
  CirclePlay,
  ClipboardList,
  Compass,
  Database,
  FileCheck2,
  FileText,
  Grid3X3,
  GraduationCap,
  History,
  PieChart,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sigma,
  Table2,
  Target,
  Users,
  type LucideIcon,
  Link2,
  Shuffle,
  FileSpreadsheet,
  Layers3,
  ListOrdered,
  SlidersHorizontal,} from "../../../vendor/lucide-react";

export type CalcMuestraUniversidadSeccionId =
  | "definicion"
  | "marco"
  | "calculo"
  | "aulas"
  | "salidas";

export type ClassroomLabTab =
  | "objetivo"
  | "metodo"
  | "laboratorio"
  | "seleccion"
  | "solidez"
  | "perfil"
  | "reemplazos"
  | "aulas-relato"
  | "auditoria"
  | "aulas-rerandomizacion";

/** Secciones de Muestra general y Acreditación que parten su trabajo en pestañas (E15). */
export type CalcMuestraMesaSeccionId = "marco" | "metodo" | "seleccion";

/** Modo de la gramática en que vive la pestaña (el `modo` de la dirección). */
export type CalcMuestraModoConPestanas = "opinion-universitaria" | "marco-disponible" | "acreditacion";

export type PestanaCalcMuestraUniversidad<Key extends string = string> = {
  readonly id: Key;
  readonly key: Key;
  readonly label: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly targetId?: string;
  readonly classroomTab?: ClassroomLabTab;
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly direccionPublicada: true;
};

function pestana<const Key extends string>(
  seccion: CalcMuestraUniversidadSeccionId | CalcMuestraMesaSeccionId,
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
  opciones: { targetId?: string; modo?: CalcMuestraModoConPestanas } = {},
): PestanaCalcMuestraUniversidad<Key> {
  const modo = opciones.modo ?? "opinion-universitaria";
  return {
    id: key,
    key,
    label,
    detail,
    icon,
    ...(opciones.targetId ? { targetId: opciones.targetId } : {}),
    to: `/calc-muestra?modo=${modo}&seccion=${seccion}&pestana=${key}`,
    layoutPolicy: "viewport",
    direccionPublicada: true,
  };
}

function pestanaAula<const Key extends ClassroomLabTab>(
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
): PestanaCalcMuestraUniversidad<Key> & { readonly classroomTab: Key } {
  return {
    ...pestana("aulas", key, label, detail, icon),
    classroomTab: key,
  };
}

/** Las 28 pestañas públicas del escritorio de muestra universitaria. */
export const CALC_MUESTRA_UNIVERSIDAD_PESTANAS = {
  definicion: [
    pestana("definicion", "def-estudio", "Estudio", "nombre, cliente y alcance", ClipboardList, { targetId: "cmv2-local-def-estudio" }),
    pestana("definicion", "def-bases", "Fuentes", "archivos, hojas y lectura", Database, { targetId: "cmv2-local-def-bases" }),
    pestana("definicion", "def-consistencia", "Consistencia", "llaves entre estudiante y curso-horario", Link2, { targetId: "cmv2-local-def-consistencia" }),
    pestana("definicion", "def-variables", "Variables", "columnas de la base", Table2, { targetId: "cmv2-local-def-variables" }),
    // G42 · La base de un estudio ya aplicado no es una fuente del marco: no lo
    // construye ni lo cambia. Vivía al final de Fuentes, donde no se encontraba
    // y se leía como una base más.
    // G42 · Ver las bases por dentro, variable a variable, sin decidir nada.
    // Gonzalo: «el explorador es un explorador de la base, por lo que debe
    // estar en la sección Datos, no Marco». Marco decide qué entra; Datos es
    // donde se mira lo que hay.
    pestana("definicion", "def-explorador", "Explorador", "distribuciones de estudiantes y cursos-horario, variable a variable", Search, { targetId: "cmv2-local-def-explorador" }),
    pestana("definicion", "def-historico", "Histórico", "base de un estudio anterior como referencia de asistencia", History, { targetId: "cmv2-local-def-historico" }),
  ],
  marco: [
    pestana("marco", "marco-criterios-alumno", "Criterios del estudiante", "quién es elegible: formación, condición, edad, facultades y nivel", GraduationCap, { targetId: "cmv2-local-marco-criterios-alumno" }),
    pestana("marco", "marco-alumnos-ch", "Alumnos por CH", "elige el estadístico por facultad sobre la distribución del marco ejecutado", BarChart3, { targetId: "cmv2-local-marco-alumnos-ch" }),
    pestana("marco", "marco-ch-radiografia", "Cursos-horario: criterios + radiografía", "define los criterios de aula viendo dónde están los elegibles por facultad", Compass, { targetId: "cmv2-local-marco-ch-radiografia" }),
    pestana("marco", "marco-poblacion", "Población", "elegibles y estructura (base real)", Users, { targetId: "cmv2-local-marco-poblacion" }),
    pestana("marco", "marco-aulas", "Cursos-horario", "unidades del marco (base real)", Grid3X3, { targetId: "cmv2-local-marco-aulas" }),
    pestana("marco", "marco-cobertura", "Cobertura", "elegibles vs. no elegibles por facultad", BarChart3, { targetId: "cmv2-local-marco-cobertura" }),
  ],
  calculo: [
    pestana("calculo", "calculo-diseno", "Diseño", "fórmula, parámetros y supuestos", Sigma, { targetId: "cmv2-local-calculo-diseno" }),
    pestana("calculo", "calculo-propuestas", "Propuestas", "N y cuotas por facultad (motor R)", Calculator, { targetId: "cmv2-local-calculo-propuestas" }),
    pestana("calculo", "calculo-ch-facultad", "Cursos-horario requeridos", "alumnos por CH y CH definitivos", Grid3X3, { targetId: "cmv2-local-calculo-ch-facultad" }),
    pestana("calculo", "calculo-distribucion", "Distribución", "población y cuota planificada por unidad × sexo", PieChart, { targetId: "cmv2-local-calculo-distribucion" }),
    // La certeza era un panel dentro de «Cursos-horario requeridos» y contesta
    // una pregunta propia —si el número que pide la fórmula alcanza de verdad—
    // con su propio método. Va la última porque es lo último que se decide.
    pestana("calculo", "calculo-certeza", "¿Alcanza?", "simula el sorteo y dice cuántos cursos-horario hacen falta de verdad", ShieldCheck, { targetId: "cmv2-local-calculo-certeza" }),
  ],
  aulas: [
    pestanaAula("objetivo", "Objetivo de muestra", "Cuotas y cursos-horario necesarios", Target),
    pestanaAula("metodo", "Comparar métodos", "Elegir la opción más representativa", Settings2),
    pestanaAula("laboratorio", "Simulación", "Estabilidad y repetidos", BarChart3),
    pestanaAula("seleccion", "Cursos-horario titulares", "Unidades que se intentan primero", Table2),
    // Particion de titulares (Gonzalo, 2026-08-20): lo operativo se queda alla;
    // el porque (efectividad, margen, solapes, ajuste al marco) vive aqui.
    pestanaAula("solidez", "Solidez de la selección", "Por qué estas aulas: efectividad, margen y solapes", ShieldCheck),
    pestanaAula("perfil", "Perfil de la muestra", "De qué está hecha, facultad por facultad", PieChart),
    pestanaAula("reemplazos", "Reemplazos por curso-horario", "Rutas Rn.1, Rn.2...", RefreshCw),
    // ADR 0067: el sustento narrado — la corrida persistida contada escena por
    // escena, con lente por facultad (`foco`). Vive junto a Sustento técnico
    // porque publica los MISMOS números de la misma corrida.
    pestanaAula("aulas-relato", "Relato", "La corrida contada escena por escena", CirclePlay),
    pestanaAula("auditoria", "Sustento técnico", "Campos, pesos y fuentes", FileText),
    // ADR 0082, aceptado 2026-08-27. Va la ÚLTIMA porque es la última decisión
    // antes de fijar la muestra: con el criterio ya declarado, aceptar o
    // rechazar sorteos es lo que queda por decidir.
    pestanaAula("aulas-rerandomizacion", "¿Este sorteo o otro?", "aceptar o rechazar contra un criterio fijado antes", Shuffle),
  ],
  salidas: [
    // Primera de Entrega y con su propio protagonismo: es la pregunta con la que
    // se cierra el diseño —«¿esto coincide con el estudio anterior?»— y hasta
    // aquí no existen las cuentas por facultad que la contestan.
    pestana("salidas", "salidas-coincidencia", "Coincidencia", "criterios y cuentas contra el estudio anterior", Scale, { targetId: "cmv2-local-salidas-coincidencia" }),
    pestana("salidas", "salidas-guia", "Cierre", "ficha ejecutiva del diseño", FileCheck2, { targetId: "cmv2-local-salidas-guia" }),
    pestana("salidas", "salidas-resultados", "Tablas", "cuotas finales por facultad y sexo", BarChart3, { targetId: "cmv2-local-salidas-resultados" }),
    pestana("salidas", "salidas-entregables", "Entregables", "Excel, Sheets y privacidad", FileText, { targetId: "cmv2-local-salidas-entregables" }),
    pestana("salidas", "salidas-monitoreo", "Pase a Monitoreo", "handoff operativo y reservas", Send, { targetId: "cmv2-local-salidas-monitoreo" }),
  ],
} as const satisfies Record<
  CalcMuestraUniversidadSeccionId,
  readonly PestanaCalcMuestraUniversidad[]
>;

export const TOTAL_PESTANAS_CALC_MUESTRA_UNIVERSIDAD = Object.values(
  CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
).reduce((total, pestanas) => total + pestanas.length, 0);

const GENERAL = { modo: "marco-disponible" } as const;
const ACREDITACION = { modo: "acreditacion" } as const;

/**
 * Muestra general (modo `marco-disponible`, E15 · aulas como patrón): una
 * pregunta por pestaña. Resultados no se parte: es una sola lectura.
 *
 * El orden es el del trabajo —la forma antes que el archivo, la técnica antes
 * que sus parámetros—; la pestaña que abre por defecto la decide la mesa según
 * lo que ya está hecho (con marco declarado, «Archivo del marco»).
 */
export const CALC_MUESTRA_GENERAL_PESTANAS = {
  marco: [
    pestana("marco", "marco-forma", "Forma del marco", "¿qué elementos contiene el marco muestral?", Layers3, GENERAL),
    pestana("marco", "marco-archivo", "Archivo del marco", "¿de qué archivo salen las unidades y el N?", FileSpreadsheet, GENERAL),
    pestana("marco", "marco-ficha", "Ficha del estudio", "¿qué estudio es y qué variables controla?", ClipboardList, GENERAL),
  ],
  metodo: [
    pestana("metodo", "metodo-tecnica", "Técnica", "¿con qué técnica de muestreo se calcula el tamaño de muestra (n)?", Settings2, GENERAL),
    pestana("metodo", "metodo-parametros", "Parámetros", "¿con qué confianza, margen y respuesta?", SlidersHorizontal, GENERAL),
    pestana("metodo", "metodo-memoria", "Cálculo del n", "¿qué fórmula lleva del N de la población al n y a la muestra a contactar?", Sigma, GENERAL),
    pestana("metodo", "metodo-estratos", "Estratos", "¿cómo se reparte el n entre los estratos del marco?", Layers3, GENERAL),
  ],
  seleccion: [
    pestana("seleccion", "seleccion-sorteo", "Selección aleatoria", "¿con qué método, semilla y reemplazos se seleccionan las unidades?", Shuffle, GENERAL),
    pestana("seleccion", "seleccion-corrida", "Resumen", "¿es reproducible y cómo se repartió?", History, GENERAL),
    pestana("seleccion", "seleccion-unidades", "Unidades", "¿qué unidades salieron, con qué probabilidad de selección (π) y peso?", ListOrdered, GENERAL),
  ],
} as const satisfies Record<CalcMuestraMesaSeccionId, readonly PestanaCalcMuestraUniversidad[]>;

/**
 * Acreditación › Selección: el actor en `foco` se elige arriba y sus pestañas
 * son las de Muestra general, precedidas por el archivo de SU marco (este modo
 * no tiene sección Marco: el marco de cada actor vive aquí).
 */
export const CALC_MUESTRA_ACREDITACION_PESTANAS = {
  seleccion: [
    pestana("seleccion", "seleccion-marco", "Archivo del marco", "¿de qué archivo salen las unidades de este actor?", FileSpreadsheet, ACREDITACION),
    pestana("seleccion", "seleccion-sorteo", "Selección aleatoria", "¿con qué método, semilla y reemplazos se seleccionan las unidades de este actor?", Shuffle, ACREDITACION),
    pestana("seleccion", "seleccion-corrida", "Resumen", "¿es reproducible y cómo se repartió?", History, ACREDITACION),
    pestana("seleccion", "seleccion-unidades", "Unidades", "¿qué unidades salieron, con qué probabilidad de selección (π) y peso?", ListOrdered, ACREDITACION),
  ],
} as const satisfies Partial<Record<CalcMuestraMesaSeccionId, readonly PestanaCalcMuestraUniversidad[]>>;
