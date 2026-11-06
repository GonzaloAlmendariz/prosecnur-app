import type { MonitoreoAulasConfig, MonitoreoAulasDashboard, MonitoreoSource } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";

/**
 * Insumos › Fuentes (ficha I1, `docs/qa/revamp-monitoreo/aulas.md`). ¿Qué está
 * conectado y qué dejó la última lectura?
 *
 * Una fila por fuente —el plan del sorteo, cada fuente de respuestas, el libro
 * del operativo y las condicionales (padrón, traslape)— con qué trae, cuánto,
 * cuándo se leyó y en qué estado quedó. Debajo, el recibo de la última lectura
 * del libro, comprobación por comprobación; a la derecha, qué hojas del libro
 * son del equipo y cuáles escribe la app, y cómo se une cada respuesta a su
 * curso-horario.
 *
 * Nada de esta pestaña escribe en un Sheets: leer es de Insumos y escribir es
 * de Avance › Salidas.
 */

export type Tono = "ok" | "aviso" | "riesgo" | "neutro";

export type FilaDeFuente = {
  clave: string;
  fuente: string;
  sub: string;
  trae: string;
  volumen: string;
  lectura: string;
  estado: { texto: string; tono: Tono };
  condicional: boolean;
};

export type Comprobacion = { clave: string; rotulo: string; resultado: string; tono: Tono; detalle: string };

export type HojaDelLibro = { hoja: string; deLaApp: boolean; accion: string };

export type PasoDeUnion = { clave: string; rotulo: string; valor: number; tono: Tono };

