/**
 * Cliente del sorteo de Muestra general (ADR 0090).
 *
 * Cuatro rutas propias —declarar el marco, sortear, leer la corrida vigente y
 * exportar su libro— y el bloque `general` de `/api/calc-muestra/state`. La subida del archivo y la
 * inspección de hojas NO viven aquí: se reutilizan `apiUpload` y
 * `apiCalcMuestraMarcoInspeccionarArchivo`.
 *
 * Dos reglas que este módulo sostiene:
 *
 * 1. **La π y el peso se conservan tal como llegan.** `/seleccionar` y
 *    `/corrida` serializan sin redondeo porque una π de 0.0000371 viajaba como 0
 *    con el serializador global. Redondear aquí reintroduciría el mismo defecto
 *    (peso infinito). El formateo es asunto de la vista.
 * 2. **Normalizador defensivo** (patrón `normalizeGraficosShareInspect`):
 *    jsonlite desempaca arrays de 1, los NA llegan como `null` o se omiten y el
 *    resumen de `/state` pasa por el serializador global. Un payload sin forma
 *    reconocible devuelve `null`, no un objeto a medias.
 */
import { ApiError, apiFetch, handle, headers } from "./core";
import type { CalcMuestraAvisoParametro, CalcMuestraComponente, CalcMuestraEstudio } from "./calcMuestra";

export type CalcMuestraGeneralMetodo = "mas" | "sistematico" | "pps";

/**
 * Qué significó sortear: `probabilistica` sortea el n a campo con π;
 * `censo` (cobertura censal, barrido) lista el marco entero en orden
 * aleatorio de contacto, con π = 1.
 */
export type CalcMuestraGeneralModalidad = "probabilistica" | "censo";

export const CALC_MUESTRA_GENERAL_METODOS: readonly CalcMuestraGeneralMetodo[] = [
  "mas",
  "sistematico",
  "pps",
];

/** Semilla por defecto del motor (`.CM_GENERAL_SEMILLA_DEFAULT`). */
export const CALC_MUESTRA_GENERAL_SEMILLA_DEFAULT = 20260924;

export type CalcMuestraGeneralColumnas = {
  id: string;
  /** Vacío cuando el marco no declara estrato. */
  estrato: string;
  /** Vacío cuando el marco no declara tamaño (sin PPS). */
  tamano: string;
};

export type CalcMuestraGeneralMarcoEstrato = { clave: string; N_h: number };

export type CalcMuestraGeneralMarco = {
  file_id: string;
  hoja: string;
  columnas: CalcMuestraGeneralColumnas;
  marco_hash: string;
  N: number;
  estratos: CalcMuestraGeneralMarcoEstrato[];
  declarado_at: string;
};

export type CalcMuestraGeneralCorridaMeta = {
  run_id: string;
  semilla: number;
  rng_kind: string;
  r_version: string;
  metodo: CalcMuestraGeneralMetodo;
  modalidad: CalcMuestraGeneralModalidad;
  marco_hash: string;
  config_hash: string;
  N: number;
  n_titulares: number;
  n_reservas: number;
  piso_incumplible: boolean;
  reservas_omitidas_pps: boolean;
};

export type CalcMuestraGeneralEstratoSorteo = {
  clave: string;
  N_h: number;
  n_h: number;
  n_reservas: number;
  /** Arranque del sistemático o del PPS; `null` en MAS. */
  arranque: number | null;
  /** π del estrato; `null` en PPS, donde la π es de cada unidad. */
  pi: number | null;
};

export type CalcMuestraGeneralEstadoUnidad = "titular" | "reserva";

export type CalcMuestraGeneralUnidad = {
  id: string;
  estrato: string;
  N_h: number;
  n_h: number;
  /** `null` en reservas: su π se recalcula al liberar el lote. */
  pi: number | null;
  orden: number;
  estado: CalcMuestraGeneralEstadoUnidad;
  lote_reserva: number | null;
  peso_base: number | null;
};

