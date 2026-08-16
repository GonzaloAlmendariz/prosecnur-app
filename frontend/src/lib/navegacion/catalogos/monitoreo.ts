import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BarChartBig,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Clock3,
  ContactRound,
  DatabaseZap,
  Download,
  Layers3,
  Link2,
  ListChecks,
  MapPin,
  MapPinned,
  PhoneCall,
  PlugZap,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Target,
  Trash2,
  Users,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type MonitoreoModoId =
  | "acreditacion"
  | "telefonico"
  | "territorial"
  | "aulas";

export type MonitoreoSeccionId =
  | "fuentes"
  | "modelo"
  | "consultas"
  | "telefonico"
  | "avance"
  | "calidad"
  | "ocurrencias";

export type DisponibilidadPestanaMonitoreo = "siempre" | "condicional";

/**
 * Una pestaña de Monitoreo en sus dos bordes consumidores.
 *
 * `id` es el identificador del contrato de navegación y `key` es el nombre
 * histórico que consumen los rails de los perfiles. Ambos nacen del mismo
 * argumento del builder: no son dos declaraciones que puedan divergir.
 */
export type PestanaMonitoreoCatalogo<Key extends string = string> = {
  readonly id: Key;
  readonly key: Key;
  readonly label: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly disponibilidad: DisponibilidadPestanaMonitoreo;
};

function pestana<const Key extends string>(
  modo: MonitoreoModoId,
  seccion: MonitoreoSeccionId,
  key: Key,
  label: string,
  detail: string,
  icon: LucideIcon,
  disponibilidad: DisponibilidadPestanaMonitoreo = "siempre",
): PestanaMonitoreoCatalogo<Key> {
  return {
    id: key,
    key,
    label,
    detail,
    icon,
    to: `/monitoreo?modo=${modo}&seccion=${seccion}&pestana=${key}`,
    layoutPolicy: "viewport",
    disponibilidad,
  };
}

/**
 * Fuente única de las pestañas posibles de los cuatro modos de Monitoreo.
 *
 * El contrato estático enumera posibilidades. El registro runtime publica el
 * subconjunto que realmente está visible en el proyecto montado; hoy el único
 * caso condicional es Telefónico > Consultas > Salvedades.
 */
