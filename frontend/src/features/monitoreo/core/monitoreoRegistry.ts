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

export type MonitoreoSeccion = "avance" | "ocurrencias" | "consultas" | "modelo" | "fuentes" | "telefonico" | "calidad";
export type PestanaModeloOperativo = "estructura" | "enlaces" | "casos" | "estrategias" | "reglas";
export type MonitoreoModo = MonitoreoProfile["family"];

export type MonitoreoModoDefinicion = {
  family: MonitoreoModo;
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

export type MonitoreoSeccionDefinicion = {
  key: MonitoreoSeccion;
  label: string;
  shortLabel?: string;
  desc: string;
  icon: LucideIcon;
};

export type PestanaModeloOperativoDefinicion = {
  key: PestanaModeloOperativo;
  label: string;
  desc: string;
  icon: LucideIcon;
};

// Adaptador de borde entre el cable y la navegación.
//
// `family` es el campo del contrato R↔React y del `.pulso`
// (`monitoreo_profile.family`) y se queda como está: renombrarlo tocaría 82
// archivos de `api/R/` y proyectos ya guardados. El concepto de navegación se
// llama MODO, y su `id` es el que declara `lib/modules.ts`.
//
// Los dos vocabularios no coinciden en un caso —`aulas_universitarias` en el
// cable es el modo `aulas`—, así que la traducción tiene que ser explícita:
// derivarla con un `slice` o un `replace` es justo el tipo de coincidencia
// silenciosa que se rompe la próxima vez que alguien agregue un modo.
// Contrato: docs/adrs/0044-jerarquia-y-direcciones-de-navegacion.md
const MODO_POR_FAMILY: Record<MonitoreoModo, string> = {
  acreditacion: "acreditacion",
  territorial: "territorial",
  aulas_universitarias: "aulas",
  telefonico: "telefonico",
  // `digital_general` existe en el contrato del backend
  // (`monitoreo_engine.R`) pero NO tiene modo declarado en `lib/modules.ts`:
  // ningún juego de secciones lo representa todavía. Se mapea igual para que
  // un proyecto con esa familia produzca una dirección legible en vez de una
  // rota, pero su modo no aparece en el manifiesto y el inspector no lo
  // recorrerá hasta que se declare.
  digital_general: "digital-general",
};

export function modoIdDesdeFamily(family: MonitoreoModo): string {
  return MODO_POR_FAMILY[family] ?? family;
}

export const MONITOREO_MODOS: MonitoreoModoDefinicion[] = [
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
    label: "Monitoreo de cursos-horario",
    shortLabel: "Cursos-horario",
    status: "active",
    icon: CalendarRange,
    eyebrow: "Disponible en v1",
    title: "Aplicación por cursos-horario",
    summary: "Monitoreo de intervenciones universitarias por cursos-horario: agenda, QR/Kobo, avance, reemplazos y brechas.",
    details: ["Muestra de cursos-horario", "Fichas QR/PDF", "Agenda de aplicación", "Cuotas y brechas"],
    sourceRoles: [
      { label: "Plan", detail: "Titulares y reservas importados desde el cálculo de muestra de cursos-horario" },
      { label: "Fichas QR", detail: "Enlace de Kobo, QR, Word/PDF y consolidado por selección de cursos-horario" },
      { label: "Respuestas", detail: "Kobo o Sheets agregadas por curso-horario y enlace de la intervención" },
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
    summary: "Operación de llamadas conciliada con efectivas Kobo por CodPulso, responsables y cuotas por segmento.",
    details: ["Marco muestral", "Barrido telefónico", "Efectivas Kobo", "Metas por segmento"],
    sourceRoles: [
      { label: "Marco muestral", detail: "Universo contactable, segmentos y metas" },
      { label: "Base de barrido", detail: "Responsables, intentos, estados y prioridad" },
      { label: "Kobo", detail: "Efectivas filtradas por consentimiento y CodPulso" },
      { label: "Cuotas", detail: "Avance por segmento y brechas operativas" },
    ],
  },
];

export const MONITOREO_SECCIONES: MonitoreoSeccionDefinicion[] = [
  { key: "fuentes", label: "Fuentes", shortLabel: "Fuentes", desc: "Universo, encuestas y recopiladores", icon: PlugZap },
  { key: "modelo", label: "Modelo operativo", shortLabel: "Modelo", desc: "Metas, mecanismos y barrido", icon: ListChecks },
  { key: "consultas", label: "Consultas", shortLabel: "Consultas", desc: "Casos, cruces y trazabilidad", icon: Search },
  { key: "telefonico", label: "Monitoreo telefónico", shortLabel: "Teléfono", desc: "Modelo, barrido y supervisión", icon: PhoneCall },
  { key: "avance", label: "Avance", shortLabel: "Avance", desc: "Cumplimiento y brechas", icon: BarChart3 },
];

export const TELEFONICO_WORKBENCH_VIEWS: MonitoreoSeccionDefinicion[] = [
  { key: "fuentes", label: "Fuentes", shortLabel: "Fuentes", desc: "Encuestas, universo y barrido", icon: PlugZap },
  { key: "modelo", label: "Modelo operativo", shortLabel: "Modelo", desc: "Metas y cuotas telefónicas", icon: ListChecks },
  { key: "telefonico", label: "Llamadas", shortLabel: "Llamadas", desc: "Estados, barrido y supervisión", icon: PhoneCall },
  { key: "consultas", label: "Consultas", shortLabel: "Consultas", desc: "Efectivas, CodPulso y salvedades", icon: Search },
  { key: "avance", label: "Avance", shortLabel: "Avance", desc: "Ritmo, cuotas, reportes y entregables", icon: BarChart3 },
];

export const TERRITORIAL_WORKBENCH_VIEWS: MonitoreoSeccionDefinicion[] = [
  { key: "fuentes", label: "Fuente", shortLabel: "Fuente", desc: "Formulario Kobo y filtro", icon: PlugZap },
  { key: "modelo", label: "UMPs", shortLabel: "UMPs", desc: "Orden, responsables y manzanas", icon: Route },
  { key: "calidad", label: "Validación", shortLabel: "Validación", desc: "GPS, reconciliación, duración y cuotas", icon: ShieldAlert },
  { key: "consultas", label: "Consultas internas", shortLabel: "Consultas", desc: "Registros por validar", icon: Search },
  { key: "avance", label: "Avance territorial", shortLabel: "Avance", desc: "Distrito, manzana y ritmo", icon: BarChart3 },
  { key: "ocurrencias", label: "Ocurrencias de campo", shortLabel: "Ocurrencias", desc: "Estados y UMP", icon: ClipboardCheck },
];

// El orden es el del trabajo, y es el mismo de telefónico y territorial: de
// dónde viene el dato, cómo se organizó el campo, si lo recogido está bien, qué
// hay que revisar caso a caso y, AL FINAL, cómo vamos. Aulas era la excepción
// —tenía Avance tercero y Consultas al final— y esa excepción no la pedía nada.
export const AULAS_WORKBENCH_VIEWS: MonitoreoSeccionDefinicion[] = [
  { key: "fuentes", label: "Fuentes", shortLabel: "Fuentes", desc: "Plan, agenda y respuestas", icon: PlugZap },
  { key: "modelo", label: "Agenda de cursos-horario", shortLabel: "Agenda", desc: "Horario, responsable, enlaces y QR", icon: CalendarRange },
  { key: "calidad", label: "Validación", shortLabel: "Validación", desc: "Recolector, curso-horario, horarios y duplicados", icon: ShieldAlert },
  { key: "consultas", label: "Consultas", shortLabel: "Consultas", desc: "Trazabilidad por curso-horario", icon: Search },
  { key: "avance", label: "Avance", shortLabel: "Avance", desc: "Cursos-horario aplicados, cuotas y brechas", icon: BarChart3 },
];

export const PESTANAS_MODELO_OPERATIVO: PestanaModeloOperativoDefinicion[] = [
  { key: "estructura", label: "Metas y modalidades", desc: "Por corte: meta y mecanismos", icon: Layers3 },
  { key: "casos", label: "Base de barrido", desc: "Responsables, intentos y estados", icon: ContactRound },
  { key: "enlaces", label: "Enlaces y envíos", desc: "Correo, QR y enlaces", icon: Link2 },
  { key: "reglas", label: "Estados válidos", desc: "Qué cuenta como avance", icon: SlidersHorizontal },
  { key: "estrategias", label: "Calendario", desc: "Mecanismos por semana", icon: Route },
];

export function seccionesDelModo(route: Pick<MonitoreoModoDefinicion, "family">) {
  if (route.family === "territorial") return TERRITORIAL_WORKBENCH_VIEWS;
  if (route.family === "aulas_universitarias") return AULAS_WORKBENCH_VIEWS;
  if (route.family === "telefonico") return TELEFONICO_WORKBENCH_VIEWS;
  return MONITOREO_SECCIONES;
}