export type CalcMuestraGeneralCorrida = {
  corrida: CalcMuestraGeneralCorridaMeta;
  estratos: CalcMuestraGeneralEstratoSorteo[];
  /**
   * `null` cuando la corrida viene del resumen de `/state`, que viaja sin
   * listado. Un arreglo vacío es otra cosa: la corrida trajo listado y está
   * vacío.
   */
  unidades: CalcMuestraGeneralUnidad[] | null;
  /** El n a campo del componente con el que se sorteó. */
  n_fuente: number | null;
  componente_id: string;
  sorteado_at: string;
};

export type CalcMuestraGeneralResumen = {
  marcos: Record<string, CalcMuestraGeneralMarco>;
  corridas: Record<string, CalcMuestraGeneralCorrida>;
};

export type CalcMuestraGeneralErrorDetalle = {
  ids_duplicados: string[];
  filas_sin_id: number[];
  /** Ids con tamaño inválido (PPS). */
  ids: string[];
  /** Ids sin estrato cuando el marco declara columna de estrato. */
  ids_sin_estrato: string[];
};

/** Error del motor con el `error.details` que `ApiError` no conserva. */
export class CalcMuestraGeneralApiError extends ApiError {
  readonly detalle: CalcMuestraGeneralErrorDetalle;
  constructor(origen: ApiError, detalle: CalcMuestraGeneralErrorDetalle) {
    super(origen.code, "");
    // `ApiError` ya compuso «mensaje · CODIGO»; se conserva igual.
    this.message = origen.message;
    this.name = "CalcMuestraGeneralApiError";
    this.detalle = detalle;
  }
}

// ---------------------------------------------------------------------------
// Lectores defensivos
// ---------------------------------------------------------------------------

function unwrap(v: unknown): unknown {
  return Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  const u = unwrap(v);
  return typeof u === "object" && u !== null && !Array.isArray(u)
    ? (u as Record<string, unknown>)
    : null;
}

function asText(v: unknown): string {
  const u = unwrap(v);
  if (typeof u === "string") return u === "NA" ? "" : u;
  if (typeof u === "number" && Number.isFinite(u)) return String(u);
  return "";
}