export type ModeloFuentes = {
  filas: FilaDeFuente[];
  pie: string;
  /** `null` cuando todavía no se leyó ningún libro: el recibo no tiene qué decir. */
  recibo: { importadoEn: string; comprobaciones: Comprobacion[] } | null;
  libro: { equipo: HojaDelLibro[]; app: HojaDelLibro[]; publicadoEn: string } | null;
  union: { pasos: PasoDeUnion[]; nota: string } | null;
  planImportado: boolean;
  /** Para la confirmación de «Importar plan»: cuántos cursos-horario reemplaza. */
  cursosDelPlan: number;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** «18 set, 16:42» o el texto tal cual si no es una fecha legible. */
export function fechaCorta(iso: string | undefined | null): string {
  const t = (iso ?? "").trim();
  if (!t) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(t);
  if (!m) return t;
  const base = `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? m[2]}`;
  return m[4] ? `${base}, ${Number(m[4])}:${m[5]}` : base;
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

const TIPO_DE_FUENTE: Record<string, string> = {
  kobo: "Kobo",
  surveymonkey: "SurveyMonkey",
  sheets: "Google Sheets",
  google_sheets: "Google Sheets",
  file: "Archivo",
  archivo: "Archivo",
};

function filaDelPlan(config: MonitoreoAulasConfig | null | undefined, dashboard: MonitoreoAulasDashboard | null): FilaDeFuente {
  const rol = dashboard?.course_status_rol_y_estado;
  const titulares = n(rol?.titulares?.total);
  const reservas = n(rol?.reemplazos?.total);
  const banco = n(rol?.banco?.total);
  const importado = Boolean(config?.imported_at);
  const corrida = (config?.selection_run_id ?? "").trim();
  return {
    clave: "plan",
    fuente: "Plan del sorteo",
    sub: corrida ? `corrida ${corrida.slice(0, 8)}` : "Cálculo de muestra",
    trae: "titulares, reservas y banco",
    volumen: titulares ? [fmt(titulares), fmt(reservas), fmt(banco)].join(" + ") : "—",
    lectura: fechaCorta(config?.imported_at),
    estado: importado ? { texto: "Importado", tono: "ok" } : { texto: "Sin importar", tono: "aviso" },
    condicional: false,
  };
}

function filaDeRespuestas(f: MonitoreoSource, leidas: number | null, unica: boolean): FilaDeFuente {
  const tipo = TIPO_DE_FUENTE[String(f.kind ?? "").toLowerCase()] ?? String(f.kind ?? "");
  const conLectura = Boolean(f.last_sync_at);
  return {
    clave: `fuente-${f.id}`,
    fuente: f.label || f.survey_title || "Fuente de respuestas",
    sub: [tipo, f.survey_title && f.survey_title !== f.label ? f.survey_title : ""].filter(Boolean).join(", "),
    trae: "respuestas de los alumnos",
    // El total leído sólo es de esta fuente cuando es la única.
    volumen: unica && leidas != null ? `${fmt(leidas)} respuestas` : "—",
    lectura: fechaCorta(f.last_sync_at),
    estado: !f.enabled
      ? { texto: "Apagada", tono: "neutro" }
      : conLectura
        ? { texto: f.last_sync_mode === "incremental" ? "Leída (incremental)" : "Leída", tono: "ok" }
        : { texto: "Sin leer", tono: "aviso" },
    condicional: false,
  };
}

function filaDelLibro(dashboard: MonitoreoAulasDashboard | null): FilaDeFuente | null {
  const libro = dashboard?.libro;
  if (!libro) return null;
  const unidades = n(libro.resumen?.unidades);
  const faltan = n(libro.hojas_ausentes);
  return {
    clave: "libro",
    fuente: "Libro del operativo",
    sub: "el Excel o Sheets que llena el equipo",
    trae: "agenda, partes de campo y control",
    volumen: unidades ? `${fmt(unidades)} cursos-horario` : "—",
    lectura: fechaCorta(libro.importado_en),
    estado: faltan
      ? { texto: faltan === 1 ? "Falta 1 hoja" : `Faltan ${fmt(faltan)} hojas`, tono: "riesgo" }
      : { texto: "Completo", tono: "ok" },
    condicional: false,
  };
}

function filasCondicionales(config: MonitoreoAulasConfig | null | undefined, dashboard: MonitoreoAulasDashboard | null): FilaDeFuente[] {
  const filas: FilaDeFuente[] = [];
  const personas = n(dashboard?.padron?.personas);
  if (personas) {
    filas.push({
      clave: "padron", fuente: "Padrón de alumnos", sub: "sólo vive en la sesión",
      trae: "el nivel de cada alumno", volumen: `${fmt(personas)} personas`, lectura: "",
      estado: { texto: "Cruzado", tono: "ok" }, condicional: true,
    });
  }
  const traslape = config?.traslape_fuente?.etiqueta;
  if (traslape) {
    filas.push({
      clave: "traslape", fuente: "Traslape", sub: traslape,
      trae: "a quién ya contactó el otro estudio", volumen: "—", lectura: "",
      estado: { texto: "Declarado", tono: "neutro" }, condicional: true,
    });
  }
  return filas;
}

function reciboDe(dashboard: MonitoreoAulasDashboard | null): ModeloFuentes["recibo"] {
  const libro = dashboard?.libro as (NonNullable<MonitoreoAulasDashboard["libro"]> & {
    agenda_campos_ausentes?: string[];
    estados_desconocidos?: Array<{ valor: string; filas: number }>;
    codigos_sin_plan?: Array<{ codigo: string; filas: number }>;
    reservas_sin_cadena?: unknown;
  }) | undefined;
  if (!libro) return null;
  const ausentes = (libro.hojas ?? []).filter((h) => !h.vino).map((h) => h.hoja);
  const campos = libro.agenda_campos_ausentes ?? [];
  const estados = libro.estados_desconocidos ?? [];
  const sinPlan = libro.codigos_sin_plan ?? [];
  // `reservas_sin_cadena` llega como lista de códigos o como conteo, según la versión.
  const crudoSinCadena = libro.reservas_sin_cadena;
  const sinCadena = Array.isArray(crudoSinCadena) ? crudoSinCadena.length : n(crudoSinCadena);
  const sinNombre = n(libro.control_sin_nombre);
  // C3: cada comprobación dice su resultado aunque sea «ninguno»; el recibo no
  // se vacía cuando todo está bien. No se compara «titulares» del libro con el
  // plan: el libro cuenta el banco de extras como titular (219 = 174 + 45 en
  // HSVG) y la diferencia saldría en rojo sin ser un error.
  const comprobaciones: Comprobacion[] = [
    {
      clave: "hojas", rotulo: "Hojas del libro",
      resultado: ausentes.length ? `Faltan ${fmt(ausentes.length)}` : "Todas presentes",
      tono: ausentes.length ? "riesgo" : "ok", detalle: ausentes.join(", "),
    },
    {
      clave: "campos", rotulo: "Columnas de la agenda",
      resultado: campos.length ? `${fmt(campos.length)} sin título` : "Todas reconocidas",
      tono: campos.length ? "aviso" : "ok", detalle: campos.join(", "),
    },
    {
      clave: "estados", rotulo: "Estados que la app no reconoce",
      resultado: estados.length ? `${fmt(estados.reduce((s, e) => s + n(e.filas), 0))} filas` : "Ninguno",
      tono: estados.length ? "aviso" : "ok",
      detalle: estados.map((e) => `«${e.valor}» (${fmt(n(e.filas))})`).join(", "),
    },
    {
      clave: "sin-plan", rotulo: "Códigos que el plan no reconoce",
      resultado: sinPlan.length ? `${fmt(sinPlan.length)} ${sinPlan.length === 1 ? "código" : "códigos"}` : "Ninguno",
      tono: sinPlan.length ? "riesgo" : "ok",
      detalle: sinPlan.map((c) => `${c.codigo} (${fmt(n(c.filas))})`).join(", "),
    },
    {
      clave: "sin-cadena", rotulo: "Reservas sin su titular",
      resultado: sinCadena ? fmt(sinCadena) : "Ninguna",
      tono: sinCadena ? "aviso" : "ok", detalle: "",
    },
    {
      clave: "control", rotulo: "Filas de control sin aplicador",
      resultado: sinNombre ? fmt(sinNombre) : "Ninguna",
      tono: sinNombre ? "aviso" : "ok", detalle: "",
    },
  ];
  return { importadoEn: fechaCorta(libro.importado_en), comprobaciones };
}

function libroDe(config: MonitoreoAulasConfig | null | undefined): ModeloFuentes["libro"] {
  const sello = config?.libro_publicado;
  const detalle = sello?.detalle ?? [];
  if (!detalle.length) return null;
  const hojas = detalle.map((d) => ({ hoja: d.hoja, accion: d.accion, deLaApp: d.accion !== "respetada" }));
  return {
    equipo: hojas.filter((h) => !h.deLaApp),
    app: hojas.filter((h) => h.deLaApp),
    publicadoEn: fechaCorta(sello?.publicado_en),
  };
}

function unionDe(dashboard: MonitoreoAulasDashboard | null): ModeloFuentes["union"] {
  const total = dashboard?.respuestas_desglose?.total;
  if (!total) return null;
  const leidas = n(total.observadas);
  const sinAula = n(total.sin_aula);
  const fuera = n(total.fuera_del_operativo);
  const conAula = Math.max(0, leidas - sinAula - fuera);
  return {
    pasos: [
      { clave: "leidas", rotulo: "Leídas", valor: leidas, tono: "neutro" },
      { clave: "con-aula", rotulo: "Con su curso-horario", valor: conAula, tono: "ok" },
      { clave: "sin-aula", rotulo: "Sin curso-horario", valor: sinAula, tono: sinAula ? "aviso" : "ok" },
      { clave: "fuera", rotulo: "Fuera del operativo", valor: fuera, tono: fuera ? "aviso" : "ok" },
    ],
    nota: "Cada respuesta se une a su curso-horario por el código del enlace o el collectorID; sin él no cuenta para ninguna celda.",
  };
}

export function construirFuentes(
  dashboard: MonitoreoAulasDashboard | null,
  config: MonitoreoAulasConfig | null | undefined,
  fuentes: ReadonlyArray<MonitoreoSource>,
): ModeloFuentes {
  const leidas = dashboard?.respuestas_desglose?.total ? n(dashboard.respuestas_desglose.total.observadas) : null;
  // Las fuentes de respuestas: sin rol o con rol «respuestas». Las demás (universo,
  // hojas de avance o de reporte) no traen respuestas de los alumnos.
  const deRespuestas = fuentes.filter((f) => !f.role || f.role === "respuestas");
  const filas = [
    filaDelPlan(config, dashboard),
    ...deRespuestas.map((f) => filaDeRespuestas(f, leidas, deRespuestas.length === 1)),
    filaDelLibro(dashboard),
    ...filasCondicionales(config, dashboard),
  ].filter((f): f is FilaDeFuente => f !== null);
  const conectadas = deRespuestas.filter((f) => f.enabled).length;
  const rol = dashboard?.course_status_rol_y_estado;
  return {
    filas,
    pie: `${fmt(filas.length)} ${filas.length === 1 ? "fuente" : "fuentes"}; ${fmt(conectadas)} de respuestas ${conectadas === 1 ? "conectada" : "conectadas"}. Leer es de aquí; publicar, de Avance › Salidas.`,
    recibo: reciboDe(dashboard),
    libro: libroDe(config),
    union: unionDe(dashboard),
    planImportado: Boolean(config?.imported_at),
    cursosDelPlan: n(rol?.titulares?.total) + n(rol?.reemplazos?.total) + n(rol?.banco?.total),
  };
}

/** `false` mientras carga; la marca al pintar. Sin tablero igual pinta: importar el plan es la acción de arranque. */
export const MARCA_FUENTES_AULAS = "monitoreo-aulas-insumos-fuentes";
export function readinessDeFuentes(cargando: boolean): string {
  return cargando ? "false" : MARCA_FUENTES_AULAS;
}
