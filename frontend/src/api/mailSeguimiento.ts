// Material de campo > Correo > Seguimiento: operaciones del estudio entero sobre
// todas sus campañas de Mailchimp (una por público). Quién respondió (con
// archivado opcional y una corrida antes de cada envío programado), la prueba
// de horarios A/B y el correo personal 80/20.
//
// Base: /api/recopiladores/mail-seguimiento. Ninguna respuesta trae correos,
// sólo conteos. La app nunca envía ni programa: crea borradores.
//
// R serializa un vector de largo 1 como escalar, uno vacío como `{}` o `[]` y
// un NA como `null` o "NA": los normalizadores leen todo eso como ausente.

import { apiFetch, handle, headers } from "./core";
import { normalizeInicioDeJob, type InicioDeJob } from "./mailchimpSync";

const BASE = "/api/recopiladores/mail-seguimiento";

// ---------- Lectores defensivos ----------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const uno = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
const str = (v: unknown): string => {
  const x = uno(v);
  return typeof x === "string" ? (x === "NA" ? "" : x) : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};
const numOrNull = (v: unknown): number | null => {
  const x = uno(v);
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() && x !== "NA") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const num = (v: unknown, porDefecto = 0): number => numOrNull(v) ?? porDefecto;
const bool = (v: unknown): boolean => uno(v) === true;
/** Lista de R: un arreglo, un escalar suelto (vector de largo 1) o nada (`{}`). */
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null || (isRecord(v) && !Object.keys(v).length) ? [] : [v]);
const textos = (v: unknown): string[] => lista(v).map(str).filter(Boolean);
const registros = (v: unknown): Record<string, unknown>[] => lista(v).filter(isRecord);

export type Grupo = "A" | "B";
const grupo = (v: unknown): Grupo | null => {
  const g = str(v).trim().toUpperCase();
  return g === "A" || g === "B" ? g : null;
};

// ---------- Estado (GET) ----------

export type ConfigSeguimiento = {
  list_id: string;
  tag: string;
  archivar: boolean;
  antes_de_envio: { activo: boolean; minutos: number };
  /** Hora de envío para la que corrió la última actualización automática. */
  ultima_para: string;
  /** Cuándo corrió (ISO UTC). */
  ultima_at: string;
};

export type CampanaSeguimiento = {
  campaign_id: string;
  nombre: string;
  publico: string;
  recordatorios: { send_id: string; etiqueta: string }[];
  /** Id de la encuesta de SurveyMonkey; vacío si falta elegirla. */
  encuesta: string;
  contactos: boolean;
  personas: number;
  con_enlace: number;
  /** `null`: todavía no se leyó quién respondió. */
  respondieron: number | null;
  a_medias: number | null;
  leido_en: string;
  archivados: boolean;
  grupos: { A: number; B: number };
  segundo_correo: { personal: number; control: number; cargados: number; rechazados: number };
};

export type FilaDelPlan = {
  ronda: number;
  campaign_id: string;
  grupo: Grupo;
  /** "2026-11-11T20:00", hora de Lima; vacío si falta. */
  programado: string;
  mailchimp_id: string;
  /** ISO UTC de Mailchimp si ya salió; vacío si no. */
  enviado: string;
  enviados: number | null;
  hora_txt: string;
};

export type TipoDeAviso = "fuera_de_oficina" | "misma_hora" | "falta_hora" | "otro";

export type AvisoDelPlan = { tipo: TipoDeAviso; ronda: number; campaign_id: string; texto: string };

export type HorarioSeguimiento = {
  semilla: number | null;
  campanas: string[];
  oficina: string[];
  oficina_desde: string;
  oficina_hasta: string;
  etiquetas: { A: string; B: string };
  horizonte_h: number;
  sorteado_en: string;
  etiquetado_en: string;
  rondas: { ronda: number; etiqueta: string }[];
  plan: FilaDelPlan[];
  avisos: AvisoDelPlan[];
};

export type CampanaCorreoPersonal = {
  campaign_id: string;
  publico: string;
  columna: string;
  candidatas: { key: string; label: string }[];
};

