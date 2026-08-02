import {
  BarChart3,
  Calculator,
  ClipboardList,
  Compass,
  Database,
  FileCheck2,
  FileText,
  Grid3X3,
  GraduationCap,
  PieChart,
  RefreshCw,
  Send,
  Settings2,
  Sigma,
  Table2,
  Target,
  Users,
  type LucideIcon,
} from "../../../vendor/lucide-react";

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
  | "reemplazos"
  | "auditoria";

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
  seccion: CalcMuestraUniversidadSeccionId,
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
  opciones: { targetId?: string } = {},
): PestanaCalcMuestraUniversidad<Key> {
  return {
    id: key,
    key,
    label,
    detail,
    icon,
    ...(opciones.targetId ? { targetId: opciones.targetId } : {}),
    to: `/calc-muestra?modo=opinion-universitaria&seccion=${seccion}&pestana=${key}`,
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

/** Las 23 pestañas públicas del escritorio de muestra universitaria. */
export const CALC_MUESTRA_UNIVERSIDAD_PESTANAS = {
  definicion: [
    pestana("definicion", "def-estudio", "Estudio", "nombre, cliente y alcance", ClipboardList, { targetId: "cmv2-local-def-estudio" }),
    pestana("definicion", "def-bases", "Fuentes", "archivos, hojas y lectura", Database, { targetId: "cmv2-local-def-bases" }),
    pestana("definicion", "def-variables", "Variables", "columnas de la base", Table2, { targetId: "cmv2-local-def-variables" }),
  ],
  marco: [
    pestana("marco", "marco-criterios-alumno", "Criterios del estudiante", "quién es elegible: formación, condición, edad, facultades y nivel", GraduationCap, { targetId: "cmv2-local-marco-criterios-alumno" }),
    pestana("marco", "marco-ch-radiografia", "Cursos-horario: criterios + radiografía", "define los criterios de aula viendo dónde están los elegibles por facultad", Compass, { targetId: "cmv2-local-marco-ch-radiografia" }),
    pestana("marco", "marco-alumnos-ch", "Alumnos por CH", "elige el estadístico por facultad sobre la distribución del marco ejecutado", BarChart3, { targetId: "cmv2-local-marco-alumnos-ch" }),
    pestana("marco", "marco-poblacion", "Población", "elegibles y estructura (base real)", Users, { targetId: "cmv2-local-marco-poblacion" }),
    pestana("marco", "marco-aulas", "Cursos-horario", "unidades del marco (base real)", Grid3X3, { targetId: "cmv2-local-marco-aulas" }),
    pestana("marco", "marco-cobertura", "Cobertura", "elegibles vs. no elegibles por facultad", BarChart3, { targetId: "cmv2-local-marco-cobertura" }),
  ],
  calculo: [
    pestana("calculo", "calculo-diseno", "Diseño", "fórmula, parámetros y supuestos", Sigma, { targetId: "cmv2-local-calculo-diseno" }),
    pestana("calculo", "calculo-propuestas", "Propuestas", "N y cuotas por facultad (motor R)", Calculator, { targetId: "cmv2-local-calculo-propuestas" }),
    pestana("calculo", "calculo-ch-facultad", "Cursos-horario requeridos", "alumnos por CH y CH definitivos", Grid3X3, { targetId: "cmv2-local-calculo-ch-facultad" }),
    pestana("calculo", "calculo-distribucion", "Distribución", "población y cuota planificada por unidad × sexo", PieChart, { targetId: "cmv2-local-calculo-distribucion" }),
  ],
  aulas: [
    pestanaAula("objetivo", "Objetivo de muestra", "Cuotas y cursos-horario necesarios", Target),
    pestanaAula("metodo", "Comparar métodos", "Elegir la opción más representativa", Settings2),
    pestanaAula("laboratorio", "Simulación", "Estabilidad y repetidos", BarChart3),
    pestanaAula("seleccion", "Cursos-horario titulares", "Unidades que se intentan primero", Table2),
    pestanaAula("reemplazos", "Reemplazos por curso-horario", "Rutas Rn.1, Rn.2...", RefreshCw),
    pestanaAula("auditoria", "Sustento técnico", "Campos, pesos y fuentes", FileText),
  ],
  salidas: [
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