/** Número tal cual, sin redondear. `null` si falta o no es finito. */
function asNumOrNull(v: unknown): number | null {
  const u = unwrap(v);
  if (typeof u === "number") return Number.isFinite(u) ? u : null;
  if (typeof u === "string") {
    const t = u.trim();
    if (!t || t === "NA") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asCount(v: unknown): number {
  const n = asNumOrNull(v);
  return n == null ? 0 : Math.max(0, Math.round(n));
}

function asBool(v: unknown): boolean {
  const u = unwrap(v);
  return u === true || u === "TRUE" || u === "true";
}

function asList(v: unknown): unknown[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function asMetodo(v: unknown): CalcMuestraGeneralMetodo {
  const t = asText(v);
  return t === "sistematico" || t === "pps" ? t : "mas";
}

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

export function normalizeCalcMuestraGeneralMarco(raw: unknown): CalcMuestraGeneralMarco | null {
  const r = asRecord(raw);
  if (!r) return null;
  const N = asNumOrNull(r.N);
  const col = asRecord(r.columnas) ?? {};
  const columnas: CalcMuestraGeneralColumnas = {
    id: asText(col.id),
    estrato: asText(col.estrato),
    tamano: asText(col.tamano),
  };
  // Sin N ni columna de id no hay marco declarado que mostrar.
  if (N == null || !columnas.id) return null;
  const estratos = asList(r.estratos)
    .map((item): CalcMuestraGeneralMarcoEstrato | null => {
      const row = asRecord(item);
      if (!row) return null;
      const clave = asText(row.clave);
      if (!clave) return null;
      return { clave, N_h: asCount(row.N_h) };
    })
    .filter((row): row is CalcMuestraGeneralMarcoEstrato => row != null);
  return {
    file_id: asText(r.file_id),
    hoja: asText(r.hoja),
    columnas,
    marco_hash: asText(r.marco_hash),
    N: Math.max(0, Math.round(N)),
    estratos,
    declarado_at: asText(r.declarado_at),
  };
}

function normalizeCorridaMeta(raw: unknown): CalcMuestraGeneralCorridaMeta | null {
  const r = asRecord(raw);
  if (!r) return null;
  const run_id = asText(r.run_id);
  if (!run_id) return null;
  return {
    run_id,
    semilla: asCount(r.semilla),
    rng_kind: asText(r.rng_kind),
    r_version: asText(r.r_version),
    metodo: asMetodo(r.metodo),
    // Corridas anteriores a la modalidad eran todas probabilísticas.
    modalidad: asText(r.modalidad) === "censo" ? "censo" : "probabilistica",
    marco_hash: asText(r.marco_hash),
    config_hash: asText(r.config_hash),
    N: asCount(r.N),
    n_titulares: asCount(r.n_titulares),
    n_reservas: asCount(r.n_reservas),
    piso_incumplible: asBool(r.piso_incumplible),
    reservas_omitidas_pps: asBool(r.reservas_omitidas_pps),
  };
}

function normalizeEstratoSorteo(raw: unknown): CalcMuestraGeneralEstratoSorteo | null {
  const r = asRecord(raw);
  if (!r) return null;
  const clave = asText(r.clave);
  if (!clave) return null;
  return {
    clave,
    N_h: asCount(r.N_h),
    n_h: asCount(r.n_h),
    n_reservas: asCount(r.n_reservas),
    arranque: asNumOrNull(r.arranque),
    pi: asNumOrNull(r.pi),
  };
}

function normalizeUnidad(raw: unknown): CalcMuestraGeneralUnidad | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = asText(r.id);
  if (!id) return null;
  const estado: CalcMuestraGeneralEstadoUnidad = asText(r.estado) === "reserva" ? "reserva" : "titular";
  const lote = asNumOrNull(r.lote_reserva);
  return {
    id,
    estrato: asText(r.estrato),
    N_h: asCount(r.N_h),
    n_h: asCount(r.n_h),
    pi: asNumOrNull(r.pi),
    orden: asCount(r.orden),
    estado,
    lote_reserva: lote == null ? null : Math.round(lote),
    peso_base: asNumOrNull(r.peso_base),
  };
}

/**
 * Corrida de `/seleccionar`, `/corrida` o del resumen de `/state`.
 * La respuesta HTTP trae `corrida` anidada junto a `estratos` y `unidades`.
 */
export function normalizeCalcMuestraGeneralCorrida(raw: unknown): CalcMuestraGeneralCorrida | null {
  const r = asRecord(raw);
  if (!r) return null;
  const corrida = normalizeCorridaMeta(r.corrida);
  if (!corrida) return null;
  const estratos = asList(r.estratos)
    .map(normalizeEstratoSorteo)
    .filter((row): row is CalcMuestraGeneralEstratoSorteo => row != null);
  const unidades = "unidades" in r && r.unidades != null
    ? asList(r.unidades)
      .map(normalizeUnidad)
      .filter((row): row is CalcMuestraGeneralUnidad => row != null)
    : null;
  const n_fuente = asNumOrNull(r.n_fuente);
  return {
    corrida,
    estratos,
    unidades,
    n_fuente: n_fuente == null ? null : Math.round(n_fuente),
    componente_id: asText(r.componente_id),
    sorteado_at: asText(r.sorteado_at),
  };
}

export function normalizeCalcMuestraGeneralResumen(raw: unknown): CalcMuestraGeneralResumen {
  const r = asRecord(raw) ?? {};
  const marcos: Record<string, CalcMuestraGeneralMarco> = {};
  for (const [cid, valor] of Object.entries(asRecord(r.marcos) ?? {})) {
    const marco = normalizeCalcMuestraGeneralMarco(valor);
    if (marco) marcos[cid] = marco;
  }
  const corridas: Record<string, CalcMuestraGeneralCorrida> = {};
  for (const [cid, valor] of Object.entries(asRecord(r.corridas) ?? {})) {
    const corrida = normalizeCalcMuestraGeneralCorrida(valor);
    if (corrida) corridas[cid] = { ...corrida, componente_id: corrida.componente_id || cid };
  }
  return { marcos, corridas };
}

export function normalizeCalcMuestraGeneralErrorDetalle(raw: unknown): CalcMuestraGeneralErrorDetalle {
  const r = asRecord(raw) ?? {};
  return {
    ids_duplicados: asList(r.ids_duplicados).map(asText).filter(Boolean),
    filas_sin_id: asList(r.filas_sin_id)
      .map(asNumOrNull)
      .filter((n): n is number => n != null)
      .map((n) => Math.round(n)),
    ids: asList(r.ids).map(asText).filter(Boolean),
    ids_sin_estrato: asList(r.ids_sin_estrato).map(asText).filter(Boolean),
  };
}

function estudioOrNull(raw: unknown): CalcMuestraEstudio | null {
  const r = asRecord(raw);
  if (!r || !Array.isArray(r.componentes)) return null;
  return r as unknown as CalcMuestraEstudio;
}

function componenteOrNull(raw: unknown): CalcMuestraComponente | null {
  const r = asRecord(raw);
  if (!r || typeof r.id !== "string" || !r.id) return null;
  return r as unknown as CalcMuestraComponente;
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

/**
 * `handle` de la casa más el `error.details` del motor. Se clona la respuesta
 * antes de que `handle` consuma el cuerpo para no reimplementar su manejo de
 * sesión ni de errores.
 */
async function handleConDetalle<T>(res: Response): Promise<T> {
  if (res.ok) return handle<T>(res);
  const copia = res.clone();
  try {
    return await handle<T>(res);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const cuerpo: unknown = await copia.json().catch(() => null);
    const details = asRecord(asRecord(cuerpo)?.error)?.details;
    throw new CalcMuestraGeneralApiError(e, normalizeCalcMuestraGeneralErrorDetalle(details));
  }
}

function sinForma(ruta: string): ApiError {
  return new ApiError(
    "E_CALC_MUESTRA_GENERAL_RESPUESTA",
    `La respuesta de ${ruta} no trae la forma esperada. Reintenta; si persiste, reinicia la app.`,
  );
}

export type CalcMuestraGeneralDeclararMarcoInput = {
  componente_id: string;
  file_id: string;
  hoja?: string;
  columnas: { id: string; estrato?: string; tamano?: string };
};

export type CalcMuestraGeneralDeclararMarcoRespuesta = {
  marco: CalcMuestraGeneralMarco;
  componente: CalcMuestraComponente | null;
  /** El estudio que quedó en sesión; `null` si llegó sin forma reconocible. */
  estudio: CalcMuestraEstudio | null;
};

export async function apiCalcMuestraGeneralDeclararMarco(
  input: CalcMuestraGeneralDeclararMarcoInput,
): Promise<CalcMuestraGeneralDeclararMarcoRespuesta> {
  const columnas: Record<string, string> = { id: input.columnas.id };
  if (input.columnas.estrato) columnas.estrato = input.columnas.estrato;
  if (input.columnas.tamano) columnas.tamano = input.columnas.tamano;
  const body: Record<string, unknown> = {
    componente_id: input.componente_id,
    file_id: input.file_id,
    columnas,
  };
  if (input.hoja) body.hoja = input.hoja;
  const raw = await handleConDetalle<unknown>(
    await apiFetch("/api/calc-muestra/general/marco", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  const r = asRecord(raw) ?? {};
  const marco = normalizeCalcMuestraGeneralMarco(r.marco);
  if (!marco) throw sinForma("/general/marco");
  return { marco, componente: componenteOrNull(r.componente), estudio: estudioOrNull(r.estudio) };
}

export type CalcMuestraGeneralSeleccionarInput = {
  componente_id: string;
  metodo: CalcMuestraGeneralMetodo;
  semilla?: number;
  orden_por?: string;
  reservas_por_estrato?: number;
};

export async function apiCalcMuestraGeneralSeleccionar(
  input: CalcMuestraGeneralSeleccionarInput,
): Promise<CalcMuestraGeneralCorrida> {
  const body: Record<string, unknown> = {
    componente_id: input.componente_id,
    metodo: input.metodo,
  };
  if (input.semilla != null) body.semilla = input.semilla;
  if (input.orden_por) body.orden_por = input.orden_por;
  if (input.reservas_por_estrato != null) body.reservas_por_estrato = input.reservas_por_estrato;
  const raw = await handleConDetalle<unknown>(
    await apiFetch("/api/calc-muestra/general/seleccionar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  const corrida = normalizeCalcMuestraGeneralCorrida(raw);
  if (!corrida) throw sinForma("/general/seleccionar");
  return corrida;
}

/** La corrida vigente con su listado; `null` si el componente no se sorteó. */
export async function apiCalcMuestraGeneralCorrida(
  componenteId: string,
): Promise<CalcMuestraGeneralCorrida | null> {
  try {
    const raw = await handleConDetalle<unknown>(
      await apiFetch(
        `/api/calc-muestra/general/corrida?componente_id=${encodeURIComponent(componenteId)}`,
        { headers: headers() },
      ),
    );
    return normalizeCalcMuestraGeneralCorrida(raw);
  } catch (e) {
    if (e instanceof ApiError && e.code === "E_CALC_MUESTRA_GENERAL_SIN_CORRIDA") return null;
    throw e;
  }
}

/**
 * Marcos declarados y corridas (sin listado) del bloque `general` de
 * `/api/calc-muestra/state`.
 */
export async function apiCalcMuestraGeneralResumen(): Promise<CalcMuestraGeneralResumen> {
  const raw = await handle<unknown>(
    await apiFetch("/api/calc-muestra/state", { headers: headers() }),
  );
  return normalizeCalcMuestraGeneralResumen(asRecord(raw)?.general);
}

export type CalcMuestraGeneralExport = { file_id: string; filename: string; size: number };

/**
 * Libro de entrega de la corrida vigente (Corrida, Memoria de cálculo,
 * Estratos, Listado). Devuelve el `file_id` registrado; la descarga va por
 * `downloadUrl`, igual que `/aulas/exportar`.
 */
export async function apiCalcMuestraGeneralExportar(componenteId: string): Promise<CalcMuestraGeneralExport> {
  const raw = await handleConDetalle<unknown>(
    await apiFetch("/api/calc-muestra/general/exportar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ componente_id: componenteId }),
    }),
  );
  const exp = asRecord(asRecord(raw)?.export);
  const file_id = asText(exp?.file_id);
  if (!exp || !file_id) throw sinForma("/general/exportar");
  return { file_id, filename: asText(exp.filename), size: asCount(exp.size) };
}

// ---------------------------------------------------------------------------
// Parámetros por técnica, memoria de cálculo y avisos (E7)
// ---------------------------------------------------------------------------

/**
 * Un parámetro que la técnica consume, con el rótulo y la ayuda del motor.
 * `opciones` sólo cuando el motor lo declara de opciones cerradas.
 */
export type CalcMuestraParametroDeTecnica = {
  clave: string;
  rotulo: string;
  ayuda: string;
  tipo: "numero" | "opciones";
  opciones: string[];
};

/** Catálogo `técnica → parámetros que consume`, en el orden del motor. */
export type CalcMuestraCatalogoParametros = Record<string, CalcMuestraParametroDeTecnica[]>;

/**
 * `GET /tecnicas/parametros` → `{ok, tecnicas: [{tecnica, parametros}]}`.
 * Una técnica sin parámetros es válida (lista vacía); un payload sin
 * `tecnicas` reconocibles devuelve `null`.
 */
export function normalizeCalcMuestraCatalogoParametros(raw: unknown): CalcMuestraCatalogoParametros | null {
  const r = asRecord(raw);
  if (!r || r.tecnicas == null) return null;
  const catalogo: CalcMuestraCatalogoParametros = {};
  for (const item of asList(r.tecnicas)) {
    const t = asRecord(item);
    const tecnica = asText(t?.tecnica);
    if (!t || !tecnica) continue;
    catalogo[tecnica] = asList(t.parametros)
      .map((p): CalcMuestraParametroDeTecnica | null => {
        const row = asRecord(p);
        const clave = asText(row?.clave);
        if (!row || !clave) return null;
        const opciones = asList(row.opciones).map(asText).filter(Boolean);
        // Sin opciones que ofrecer, un campo «de opciones» no es elegible: número.
        const tipo = asText(row.tipo) === "opciones" && opciones.length > 0 ? "opciones" : "numero";
        return { clave, rotulo: asText(row.rotulo) || clave, ayuda: asText(row.ayuda), tipo, opciones: tipo === "opciones" ? opciones : [] };
      })
      .filter((p): p is CalcMuestraParametroDeTecnica => p != null);
  }
  return Object.keys(catalogo).length > 0 ? catalogo : null;
}

export async function apiCalcMuestraTecnicasParametros(): Promise<CalcMuestraCatalogoParametros> {
  const raw = await handle<unknown>(
    await apiFetch("/api/calc-muestra/tecnicas/parametros", { headers: headers() }),
  );
  const catalogo = normalizeCalcMuestraCatalogoParametros(raw);
  if (!catalogo) throw sinForma("/tecnicas/parametros");
  return catalogo;
}

/** Un paso de la memoria sustituida: fórmula, valores puestos y resultado. */
export type CalcMuestraMemoriaPaso = {
  paso: string;
  formula: string;
  sustitucion: string;
  resultado: string;
};

/**
 * `resultado.memoria_calculo`. El data.frame llega por filas
 * (`[{paso, formula, …}]`); si llegara por columnas (`{paso: [...], …}`) se
 * recompone. Filas sin `paso` se descartan.
 */
export function normalizeCalcMuestraMemoriaCalculo(raw: unknown): CalcMuestraMemoriaPaso[] {
  if (raw == null) return [];
  const columnas = !Array.isArray(raw) && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const columna = (clave: string, i: number): unknown => {
    const valores = columnas?.[clave];
    return Array.isArray(valores) ? valores[i] : null;
  };
  const pasos = columnas?.paso;
  const filas: unknown[] = Array.isArray(pasos)
    ? pasos.map((paso: unknown, i) => ({
        paso,
        formula: columna("formula", i),
        sustitucion: columna("sustitucion", i),
        resultado: columna("resultado", i),
      }))
    : asList(raw);
  return filas
    .map((item): CalcMuestraMemoriaPaso | null => {
      const row = asRecord(item);
      const paso = asText(row?.paso);
      if (!row || !paso) return null;
      return {
        paso,
        formula: asText(row.formula),
        sustitucion: asText(row.sustitucion),
        resultado: asText(row.resultado),
      };
    })
    .filter((row): row is CalcMuestraMemoriaPaso => row != null);
}

/** `avisos_parametros` del componente o del resultado; sin forma → vacío. */
export function normalizeCalcMuestraAvisosParametros(raw: unknown): CalcMuestraAvisoParametro[] {
  return asList(raw)
    .map((item): CalcMuestraAvisoParametro | null => {
      const row = asRecord(item);
      const param = asText(row?.param);
      const texto = asText(row?.texto);
      const recibido = asNumOrNull(row?.recibido);
      const usado = asNumOrNull(row?.usado);
      if (!row || !param || !texto || recibido == null || usado == null) return null;
      return { param, recibido, usado, texto };
    })
    .filter((row): row is CalcMuestraAvisoParametro => row != null);
}