export type CorreoPersonalSeguimiento = {
  semilla: number | null;
  /** Fracción que recibe también en el correo personal (0.8 por defecto). */
  proporcion: number;
  etiqueta: string;
  /** "2026-11-16T09:30", hora de Lima; vacío si falta. */
  desde: string;
  sorteado_en: string;
  cargado_en: string;
  campanas: CampanaCorreoPersonal[];
};

export type EstadoSeguimiento = {
  config: ConfigSeguimiento;
  campanas: CampanaSeguimiento[];
  horario: HorarioSeguimiento;
  correo_personal: CorreoPersonalSeguimiento;
};

function normalizeCampana(r: Record<string, unknown>): CampanaSeguimiento | null {
  const campaign_id = str(r.campaign_id).trim();
  if (!campaign_id) return null;
  const g = isRecord(r.grupos) ? r.grupos : {};
  const sc = isRecord(r.segundo_correo) ? r.segundo_correo : {};
  return {
    campaign_id,
    nombre: str(r.nombre),
    publico: str(r.publico) || str(r.nombre) || campaign_id,
    recordatorios: registros(r.recordatorios)
      .map((x) => ({ send_id: str(x.send_id), etiqueta: str(x.etiqueta) }))
      .filter((x) => x.send_id),
    encuesta: str(r.encuesta).trim(),
    contactos: bool(r.contactos),
    personas: num(r.personas),
    con_enlace: num(r.con_enlace),
    respondieron: numOrNull(r.respondieron),
    a_medias: numOrNull(r.a_medias),
    leido_en: str(r.leido_en),
    archivados: bool(r.archivados),
    grupos: { A: num(g.A), B: num(g.B) },
    segundo_correo: { personal: num(sc.personal), control: num(sc.control), cargados: num(sc.cargados), rechazados: num(sc.rechazados) },
  };
}

function normalizeFilaDelPlan(r: Record<string, unknown>): FilaDelPlan | null {
  const g = grupo(r.grupo);
  const ronda = numOrNull(r.ronda);
  const campaign_id = str(r.campaign_id).trim();
  if (!g || ronda == null || !campaign_id) return null;
  return {
    ronda: Math.round(ronda),
    campaign_id,
    grupo: g,
    programado: str(r.programado).trim(),
    mailchimp_id: str(r.mailchimp_id).trim(),
    enviado: str(r.enviado).trim(),
    enviados: numOrNull(r.enviados),
    hora_txt: str(r.hora_txt),
  };
}

const TIPOS_DE_AVISO: readonly TipoDeAviso[] = ["fuera_de_oficina", "misma_hora", "falta_hora"];

export function normalizeHorario(raw: unknown): HorarioSeguimiento {
  const h = isRecord(raw) ? raw : {};
  const e = isRecord(h.etiquetas) ? h.etiquetas : {};
  return {
    semilla: numOrNull(h.semilla),
    campanas: textos(h.campanas),
    oficina: textos(h.oficina),
    oficina_desde: str(h.oficina_desde) || "08:30",
    oficina_hasta: str(h.oficina_hasta) || "17:00",
    etiquetas: { A: str(e.A) || "Envío mañana", B: str(e.B) || "Envío tarde" },
    horizonte_h: num(h.horizonte_h, 24) || 24,
    sorteado_en: str(h.sorteado_en),
    etiquetado_en: str(h.etiquetado_en),
    rondas: registros(h.rondas)
      .map((r) => ({ ronda: Math.round(num(r.ronda)), etiqueta: str(r.etiqueta) }))
      .filter((r) => r.ronda > 0)
      .map((r) => ({ ...r, etiqueta: r.etiqueta || `Recordatorio ${r.ronda}` })),
    plan: registros(h.plan).map(normalizeFilaDelPlan).filter((f): f is FilaDelPlan => f !== null),
    avisos: registros(h.avisos).map((a) => {
      const tipo = str(a.tipo) as TipoDeAviso;
      return {
        tipo: TIPOS_DE_AVISO.includes(tipo) ? tipo : "otro",
        ronda: Math.round(num(a.ronda)),
        campaign_id: str(a.campaign_id),
        texto: str(a.texto).trim(),
      };
    }).filter((a) => a.texto),
  };
}

