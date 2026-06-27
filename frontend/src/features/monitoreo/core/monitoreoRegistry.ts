import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  ContactRound,
  Layers3,
  Link2,
  ListChecks,
  PhoneCall,
  PlugZap,
  Route,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MonitoreoProfile } from "../../../api/client";

export type WorkbenchView = "avance" | "ocurrencias" | "consultas" | "modelo" | "fuentes" | "telefonico" | "calidad";
export type OperationalModelMode = "estructura" | "enlaces" | "casos" | "estrategias" | "reglas";
export type MonitoreoRouteFamily = MonitoreoProfile["family"];

export type MonitoreoRouteDefinition = {
  family: MonitoreoRouteFamily;
  label: string;
  shortLabel: string;
  status: "active" | "planned";
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  summary: string;
  details: string[];
  sourceRoles: Array<{ label: string; detail: string }>;
};

export type WorkbenchViewDefinition = {
  key: WorkbenchView;
  label: string;
  shortLabel?: string;
  desc: string;
  icon: LucideIcon;
};

export type OperationalModelModeDefinition = {
  key: OperationalModelMode;
  label: string;
  desc: string;
  icon: LucideIcon;
};

export const MONITOREO_ROUTES: MonitoreoRouteDefinition[] = [
  {
    family: "acreditacion",
    label: "Acreditación institucional",
    shortLabel: "Acreditación",
    status: "active",
    icon: ClipboardCheck,
    eyebrow: "Disponible en v1",
    title: "Acreditación",
    summary: "Control operativo por actores, carreras, barrido telefónico, QR y respuestas de plataforma.",
    details: ["Multi-actor", "Segmentada por carrera", "Mínimos y brechas", "Alertas de coherencia"],
    sourceRoles: [
      { label: "Universo", detail: "Actores, carreras, mínimos y llaves" },
      { label: "Barrido", detail: "Responsables, intentos y telefonía" },
      { label: "Respuestas", detail: "Web, QR, asistidas y rechazos" },
      { label: "Reporte", detail: "Avance, cortes y brechas del estudio" },
    ],
  },
  {
    family: "territorial",
    label: "Monitoreo territorial",
    shortLabel: "Territorial",
    status: "active",
    icon: Route,
    eyebrow: "Disponible en v1",
    title: "Territorial",
    summary: "Kobo como fuente canónica de respuestas y Hojas de Ruta como marco canónico de territorio.",
    details: ["Kobo API", "Hojas de Ruta", "Manzanas", "GPS válido"],
    sourceRoles: [
      { label: "Kobo", detail: "Instrumento vivo y respuestas de campo" },
      { label: "Hojas de ruta", detail: "Distritos, metas y manzanas titulares/reemplazos" },
      { label: "Mapa", detail: "GPS contra cartografía local y fase activa" },
    ],
  },
  {
    family: "aulas_universitarias",
    label: "Monitoreo de aulas universitarias",
    shortLabel: "Aulas",
    status: "active",
    icon: CalendarRange,
    eyebrow: "Disponible en v1",
    title: "Aulas universitarias",
    summary: "Agenda, links/QR, avance, reemplazos y brechas para encuestas anonimas en aulas.",
    details: ["Plan de calc-muestra", "Agenda de aulas", "Reemplazos", "Cuotas y brechas"],
    sourceRoles: [
      { label: "Plan", detail: "Aulas titulares y reservas importadas desde calc-muestra" },
      { label: "Agenda", detail: "Horario, docente, responsable, collector, link y QR" },
      { label: "Respuestas", detail: "SurveyMonkey, Kobo o Sheets agregadas por aula/link" },
      { label: "Cierre", detail: "Titulares, reemplazos usados y brechas justificadas" },
    ],
  },
  {
    family: "telefonico",
    label: "Monitoreo telefónico",
    shortLabel: "Telefónico",
    status: "active",
    icon: PhoneCall,
    eyebrow: "Disponible en v1",
    title: "Telefónico",
    summary: "Operación de llamadas conectada a marco muestral, base de barrido, responsables y cuotas por segmento.",
    details: ["Marco muestral", "Barrido telefónico", "Ratio de insistencia", "Metas por segmento"],
    sourceRoles: [
      { label: "Marco muestral", detail: "Universo contactable, segmentos y metas" },
      { label: "Base de barrido", detail: "Responsables, intentos, estados y prioridad" },
      { label: "Respuestas", detail: "Efectivas, rechazos, parciales y plataforma" },
      { label: "Cuotas", detail: "Avance por segmento y brechas operativas" },
    ],
  },
];