export const MONITOREO_PESTANAS = {
  acreditacion: {
    fuentes: [
      pestana("acreditacion", "fuentes", "actores", "Actores", "Quiénes responden el estudio", Users),
      pestana("acreditacion", "fuentes", "fuentes", "Fuentes y universo", "Qué está conectado y de quién es", Layers3),
      pestana("acreditacion", "fuentes", "recopiladores", "Recopiladores", "Por dónde llegó cada respuesta", ListChecks),
    ],
    modelo: [
      pestana("acreditacion", "modelo", "estructura", "Modelo operativo", "Metas por actor", Target),
      pestana("acreditacion", "modelo", "distribucion", "Distribución", "Variable de interés por actor", BarChartBig),
      pestana("acreditacion", "modelo", "estrategias", "Cronograma", "Campo y reportes", CalendarRange),
    ],
    consultas: [
      pestana("acreditacion", "consultas", "plataforma", "Registros en plataforma", "Respuestas y cruce", ListChecks),
      pestana("acreditacion", "consultas", "base", "Estado de la base", "Actor por actor", Table2),
      pestana("acreditacion", "consultas", "cruces", "Cruces efectivos", "Razón de cruce", Link2),
      pestana("acreditacion", "consultas", "subsanacion", "Subsanación", "Decisión auditada", ShieldAlert),
    ],
    telefonico: [
      pestana("acreditacion", "telefonico", "resumen", "Barrido + Kobo", "Barrido telefónico", PhoneCall),
      pestana("acreditacion", "telefonico", "estados", "Estados", "Confirma y colorea", SlidersHorizontal),
      pestana("acreditacion", "telefonico", "dia", "Ritmo diario", "Efectivas Kobo", CalendarRange),
      pestana("acreditacion", "telefonico", "incidencia", "Sin efectiva", "Sin efectiva e insistencia", AlertCircle),
      pestana("acreditacion", "telefonico", "responsables", "Responsables", "Equipo y carga", ContactRound),
      pestana("acreditacion", "telefonico", "alertas", "Alertas reales", "Alertas reales", ShieldAlert),
      pestana("acreditacion", "telefonico", "supervision", "Supervisión", "Control y muestra", ClipboardCheck),
    ],
    avance: [
      pestana("acreditacion", "avance", "resumen", "Resumen", "Avance general", BarChart3),
      pestana("acreditacion", "avance", "actores", "Actores", "Brechas por unidad", Layers3),
      pestana("acreditacion", "avance", "encuestas", "Encuestas", "Fuentes y canales", ListChecks),
      pestana("acreditacion", "avance", "detalle", "Detalle", "Controles", Table2),
      pestana("acreditacion", "avance", "salidas", "Salidas", "PDF y Sheets", Download),
    ],
  },
  telefonico: {
    fuentes: [
      pestana("telefonico", "fuentes", "activas", "Fuentes activas", "Estado del paquete", PlugZap),
      pestana("telefonico", "fuentes", "sheets", "Universo y barrido", "Estados y colores", Table2),
      pestana("telefonico", "fuentes", "survey", "Encuestas", "Quién responde y qué cuenta", ListChecks),
    ],
    modelo: [
      pestana("telefonico", "modelo", "estructura", "Cuotas", "Metas por variable", Target),
      pestana("telefonico", "modelo", "estrategias", "Cronograma", "Campo y reportes", CalendarRange),
    ],
    telefonico: [
      pestana("telefonico", "telefonico", "resumen", "Resumen operativo", "Cumplimiento y casos", PhoneCall),
      pestana("telefonico", "telefonico", "tiempos", "Validación de tiempo", "Duración Kobo", Clock3),
      pestana("telefonico", "telefonico", "incidencia", "Sin efectiva", "Insistencia y reintentos", AlertCircle),
      pestana("telefonico", "telefonico", "responsables", "Responsables", "Equipo y carga", ContactRound),
      pestana("telefonico", "telefonico", "alertas", "Alertas reales", "Alertas reales", ShieldAlert),
    ],
    consultas: [
      pestana("telefonico", "consultas", "plataforma", "Efectivas Kobo", "Respuestas que pasan el filtro", ListChecks),
      pestana("telefonico", "consultas", "cruces", "CodPulso", "Cruce entre plataforma y barrido", Link2),
      pestana("telefonico", "consultas", "subsanacion", "Salvedades", "Efectivas no identificables", ShieldAlert, "condicional"),
    ],
    avance: [
      pestana("telefonico", "avance", "resumen", "Diario", "Ritmo Kobo", BarChart3),
      pestana("telefonico", "avance", "actores", "Cuotas", "Brechas por categoría", Layers3),
      pestana("telefonico", "avance", "salidas", "Salidas", "PDF y hojas de avance", Download),
    ],
  },
  territorial: {
    fuentes: [
      pestana("territorial", "fuentes", "form", "Formulario", "Kobo y corte local", DatabaseZap),
      pestana("territorial", "fuentes", "filter", "Filtro y distritos", "Efectivas y alcance", SlidersHorizontal),
      pestana("territorial", "fuentes", "roster", "Encuestadores", "Códigos Pulso", ContactRound),
      pestana("territorial", "fuentes", "reconciliation", "Reconciliación", "Códigos y UMP", Link2),
      pestana("territorial", "fuentes", "history", "Historial", "Eventos del corte", Clock),
    ],
    modelo: [
      // Va primera —y por eso es la pestaña por defecto de Modelo— porque es
      // lo que hay que resolver antes de creerle una cifra al resto del módulo.
      pestana("territorial", "modelo", "variables", "Variables", "Mapeo manual de la base", ListChecks),
      pestana("territorial", "modelo", "resumen", "Cobertura", "Zonas, UMP y responsables", BarChart3),
      pestana("territorial", "modelo", "tabla", "Manzanas", "Orden, titulares y reemplazos", Table2),
    ],
    calidad: [
      pestana("territorial", "calidad", "geolocalizacion", "Geolocalización", "GPS y cartografía", MapPin),
      pestana("territorial", "calidad", "reconciliacion", "Reconciliación UMP", "Sospechas espaciales", Route),
      pestana("territorial", "calidad", "duracion", "Duración de tiempo", "Normal, corta y muy corta", Clock),
      pestana("territorial", "calidad", "cuotas", "Cuotas", "Marginales y brechas", Target),
      pestana("territorial", "calidad", "anulacion", "Anulación", "Tacha auditada", Trash2),
    ],
    consultas: [
      pestana("territorial", "consultas", "registro", "Registro", "Tabla principal", Table2),
      pestana("territorial", "consultas", "gps", "GPS con señal", "Distancia y cruce", MapPin),
      pestana("territorial", "consultas", "duracion", "Tiempo corto/muy corto", "Normal, corta y muy corta", Clock),
      pestana("territorial", "consultas", "responsable", "Cruce responsable", "UMP y equipo", ContactRound),
      pestana("territorial", "consultas", "subsanaciones", "Subsanaciones", "Excedentes y brechas", ArrowRight),
    ],
    avance: [
      pestana("territorial", "avance", "resumen", "Resumen", "Estado del campo y corte", BarChart3),
      pestana("territorial", "avance", "distritos", "Distritos", "Cobertura y cuotas", MapPinned),
      pestana("territorial", "avance", "ump", "Mapa y UMP", "Ritmo por manzana", Route),
      pestana("territorial", "avance", "ritmo", "Ritmo diario", "Tendencia del corte", CalendarRange),
      pestana("territorial", "avance", "salidas", "Salidas", "PDF y Sheets", Download),
    ],
    ocurrencias: [
      pestana("territorial", "ocurrencias", "states", "Resumen", "No efectividad y motivos", ClipboardCheck),
      pestana("territorial", "ocurrencias", "distritos", "Distritos", "Estados por distrito", MapPinned),
      pestana("territorial", "ocurrencias", "registro", "Reporte UMP", "Con/sin reporte", Table2),
      pestana("territorial", "ocurrencias", "ump", "UMP", "Con/sin ocurrencia", Route),
      pestana("territorial", "ocurrencias", "alerts", "Alertas", "Cruces y observaciones", ShieldAlert),
      pestana("territorial", "ocurrencias", "rhythm", "Ritmo", "Días e historial", CalendarRange),
    ],
    telefonico: [],
  },
  aulas: {
    fuentes: [],
    // Agenda tiene dos superficies con funciones distintas: consultar el plan y
    // registrar lo que pasó en el aula. Apiladas competían por el alto —a
    // 1024x600 el registro quedaba recortado sin forma de alcanzarlo—; como
    // pestañas cada una recibe la vista entera, igual que en telefónico y
    // acreditación.
    modelo: [
      pestana("aulas", "modelo", "agenda", "Agenda", "Plan y enlaces por curso-horario", Table2),
      pestana("aulas", "modelo", "registro", "Registro de campo", "Cómo fue cada aplicación", ClipboardCheck),
    ],
    avance: [
      pestana("aulas", "avance", "resumen", "Resumen", "Avance por curso-horario", BarChart3),
      pestana("aulas", "avance", "estratos", "Estratos", "Avance y brecha por estrato", Layers3),
      pestana("aulas", "avance", "cuotas", "Cuotas", "Sexo por facultad", Target),
      pestana("aulas", "avance", "salidas", "Salidas", "Publicación a Sheets", Download),
    ],
    calidad: [],
    consultas: [
      pestana("aulas", "consultas", "reemplazos", "Reemplazos", "Cadena por curso-horario caído", Link2),
      pestana("aulas", "consultas", "brechas", "Brechas", "Cursos-horario por debajo de su meta", AlertCircle),
    ],
  },
} as const satisfies Record<
  MonitoreoModoId,
  Partial<Record<MonitoreoSeccionId, readonly PestanaMonitoreoCatalogo[]>>