export function normalizeCorreoPersonal(raw: unknown): CorreoPersonalSeguimiento {
  const c = isRecord(raw) ? raw : {};
  const proporcion = numOrNull(c.proporcion);
  return {
    semilla: numOrNull(c.semilla),
    proporcion: proporcion != null && proporcion > 0 && proporcion < 1 ? proporcion : 0.8,
    etiqueta: str(c.etiqueta) || "Correo personal",
    desde: str(c.desde).trim(),
    sorteado_en: str(c.sorteado_en),
    cargado_en: str(c.cargado_en),
    campanas: registros(c.campanas).map((x) => ({
      campaign_id: str(x.campaign_id).trim(),
      publico: str(x.publico) || str(x.campaign_id),
      columna: str(x.columna).trim(),
      candidatas: registros(x.candidatas)
        .map((k) => ({ key: str(k.key), label: str(k.label) || str(k.key) }))
        .filter((k) => k.key),
    })).filter((x) => x.campaign_id),
  };
}

export function normalizeEstadoSeguimiento(raw: unknown): EstadoSeguimiento {
  const r = isRecord(raw) ? raw : {};
  const c = isRecord(r.config) ? r.config : {};
  const ade = isRecord(c.antes_de_envio) ? c.antes_de_envio : {};
  return {
    config: {
      list_id: str(c.list_id).trim(),
      tag: str(c.tag).trim() || "Respondió",
      archivar: bool(c.archivar),
      antes_de_envio: { activo: bool(ade.activo), minutos: num(ade.minutos, 30) || 30 },
      ultima_para: str(c.ultima_para),
      ultima_at: str(c.ultima_at),
    },
    campanas: registros(r.campanas).map(normalizeCampana).filter((x): x is CampanaSeguimiento => x !== null),
    horario: normalizeHorario(r.horario),
    correo_personal: normalizeCorreoPersonal(r.correo_personal),
  };
}

// ---------- Quién respondió en todas las campañas ----------

export type CampanaSaltada = { campaign_id: string; publico: string; motivo: string };

const normalizeSaltadas = (v: unknown): CampanaSaltada[] => registros(v)
  .map((s) => ({ campaign_id: str(s.campaign_id), publico: str(s.publico) || str(s.campaign_id), motivo: str(s.motivo).trim() }))
  .filter((s) => s.campaign_id || s.publico);

export type InicioDeActualizacion = InicioDeJob & { campanas: number; saltadas: CampanaSaltada[] };

export function normalizeInicioDeActualizacion(raw: unknown): InicioDeActualizacion {
  const r = isRecord(raw) ? raw : {};
  return { ...normalizeInicioDeJob(raw), campanas: num(r.campanas), saltadas: normalizeSaltadas(r.saltadas) };
}

export type ResultadoPorCampana = {
  campaign_id: string;
  ok: boolean;
  respondents: number;
  tagged: number;
  archived: number;
  archived_second: number;
  partial_people: number;
  inactive: number;
  error: string;
};

export type ResultadoDeActualizacion = {
  campanas: ResultadoPorCampana[];
  saltadas: CampanaSaltada[];
  totales: { respondieron: number; etiquetados: number; archivados: number; a_medias: number };
};

export function normalizeResultadoDeActualizacion(raw: unknown): ResultadoDeActualizacion {
  const r = isRecord(raw) ? raw : {};
  const t = isRecord(r.totales) ? r.totales : {};
  return {
    campanas: registros(r.campanas).map((c) => {
      const err = isRecord(c.error) ? str(c.error.message) : str(c.error);
      return {
        campaign_id: str(c.campaign_id),
        ok: c.ok === undefined ? !err : bool(c.ok),
        respondents: num(c.respondents),
        tagged: num(c.tagged),
        archived: num(c.archived),
        archived_second: num(c.archived_second),
        partial_people: num(c.partial_people),
        inactive: num(c.inactive),
        error: err.trim(),
      };
    }),
    saltadas: normalizeSaltadas(r.saltadas),
    totales: { respondieron: num(t.respondieron), etiquetados: num(t.etiquetados), archivados: num(t.archivados), a_medias: num(t.a_medias) },
  };
}