export const WORKBENCH_VIEWS: WorkbenchViewDefinition[] = [
  { key: "fuentes", label: "Fuentes", shortLabel: "Fuentes", desc: "Sheets, encuestas y recopiladores", icon: PlugZap },
  { key: "modelo", label: "Modelo operativo", shortLabel: "Modelo", desc: "Metas, mecanismos y barrido", icon: ListChecks },
  { key: "consultas", label: "Consultas", shortLabel: "Consultas", desc: "Casos, cruces y trazabilidad", icon: Search },
  { key: "telefonico", label: "Monitoreo telefónico", shortLabel: "Teléfono", desc: "Modelo, barrido y supervisión", icon: PhoneCall },
  { key: "avance", label: "Avance", shortLabel: "Avance", desc: "Cumplimiento y brechas", icon: BarChart3 },
];

export const TERRITORIAL_WORKBENCH_VIEWS: WorkbenchViewDefinition[] = [
  { key: "fuentes", label: "Fuente", shortLabel: "Fuente", desc: "Formulario Kobo y filtro", icon: PlugZap },
  { key: "modelo", label: "UMPs", shortLabel: "UMPs", desc: "Orden, responsables y manzanas", icon: Route },
  { key: "calidad", label: "Validación", shortLabel: "Validación", desc: "GPS, reconciliación, duración y cuotas", icon: ShieldAlert },
  { key: "consultas", label: "Consultas internas", shortLabel: "Consultas", desc: "Registros por validar", icon: Search },
  { key: "avance", label: "Avance territorial", shortLabel: "Avance", desc: "Distrito, manzana y ritmo", icon: BarChart3 },
  { key: "ocurrencias", label: "Ocurrencias de campo", shortLabel: "Ocurrencias", desc: "Estados y UMP", icon: ClipboardCheck },
];

export const AULAS_WORKBENCH_VIEWS: WorkbenchViewDefinition[] = [
  { key: "fuentes", label: "Fuentes", shortLabel: "Fuentes", desc: "Plan, agenda y respuestas", icon: PlugZap },
  { key: "modelo", label: "Agenda de aulas", shortLabel: "Agenda", desc: "Horario, responsable, links y QR", icon: CalendarRange },
  { key: "avance", label: "Avance", shortLabel: "Avance", desc: "Aulas aplicadas, cuotas y brechas", icon: BarChart3 },
  { key: "calidad", label: "Validación", shortLabel: "Validación", desc: "Collector, aula, horarios y duplicados", icon: ShieldAlert },
  { key: "consultas", label: "Consultas", shortLabel: "Consultas", desc: "Trazabilidad aula por aula", icon: Search },
];

export const OPERATIONAL_MODEL_MODES: OperationalModelModeDefinition[] = [
  { key: "estructura", label: "Metas y modalidades", desc: "Por corte: meta y mecanismos", icon: Layers3 },
  { key: "casos", label: "Base de barrido", desc: "Responsables, intentos y estados", icon: ContactRound },
  { key: "enlaces", label: "Enlaces y envíos", desc: "Correo, QR y links", icon: Link2 },
  { key: "reglas", label: "Estados válidos", desc: "Qué cuenta como avance", icon: SlidersHorizontal },
  { key: "estrategias", label: "Calendario", desc: "Mecanismos por semana", icon: Route },
];

export function workbenchViewsForRoute(route: Pick<MonitoreoRouteDefinition, "family">) {
  if (route.family === "territorial") return TERRITORIAL_WORKBENCH_VIEWS;
  if (route.family === "aulas_universitarias") return AULAS_WORKBENCH_VIEWS;
  return WORKBENCH_VIEWS;
}