>;

/**
 * Paneles heredados que el clon telefónico conserva para poder montarse en su
 * antiguo modo de acreditación. No forman parte de la navegación pública del
 * modo Telefónico y, por tanto, no se adjuntan a `modules.ts`.
 */
export const MONITOREO_PESTANAS_COMPATIBILIDAD_TELEFONICO = {
  fuentes: {
    collectors: pestana("telefonico", "fuentes", "collectors", "Recopiladores", "Inclusión y alias", ContactRound),
  },
  modelo: {
    resumen: pestana("telefonico", "modelo", "resumen", "Lectura", "Lectura de Fuentes", BarChart3),
  },
  consultas: {
    base: pestana("telefonico", "consultas", "base", "Estado de la base", "Actor por actor", Table2),
  },
  telefonico: {
    consultados: pestana("telefonico", "telefonico", "consultados", "Consultados", "Efectivas Kobo", ListChecks),
    dia: pestana("telefonico", "telefonico", "dia", "Día", "Efectivas Kobo", CalendarRange),
    supervision: pestana("telefonico", "telefonico", "supervision", "Supervisión telefónica", "Control y muestra", ClipboardCheck),
  },
  avance: {
    encuestas: pestana("telefonico", "avance", "encuestas", "Encuestas", "Fuentes y canales", ListChecks),
    detalle: pestana("telefonico", "avance", "detalle", "Detalle", "Controles", Table2),
  },
} as const;

/**
 * Entrada histórica que Acreditación conserva en su tipo/export público para
 * compatibilidad, aunque no la renderiza ni forma parte de las 68 pestañas
 * navegables. Su definición sigue centralizada para evitar un segundo literal.
 */
export const MONITOREO_PESTANAS_COMPATIBILIDAD_ACREDITACION = {
  modelo: {
    resumen: pestana("acreditacion", "modelo", "resumen", "Resumen", "Lectura de Fuentes", BarChart3),
  },
} as const;

const SIN_PESTANAS: readonly PestanaMonitoreoCatalogo[] = [];

export function pestanasDeMonitoreo(
  modo: MonitoreoModoId,
  seccion: MonitoreoSeccionId,
): readonly PestanaMonitoreoCatalogo[] {
  const porSeccion = MONITOREO_PESTANAS[modo] as Partial<
    Record<MonitoreoSeccionId, readonly PestanaMonitoreoCatalogo[]>
  >;
  return porSeccion[seccion] ?? SIN_PESTANAS;
}

export const TOTAL_PESTANAS_MONITOREO = Object.values(MONITOREO_PESTANAS)
  .flatMap((porSeccion) => Object.values(porSeccion))
  .reduce((total, pestanas) => total + pestanas.length, 0);