// ---------- Antes de cada envío ----------

export type CampanaProgramada = { titulo: string; send_time: string; destinatarios: number | null };

const normalizeProgramada = (r: Record<string, unknown>): CampanaProgramada => ({
  titulo: str(r.titulo) || str(r.title),
  send_time: str(r.send_time),
  destinatarios: numOrNull(r.destinatarios),
});

export function normalizeProgramadas(raw: unknown): CampanaProgramada[] {
  const r = isRecord(raw) ? raw : {};
  return registros(r.programadas).map(normalizeProgramada).filter((p) => p.send_time);
}

export type LatidoAntesDeEnvio = {
  activo: boolean;
  lanzado: boolean;
  job_id: string;
  proximo: CampanaProgramada | null;
  minutos: number | null;
};

export function normalizeLatido(raw: unknown): LatidoAntesDeEnvio {
  const r = isRecord(raw) ? raw : {};
  const prox = isRecord(r.proximo) && Object.keys(r.proximo).length ? normalizeProgramada(r.proximo) : null;
  return {
    activo: bool(r.activo),
    lanzado: bool(r.lanzado),
    job_id: str(r.job_id).trim(),
    proximo: prox && prox.send_time ? prox : null,
    minutos: numOrNull(r.minutos),
  };
}

// ---------- Prueba de horarios ----------

export type SorteoDeGrupos = { semilla: number | null; grupos: Record<string, { A: number; B: number }> };

export function normalizeSorteoDeGrupos(raw: unknown): SorteoDeGrupos {
  const r = isRecord(raw) ? raw : {};
  const g = isRecord(r.grupos) ? r.grupos : {};
  return {
    semilla: numOrNull(r.semilla),
    grupos: Object.fromEntries(Object.entries(g).filter(([, v]) => isRecord(v)).map(([k, v]) => {
      const x = v as Record<string, unknown>;
      return [k, { A: num(x.A), B: num(x.B) }];
    })),
  };
}

export type EtiquetasDeGrupo = Record<Grupo, { etiqueta: string; etiquetados: number; inactivos: number }>;

export function normalizeEtiquetasDeGrupo(raw: unknown): EtiquetasDeGrupo {
  const r = isRecord(raw) ? raw : {};
  const leer = (v: unknown, porDefecto: string) => {
    const x = isRecord(v) ? v : {};
    return { etiqueta: str(x.etiqueta) || porDefecto, etiquetados: num(x.etiquetados), inactivos: num(x.inactivos) };
  };
  return { A: leer(r.A, "Envío mañana"), B: leer(r.B, "Envío tarde") };
}

export type BorradorDeGrupo = {
  mailchimp_campaign_id: string;
  edit_url: string;
  recipient_count: number | null;
  title: string;
  subject: string;
};

const URL_DE_MAILCHIMP = /^https:\/\/[a-z0-9-]+\.admin\.mailchimp\.com\//i;

export function normalizeBorradorDeGrupo(raw: unknown): BorradorDeGrupo {
  const r = isRecord(raw) ? raw : {};
  const edit = str(r.edit_url).trim();
  return {
    mailchimp_campaign_id: str(r.mailchimp_campaign_id).trim(),
    edit_url: URL_DE_MAILCHIMP.test(edit) ? edit : "",
    recipient_count: numOrNull(r.recipient_count),
    title: str(r.title),
    subject: str(r.subject),
  };
}

export type LecturaDeEnvios = { leidas: number; con_campana: number };

export function normalizeLecturaDeEnvios(raw: unknown): LecturaDeEnvios {
  const r = isRecord(raw) ? raw : {};
  return { leidas: num(r.leidas), con_campana: num(r.con_campana) };
}

export type Veredicto = "A" | "B" | "empate" | "sin_datos";

/** Una comparación A contra B (un público o el total). Tasas en 0 a 100. */
export type FilaDeComparacion = {
  publico: string;
  nA: number; xA: number; pctA: number | null; pctA_li: number | null; pctA_ls: number | null;
  nB: number; xB: number; pctB: number | null; pctB_li: number | null; pctB_ls: number | null;
  dif_pp: number | null; dif_li: number | null; dif_ls: number | null;
  veredicto: Veredicto;
  pocos_casos: boolean;
  horaA: string;
  horaB: string;
};

const VEREDICTOS: readonly Veredicto[] = ["A", "B", "empate", "sin_datos"];

export function normalizeFilaDeComparacion(raw: unknown): FilaDeComparacion | null {
  if (!isRecord(raw) || !Object.keys(raw).length) return null;
  const v = str(raw.veredicto) as Veredicto;
  return {
    publico: str(raw.publico),
    nA: num(raw.nA), xA: num(raw.xA), pctA: numOrNull(raw.pctA), pctA_li: numOrNull(raw.pctA_li), pctA_ls: numOrNull(raw.pctA_ls),
    nB: num(raw.nB), xB: num(raw.xB), pctB: numOrNull(raw.pctB), pctB_li: numOrNull(raw.pctB_li), pctB_ls: numOrNull(raw.pctB_ls),
    dif_pp: numOrNull(raw.dif_pp), dif_li: numOrNull(raw.dif_li), dif_ls: numOrNull(raw.dif_ls),
    veredicto: VEREDICTOS.includes(v) ? v : "sin_datos",
    pocos_casos: bool(raw.pocos_casos),
    horaA: str(raw.horaA),
    horaB: str(raw.horaB),
  };
}

export type PruebaCmh = { or: number | null; or_li: number | null; or_ls: number | null; p: number | null; p_txt: string };

export function normalizeCmh(raw: unknown): PruebaCmh | null {
  if (!isRecord(raw) || !Object.keys(raw).length) return null;
  return { or: numOrNull(raw.or), or_li: numOrNull(raw.or_li), or_ls: numOrNull(raw.or_ls), p: numOrNull(raw.p), p_txt: str(raw.p_txt) };
}

export type ResultadoDeRonda = {
  ronda: number;
  etiqueta: string;
  comparable: boolean;
  en_curso: boolean;
  horizonte_h: number | null;
  horaA: string;
  horaB: string;
  fecha: string;
  publicos: FilaDeComparacion[];
  total: FilaDeComparacion | null;
  cmh: PruebaCmh | null;
  ganador: Grupo | "empate" | "";
  excluidos: { publico: string; motivo: string }[];
  curvas: { horas: number; pctA: number | null; pctB: number | null }[];
  lectura: string;
};

export type ResultadosDeHorario = {
  rondas: ResultadoDeRonda[];
  cruce: { confirmado: boolean; texto: string };
  semilla: number | null;
  personas: number;
  con_completa: number;
  respuestas_leidas_en: string;
  horas_de_mailchimp: number;
  horas_del_plan: number;
};

const filas = (v: unknown) => lista(v).map(normalizeFilaDeComparacion).filter((f): f is FilaDeComparacion => f !== null);

export function normalizeResultadosDeHorario(raw: unknown): ResultadosDeHorario {
  const r = isRecord(raw) ? raw : {};
  const cruce = isRecord(r.cruce) ? r.cruce : {};
  return {
    rondas: registros(r.rondas).map((x) => {
      const g = str(x.ganador);
      return {
        ronda: Math.round(num(x.ronda)),
        etiqueta: str(x.etiqueta) || `Recordatorio ${num(x.ronda)}`,
        comparable: bool(x.comparable),
        en_curso: bool(x.en_curso),
        horizonte_h: numOrNull(x.horizonte_h),
        horaA: str(x.horaA),
        horaB: str(x.horaB),
        fecha: str(x.fecha),
        publicos: filas(x.publicos),
        total: normalizeFilaDeComparacion(x.total),
        cmh: normalizeCmh(x.cmh),
        ganador: g === "A" || g === "B" || g === "empate" ? g : "",
        excluidos: registros(x.excluidos).map((e) => ({ publico: str(e.publico), motivo: str(e.motivo) })).filter((e) => e.publico),
        curvas: registros(x.curvas).map((c) => ({ horas: num(c.horas), pctA: numOrNull(c.pctA), pctB: numOrNull(c.pctB) })),
        lectura: str(x.lectura).trim(),
      };
    }),
    cruce: { confirmado: bool(cruce.confirmado), texto: str(cruce.texto).trim() },
    semilla: numOrNull(r.semilla),
    personas: num(r.personas),
    con_completa: num(r.con_completa),
    respuestas_leidas_en: str(r.respuestas_leidas_en),
    horas_de_mailchimp: num(r.horas_de_mailchimp),
    horas_del_plan: num(r.horas_del_plan),
  };
}

// ---------- Correo personal ----------

export type SorteoCorreoPersonal = { semilla: number | null; campanas: Record<string, { personal: number; control: number }> };

export function normalizeSorteoCorreoPersonal(raw: unknown): SorteoCorreoPersonal {
  const r = isRecord(raw) ? raw : {};
  const c = isRecord(r.campanas) ? r.campanas : {};
  return {
    semilla: numOrNull(r.semilla),
    campanas: Object.fromEntries(Object.entries(c).filter(([, v]) => isRecord(v)).map(([k, v]) => {
      const x = v as Record<string, unknown>;
      return [k, { personal: num(x.personal), control: num(x.control) }];
    })),
  };
}

export type CargaCorreoPersonal = { campanas: { campaign_id: string; cargados: number; rechazados: number; motivos: { code: string; n: number }[] }[] };

export function normalizeCargaCorreoPersonal(raw: unknown): CargaCorreoPersonal {
  const r = isRecord(raw) ? raw : {};
  return {
    campanas: registros(r.campanas).map((c) => {
      const m = isRecord(c.motivos) ? c.motivos : {};
      return {
        campaign_id: str(c.campaign_id),
        cargados: num(c.cargados),
        rechazados: num(c.rechazados),
        motivos: Object.entries(m).map(([code, n]) => ({ code: code || "desconocido", n: num(n) })).filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
      };
    }),
  };
}

export type EfectoCorreoPersonal = {
  publicos: FilaDeComparacion[];
  total: FilaDeComparacion | null;
  cmh: PruebaCmh | null;
  dias: number | null;
  rechazados: number;
  lectura: string;
  desde: string;
};

export function normalizeEfectoCorreoPersonal(raw: unknown): EfectoCorreoPersonal {
  const r = isRecord(raw) ? raw : {};
  return {
    publicos: filas(r.publicos),
    total: normalizeFilaDeComparacion(r.total),
    cmh: normalizeCmh(r.cmh),
    dias: numOrNull(r.dias),
    rechazados: num(r.rechazados),
    lectura: str(r.lectura).trim(),
    desde: str(r.desde),
  };
}

// ---------- Llamadas ----------

const conCuerpo = (method: "POST" | "PUT", url: string, body: unknown = {}) => apiFetch(url, {
  method,
  headers: headers({ "Content-Type": "application/json" }),
  body: JSON.stringify(body),
});
const leer = async (url: string) => handle<unknown>(await apiFetch(url, { headers: headers() }));

export async function apiSeguimiento(): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await leer(BASE));
}

export type CambioDeConfig = {
  list_id?: string;
  tag?: string;
  archivar?: boolean;
  antes_de_envio?: { activo?: boolean; minutos?: number };
  encuestas?: Record<string, string>;
};

export async function apiGuardarConfigSeguimiento(cambio: CambioDeConfig): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await handle<unknown>(await conCuerpo("PUT", `${BASE}/config`, cambio)));
}

/** Quién respondió en todas las campañas (job); el resultado se lee con `normalizeResultadoDeActualizacion`. */
export async function apiActualizarTodas(input: { archivar?: boolean } = {}): Promise<InicioDeActualizacion> {
  return normalizeInicioDeActualizacion(await handle<unknown>(await conCuerpo("POST", `${BASE}/sync`, input)));
}

export async function apiProgramadas(): Promise<CampanaProgramada[]> {
  return normalizeProgramadas(await leer(`${BASE}/programadas`));
}

/** El latido de "antes de cada envío": el backend decide si toca actualizar. */
export async function apiAntesDeEnvio(): Promise<LatidoAntesDeEnvio> {
  return normalizeLatido(await handle<unknown>(await conCuerpo("POST", `${BASE}/antes-de-envio`)));
}

export type CambioDeHorario = {
  campanas?: string[];
  oficina?: string[];
  etiquetas?: { A?: string; B?: string };
  horizonte_h?: number;
  oficina_desde?: string;
  oficina_hasta?: string;
};

export async function apiGuardarHorario(cambio: CambioDeHorario): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await handle<unknown>(await conCuerpo("PUT", `${BASE}/horario`, cambio)));
}

export async function apiSortearHorario(input: { semilla: number; rehacer?: boolean }): Promise<SorteoDeGrupos> {
  return normalizeSorteoDeGrupos(await handle<unknown>(await conCuerpo("POST", `${BASE}/horario/sortear`, input)));
}

export async function apiEtiquetarGrupos(): Promise<InicioDeJob> {
  return normalizeInicioDeJob(await handle<unknown>(await conCuerpo("POST", `${BASE}/horario/etiquetar`)));
}

export type FilaDelPlanParaGuardar = Pick<FilaDelPlan, "ronda" | "campaign_id" | "grupo" | "programado" | "mailchimp_id">;

export async function apiGuardarPlan(plan: FilaDelPlanParaGuardar[]): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await handle<unknown>(await conCuerpo("PUT", `${BASE}/horario/plan`, { plan })));
}

export type PropuestaDePlan = {
  rondas: { ronda: number; fecha: string }[];
  manana: string;
  noche: string;
  oficina_temprano: string;
  oficina_media: string;
};

export async function apiProponerPlan(proponer: PropuestaDePlan): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await handle<unknown>(await conCuerpo("PUT", `${BASE}/horario/plan`, { proponer })));
}

/** Crea el BORRADOR de un grupo en Mailchimp. No hay ruta que envíe ni programe. */
export async function apiBorradorDeGrupo(input: {
  campaign_id: string;
  ronda: number;
  grupo: Grupo;
  from_name: string;
  reply_to: string;
}): Promise<BorradorDeGrupo> {
  const body = { ...input, from_name: input.from_name.trim(), reply_to: input.reply_to.trim() };
  return normalizeBorradorDeGrupo(await handle<unknown>(await conCuerpo("POST", `${BASE}/horario/borrador`, body)));
}

export async function apiLeerEnvios(): Promise<LecturaDeEnvios> {
  return normalizeLecturaDeEnvios(await handle<unknown>(await conCuerpo("POST", `${BASE}/horario/leer-envios`)));
}

export async function apiResultadosDeHorario(horizonte_h: number): Promise<ResultadosDeHorario> {
  const q = new URLSearchParams({ horizonte_h: String(horizonte_h) });
  return normalizeResultadosDeHorario(await leer(`${BASE}/horario/resultados?${q.toString()}`));
}

/** El informe en PDF: `{file_id, filename}`, para el kit de entregables. */
export async function apiInformeDeHorario(horizonte_h: number): Promise<unknown> {
  return handle<unknown>(await conCuerpo("POST", `${BASE}/horario/informe`, { horizonte_h }));
}

export type CambioDeCorreoPersonal = {
  columnas?: Record<string, string>;
  proporcion?: number;
  etiqueta?: string;
  desde?: string;
};

export async function apiGuardarCorreoPersonal(cambio: CambioDeCorreoPersonal): Promise<EstadoSeguimiento> {
  return normalizeEstadoSeguimiento(await handle<unknown>(await conCuerpo("PUT", `${BASE}/correo-personal`, cambio)));
}

export async function apiSortearCorreoPersonal(input: { semilla: number; rehacer?: boolean }): Promise<SorteoCorreoPersonal> {
  return normalizeSorteoCorreoPersonal(await handle<unknown>(await conCuerpo("POST", `${BASE}/correo-personal/sortear`, input)));
}

export async function apiCargarCorreoPersonal(): Promise<InicioDeJob> {
  return normalizeInicioDeJob(await handle<unknown>(await conCuerpo("POST", `${BASE}/correo-personal/cargar`)));
}

export async function apiEfectoCorreoPersonal(): Promise<EfectoCorreoPersonal> {
  return normalizeEfectoCorreoPersonal(await leer(`${BASE}/correo-personal/efecto`));
}
