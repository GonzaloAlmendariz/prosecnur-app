// codificacion.ts — codificación (familias, plantilla, agrupamiento).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { ApiError, apiFetch, handle, headers } from "./core";

// ---------- Validación ----------
// Los bindings v1 (apiValidacionBuildPlan, apiValidacionExportPlan,
// apiValidacionImportPlan, apiValidacionAuditoria,
// apiValidacionAuditoriaRegla, graficoSeccionesUrl, graficoPreguntasUrl)
// se removieron tras el cutover a Validación v2. Los reemplazos viven
// en los endpoints /api/validacion/v2/... consumidos por
// features/validacion/* directamente.

// ---------- Codificación ----------

// ---------- Codificación: modelo canónico JSON ----------

export type FamiliaRow = {
  use: boolean;
  q_order: number;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  modo_so: "" | "padre" | "hijo";
  parent: string;
  parent_label: string;
  list_norm: string;
  parent_col: string;
  other_dummy_col: string;
  text_col: string;
  parent_col_cands?: string;
  other_dummy_cands?: string;
  text_col_cands?: string;
  dummy_cands?: string;
};

export type FamiliasDraftResponse = {
  ok: true;
  rows: FamiliaRow[];
  source: "suggestion" | "draft";
  updated_at: string;
};

export type FamiliasCommitResumen = {
  total_filas_excel: number;
  aceptadas_total: number;
  aceptadas_sm: number;
  aceptadas_so: number;
  aceptadas_int: number;
  aceptadas_text: number;
  excluidas: number;
  textos_adoptados: number;
  textos_huerfanos: number;
};

export type FamiliasCommitResponse = {
  ok: true;
  n_select_one: number;
  n_select_multiple: number;
  n_integer: number;
  n_text: number;
  n_huerfanos: number;
  resumen: FamiliasCommitResumen[];
};

export async function apiCodifColumnas() {
  return handle<{ ok: true; columnas: string[] }>(
    await apiFetch("/api/codificacion/columnas", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftGet() {
  return handle<FamiliasDraftResponse>(
    await apiFetch("/api/codificacion/familias/draft", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftSave(rows: FamiliaRow[]) {
  return handle<{ ok: true; n_rows: number; updated_at: string }>(
    await apiFetch("/api/codificacion/familias/draft", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rows }),
    })
  );
}

export async function apiCodifFamiliasCommit() {
  return handle<FamiliasCommitResponse>(
    await apiFetch("/api/codificacion/familias/commit", { method: "POST", headers: headers() })
  );
}

// ---------- Codificación: modelo task-oriented ----------

export type PreguntaStatus =
  | "no-aplica"
  | "requiere-config"
  | "sin-datos"
  | "no-iniciado"
  | "en-curso"
  | "completo";

export type PreguntaSubtipo =
  | "select_one_padre"
  | "select_one_hijo"
  | "select_one_sin_modo"
  | "select_multiple"
  | "integer"
  | "text";

export type CandidatoTexto = {
  col: string;
  parent_detectado: string;
  confianza: number; // 0-1
};

export type ParejaCommitteada = {
  child_col: string;
  modo_so: "" | "padre" | "hijo";
  dummy_col: string;
};

export type OpcionSM = {
  codigo: string;
  label: string;
  col_dummy: string;
  existe_en_data: boolean;
  es_otros_sugerido: boolean;
};

export type PreguntaAbierta = {
  parent: string;
  parent_label: string;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  subtipo: PreguntaSubtipo;
  modo_so: "" | "padre" | "hijo";
  text_col: string;
  parent_col: string;
  list_norm: string;
  col_efectiva: string;
  n_respuestas: number;
  n_unicas: number;
  n_codificadas: number;
  status: PreguntaStatus;
  habilitada: boolean;
  preview: string[];
  section: string;
  section_label: string;
  q_order: number | null;
  candidatos_texto: CandidatoTexto[];
  pareja: ParejaCommitteada | Record<string, never> | null;
  opciones_sm?: OpcionSM[];
  marcada: boolean;
  marcada_auto: boolean;
  /** ADR 0078 — el vocabulario de decisiones, derivado de `status`. */
  decision?: CodifDecision;
  /** Presente sólo si se registró la decisión de no categorizar. */
  no_categorizar?: { motivo: string; decidido_en: string };
};

// ADR 0078: una codificación está completa cuando no le quedan variables
// marcadas sin decidir. Las tres primeras cierran; `sin_marcar` no entra en
// ningún conteo; las tres últimas dejan trabajo abierto.
export type CodifDecision =
  | "categorizada"
  | "no_categorizar"
  | "sin_material"
  | "sin_marcar"
  | "pendiente"
  | "pendiente_parcial"
  | "requiere_config";

export const CODIF_DECISIONES_ABIERTAS: readonly CodifDecision[] = [
  "pendiente",
  "pendiente_parcial",
  "requiere_config",
];

export type CodifPendiente = {
  parent: string;
  parent_label: string;
  decision: CodifDecision;
  n_respuestas: number;
  n_unicas: number;
  n_codificadas: number;
};

export type CodifResumenDecisiones = {
  marcadas: number;
  sin_decidir: number;
  categorizadas: number;
  no_categorizar: number;
  sin_material: number;
  pendientes: CodifPendiente[];
};

/** Lo que se entrega sin recodificar; `deliberado` separa la decisión del olvido. */
export type CodifSinRecodificar = {
  parent: string;
  parent_label: string;
  decision: CodifDecision;
  motivo: string;
  n_respuestas: number;
  deliberado: boolean;
  /** Cerrada con su «Otro» emparejado: sus textos pueden quedar en «Otro». */
  con_texto_otro?: boolean;
};

// ---------- Lo que `/aplicar` no aplicó (ADR 0100, P1) ----------
//
// Si a la base le falta la columna de texto de una pregunta codificada, su
// catálogo no se aplica; y un texto que no está en ningún grupo se queda sin
// código. Las dos cosas las calcula `api/R/codificacion_omitidas.R`; aquí se
// normalizan a la defensiva porque R entrega escalares como vectores de largo
// uno y una lista de largo uno puede llegar desenrollada.

export type CodifOmitidaMotivo =
  | "sin_grupos"
  | "sin_fila"
  | "sin_modo"
  | "sin_columna_texto"
  | "sin_columna_padre"
  | "tipo_no_soportado"
  | "sin_variable_madre"
  | "no_se_pudo_aplicar";

/** Una pregunta del catálogo que `/aplicar` no aplicó, con su causa en llano. */
export type CodifOmitida = {
  pregunta: string;
  motivo: CodifOmitidaMotivo;
  mensaje: string;
  /** Sólo en agrupaciones: la variable que no se creó. */
  variable_nueva: string | null;
};

/** Textos de una pregunta aplicada que no están en ningún grupo. */
export type CodifTextosSinCodigo = {
  pregunta: string;
  columna: string;
  casos: number;
  textos: number;
  ejemplos: string[];
};

export type CodifAplicarAvisos = {
  omitidas: CodifOmitida[];
  textos_sin_codigo: CodifTextosSinCodigo[];
  /**
   * Qué diagnóstico falló en el backend (p. ej. «las preguntas omitidas»).
   * Con algo aquí, las dos listas pueden estar incompletas: vacías no
   * significa «no se omitió nada» (ADR 0100, cierre del verificador).
   */
  avisos_incompletos: string[];
};

const CODIF_OMITIDA_MOTIVOS: readonly CodifOmitidaMotivo[] = [
  "sin_grupos",
  "sin_fila",
  "sin_modo",
  "sin_columna_texto",
  "sin_columna_padre",
  "tipo_no_soportado",
  "sin_variable_madre",
  "no_se_pudo_aplicar",
];

export const CODIF_MAX_EJEMPLOS_SIN_CODIGO = 5;

function codifRegistro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function codifEscalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function codifTexto(value: unknown): string {
  const v = codifEscalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function codifEntero(value: unknown): number {
  const v = codifEscalar(value);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Una lista de largo uno puede llegar desenrollada como un único objeto o escalar. */
function codifLista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === "object" && !Object.keys(value).length) return [];
  return [value];
}

function normalizarOmitida(raw: unknown): CodifOmitida | null {
  const r = codifRegistro(raw);
  const pregunta = codifTexto(r.pregunta);
  if (!pregunta) return null;
  const motivoCrudo = codifTexto(r.motivo);
  const motivo = (CODIF_OMITIDA_MOTIVOS as readonly string[]).includes(motivoCrudo)
    ? (motivoCrudo as CodifOmitidaMotivo)
    : "no_se_pudo_aplicar";
  return {
    pregunta,
    motivo,
    // El backend siempre explica la causa; sin mensaje, al menos no se calla.
    mensaje: codifTexto(r.mensaje) || "El catálogo no se pudo aplicar.",
    variable_nueva: codifTexto(r.variable_nueva) || null,
  };
}

function normalizarTextosSinCodigo(raw: unknown): CodifTextosSinCodigo | null {
  const r = codifRegistro(raw);
  const pregunta = codifTexto(r.pregunta);
  const casos = codifEntero(r.casos);
  if (!pregunta || casos <= 0) return null;
  const ejemplos = codifLista(r.ejemplos)
    .map(codifTexto)
    .filter((e) => e.length > 0)
    .slice(0, CODIF_MAX_EJEMPLOS_SIN_CODIGO);
  return {
    pregunta,
    columna: codifTexto(r.columna),
    casos,
    // Con casos > 0 hay al menos un texto, y nunca menos que los ejemplos.
    textos: Math.max(codifEntero(r.textos), ejemplos.length, 1),
    ejemplos,
  };
}

/**
 * `motivo_omision` de una pregunta del plan de adaptación (ADR 0100, P1): el
 * mismo mensaje que el aviso de `/aplicar` cuando `bridge_soportado` es falso.
 * R puede entregarlo como vector de largo uno o lista vacía; sin texto, "".
 */
export function normalizeCodifMotivoOmision(raw: unknown): string {
  return codifTexto(raw);
}

/**
 * `aviso_fuente` de `/aplicar` (B1): Codificación leyó otro número de casos que el de la base, así que lo adaptado no
 * corresponde a la base vigente. Texto o `null`; un `NULL` de R llega como `{}` y no es aviso.
 */
export function normalizeCodifAvisoFuente(raw: unknown): string | null {
  const v = codifRegistro(raw).aviso_fuente;
  const texto = Array.isArray(v) ? v[0] : v;
  return typeof texto === "string" && texto.trim() ? texto.trim() : null;
}

/** Lee `omitidas` y `textos_sin_codigo` de la respuesta de `/aplicar`. */
export function normalizeCodifAplicarAvisos(raw: unknown): CodifAplicarAvisos {
  const root = codifRegistro(raw);
  return {
    omitidas: codifLista(root.omitidas)
      .map(normalizarOmitida)
      .filter((o): o is CodifOmitida => o !== null),
    textos_sin_codigo: codifLista(root.textos_sin_codigo)
      .map(normalizarTextosSinCodigo)
      .filter((t): t is CodifTextosSinCodigo => t !== null),
    avisos_incompletos: codifLista(root.avisos_incompletos)
      .map(codifTexto)
      .filter((t) => t.length > 0),
  };
}

export async function apiCodifMarcar(parent: string, marcada: boolean) {
  return handle<{ ok: true; parent: string; marcada: boolean }>(
    await apiFetch("/api/codificacion/marcar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, marcada }),
    })
  );
}

export type Arquetipo = "auto" | "solitaria" | "pareja-so" | "pareja-sm" | "huerfana" | "adoptada" | "config-so" | "no-aplica";

export function arquetipoOf(p: PreguntaAbierta, adoptedBy?: Map<string, PreguntaAbierta>): Arquetipo {
  if (p.status === "no-aplica") return "no-aplica";
  if (p.tipo === "integer") return "auto";
  if (p.tipo === "select_multiple") return "pareja-sm";
  if (p.tipo === "select_one") {
    if (p.modo_so === "padre" || p.modo_so === "hijo") return "pareja-so";
    if (p.candidatos_texto && p.candidatos_texto.length > 0) return "pareja-so";
    return "config-so";
  }
  if (p.tipo === "text") {
    // If this text column has been adopted by an SO/SM parent, it's no
    // longer orphan — it's officially a child. Check via reverse lookup.
    const col = p.col_efectiva || p.parent;
    if (adoptedBy && adoptedBy.has(col)) return "adoptada";
    if (/_(otros?|especifique|detail|desc(ripcion)?)$/i.test(p.parent)) return "huerfana";
    return "solitaria";
  }
  return "solitaria";
}

// Infer dummy_col for an SM from its opciones: prefer the option flagged
// es_otros_sugerido. In normalized ODK data this can be a virtual pN/code
// marker backed by the parent column instead of a physical dummy column.
export function guessDummyColFromOpciones(opciones: OpcionSM[] | undefined): string {
  if (!opciones || opciones.length === 0) return "";
  const sugerida = opciones.find((o) => o.es_otros_sugerido && o.col_dummy);
  return sugerida?.col_dummy ?? "";
}

export async function apiCodifPreguntasAbiertas(base?: string) {
  const query = base ? `?base=${encodeURIComponent(base)}` : "";
  return handle<{
    ok: true;
    preguntas: PreguntaAbierta[];
    resumen_decisiones?: CodifResumenDecisiones;
  }>(
    await apiFetch(`/api/codificacion/preguntas-abiertas${query}`, { headers: headers() })
  );
}

// Un texto que no encaja en ningún grupo puede quedar en «Otro» por decisión:
// se registran los textos sueltos actuales de la pregunta; `revertir` la deshace.
export async function apiCodifTextosEnOtro(parent: string, opts?: { revertir?: boolean }) {
  return handle<{ ok: true; parent: string; n_textos: number }>(
    await apiFetch("/api/codificacion/textos-en-otro", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, revertir: opts?.revertir }),
    }),
  );
}

// ADR 0078: «no categorizar» exige motivo. `revertir` la devuelve a pendiente.
export async function apiCodifNoCategorizar(
  parent: string,
  motivo: string,
  opts?: { base?: string; revertir?: boolean },
) {
  return handle<{
    ok: true;
    parent: string;
    no_categorizar: { motivo: string; decidido_en: string } | null;
  }>(
    await apiFetch("/api/codificacion/no-categorizar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, motivo, base: opts?.base, revertir: opts?.revertir }),
    })
  );
}

export async function apiCodifPareja(
  parent: string,
  child_col: string,
  modo_so?: "padre" | "hijo",
  dummy_col?: string,
  opts?: { clear_dummy?: boolean },
) {
  return handle<{ ok: true; parent: string; child_col: string; modo_so: string; dummy_col: string }>(
    await apiFetch("/api/codificacion/pareja", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, child_col, modo_so, dummy_col, clear_dummy: opts?.clear_dummy }),
    })
  );
}

// ---------- Codificación: agrupamiento de respuestas ----------

// Un código que las filas que aportan esta respuesta ya tenían marcado en la
// select_multiple padre. `n` es cuántas de ellas — la lista agrupa por texto
// único, no por fila, así que dos personas con el mismo texto pueden haber
// marcado cosas distintas y el aviso va en proporción contra `frecuencia`.
export type MarcaPrevia = { codigo: string; n: number };

export type RespuestaUnica = {
  texto_normalizado: string;
  texto: string;
  label?: string; // Human label from inst$choices when SO/SM
  variantes: number;
  frecuencia: number;
  uuids: string[];
  /** Sólo en select_multiple; vacío en el resto. */
  ya_marcadas?: MarcaPrevia[];
};

// Reglas de rango para preguntas numéricas. Siempre rangos, nunca valores
// sueltos. Tres formas con lenguaje humano:
//   between — "de X a Y" (ambos inclusive; ambos obligatorios)
//   gte     — "X o más" (mínimo inclusive, sin tope superior)
//   lte     — "X o menos" (máximo inclusive, sin tope inferior)
// Si un valor requerido está ausente, la regla no cubre nada (no hay
// "sin límite implícito": una regla incompleta es una regla no confirmada).
export type ReglaIntegerBetween = { tipo: "between"; min: number | null; max: number | null };
export type ReglaIntegerGte = { tipo: "gte"; value: number | null };
export type ReglaIntegerLte = { tipo: "lte"; value: number | null };
export type ReglaInteger = ReglaIntegerBetween | ReglaIntegerGte | ReglaIntegerLte;

// Backwards compat type alias (not used by new code but kept for legacy grupos)
export type ReglaIntegerRango = ReglaIntegerBetween;

export type Grupo = {
  id: string;
  codigo: string;
  etiqueta: string;
  respuestas: string[]; // texto_normalizado. Para integer con regla, lo
                        // calcula el cliente como preview (cubre X valores)
                        // y el backend usa este campo para status.
  regla?: ReglaInteger; // Solo para integer. Cuando existe, respuestas se
                        // computa desde la regla en el frontend.
  origen?: "existente" | "nuevo"; // "existente" = viene del choice list
                                  // original (read-only código/etiqueta).
                                  // "nuevo" = creado por el analista.
  /** Asignaciones por caso (multicode de un texto abierto): las importa la matriz Excel y las escribe la confirmación
   *  de un módulo sugerido. Con alguna, `/adaptar` codifica el texto por caso y admite varios códigos por persona. */
  matrix_cases?: CasoMatriz[];
};

/** Una persona asignada a un código (`.codif_matrix_case_payload`). `origen: "sugerencia"` marca las que salieron de
 *  confirmar una propuesta de módulo, para poder quitarlas sin tocar las importadas. */
export type CasoMatriz = {
  id_caso: string;
  respuesta: string;
  codigo: string;
  etiqueta: string;
  obs: string;
  origen?: "sugerencia";
  /** Con `origen: "sugerencia"`: el `texto_normalizado` de la respuesta que se confirmó. */
  clave?: string;
};

export type OpcionExistente = { codigo: string; etiqueta: string };

export type RespuestasResponse = {
  ok: true;
  parent: string;
  parent_label?: string;
  col_efectiva: string;
  tipo: string;
  modo_so: string;
  respuestas: RespuestaUnica[];
  grupos: Grupo[];
  opciones_existentes?: OpcionExistente[];
  // Stats del dummy "Otros" para SM: cuántas personas marcaron la opción
  // "Otros, especifique" en total (dummy=1). Permite mostrar un contador
  // "X otros marcados" vs "Y con texto libre" en el codificador.
  sm_otros?: {
    dummy_col: string;
    n_otros_marcados: number;
  } | null;
};

export async function apiCodifRespuestas(parent: string) {
  return handle<RespuestasResponse>(
    await apiFetch(`/api/codificacion/respuestas?parent=${encodeURIComponent(parent)}`, { headers: headers() })
  );
}

export async function apiCodifGrupos(parent: string, grupos: Grupo[]) {
  return handle<{ ok: true; parent: string; n_grupos: number; n_codificadas: number; updated_at: string }>(
    await apiFetch("/api/codificacion/grupos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, grupos }),
    })
  );
}

export async function apiCodifDesemparejar(parent: string) {
  return handle<{ ok: true; parent: string }>(
    await apiFetch(`/api/codificacion/pareja?parent=${encodeURIComponent(parent)}`, {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type CodigosSheetMeta = { name: string; tipo: string; n: number };

export type CodigosColRole = "id" | "ref" | "recod" | "control" | "aux" | "computed" | "pad";

export type CodigosColMeta = { name: string; role: CodigosColRole };

export type CodigosSheetResponse = {
  ok: true;
  name: string;
  tech_row: string[];
  label_row: string[];
  rows: string[][];
  col_meta: CodigosColMeta[];
};

export type CodigoPatch = { row: number; col_index: number; value: string };

export async function apiCodifPlantillaCodigosGenerar() {
  return handle<{ ok: true; file_id: string; size: number; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/plantilla-codigos/generar", { method: "POST", headers: headers() })
  );
}

export async function apiCodifCodigosSheets() {
  return handle<{ ok: true; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/codigos/sheets", { headers: headers() })
  );
}

export async function apiCodifCodigosSheet(name: string) {
  return handle<CodigosSheetResponse>(
    await apiFetch(`/api/codificacion/codigos/sheet?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

export async function apiCodifCodigosPatches(name: string, patches: CodigoPatch[]) {
  return handle<{ ok: true; applied: number; updated_at: string }>(
    await apiFetch("/api/codificacion/codigos/sheet/patches", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, patches }),
    })
  );
}

export async function apiCodifPlantillaFamilias() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-familias", { method: "POST", headers: headers() })
  );
}

export async function apiCodifFamiliasAplicar(file_id: string) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/familias/aplicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export async function apiCodifPlantillaCodigosSubir(file_id: string) {
  return handle<{ ok: true; original_name: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-codigos/subir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

// ---------- Codificación: agrupar categorías (ítem 1f) ----------
//
// Una select_one cuyas categorías se juntan en una variable NUEVA (`target`).
// El backend sugiere `<parent>_recod` si está libre y `<parent>_agrup` si un
// catálogo de «Otro» ya lo reserva. La original no cambia. El backend guarda la
// spec por base y la aplica en «Adaptar». Contrato en
// `api/R/codificacion_agrupar.R` (forma de cable `.codif_agrupar_spec_wire`).

export type AgrupacionRango = { min: number | null; max: number | null };

export type AgrupacionCategoria = {
  codigo: string;
  etiqueta: string;
  codigos: string[];
  rango: AgrupacionRango | null;
  otros_textos: string[];
  otros_numerico: boolean;
  otros_resto: boolean;
  resto: boolean;
};

export type AgrupacionSpec = {
  parent: string;
  target: string;
  text_col: string | null;
  codigo_otro: string | null;
  categorias: AgrupacionCategoria[];
};

export type AgrupacionCodigoOriginal = { codigo: string; etiqueta: string; n: number };
export type AgrupacionTextoOtro = { texto: string; n: number };

export type AgrupacionResponse = {
  base: string;
  parent: string;
  parent_label: string;
  spec: AgrupacionSpec | null;
  target_sugerido: string;
  text_col_sugerida: string | null;
  nombres_ocupados: string[];
  codigos: AgrupacionCodigoOriginal[];
  textos_otro: AgrupacionTextoOtro[];
};

export type AgrupacionVistaPrevia = {
  categorias: AgrupacionCodigoOriginal[];
  n_sin_categoria: number;
};

export type AgrupacionGuardadaResponse = {
  base: string;
  parent: string;
  spec: AgrupacionSpec | null;
  vista_previa: AgrupacionVistaPrevia | null;
};

/** 409 E_CODIF_AGRUPACION_TARGET_OCUPADO: el nombre ya lo reserva otra codificación. */
export class AgrupacionTargetOcupadoError extends ApiError {
  readonly target: string;
  readonly sugerido: string;
  constructor(message: string, target: string, sugerido: string) {
    super("E_CODIF_AGRUPACION_TARGET_OCUPADO", message);
    this.target = target;
    this.sugerido = sugerido;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function aTexto(x: unknown, fallback = ""): string {
  if (typeof x === "string") return x;
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return fallback;
}

function aTextoONulo(x: unknown): string | null {
  const s = aTexto(x).trim();
  return s ? s : null;
}

function aNumeroONulo(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function aEntero(x: unknown): number {
  const n = aNumeroONulo(x);
  return n == null ? 0 : Math.max(0, Math.round(n));
}

// El serializador unboxed manda un vector de largo 1 como escalar y uno vacío
// como `{}` o `[]`. Se normaliza siempre a arreglo de textos no vacíos.
function aListaTextos(x: unknown): string[] {
  const arr = Array.isArray(x) ? x : x == null || isRecord(x) ? [] : [x];
  return arr.map((v) => aTexto(v).trim()).filter((v) => v !== "");
}

function aLista(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  if (isRecord(x) && Object.keys(x).length > 0) return [x];
  return [];
}

function normalizarRango(x: unknown): AgrupacionRango | null {
  if (!isRecord(x)) return null;
  const min = aNumeroONulo(x.min);
  const max = aNumeroONulo(x.max);
  if (min == null && max == null) return null;
  return { min, max };
}

function normalizarCategoria(x: unknown): AgrupacionCategoria | null {
  if (!isRecord(x)) return null;
  const codigo = aTexto(x.codigo).trim();
  if (!codigo) return null;
  return {
    codigo,
    etiqueta: aTexto(x.etiqueta, codigo),
    codigos: aListaTextos(x.codigos),
    rango: normalizarRango(x.rango),
    otros_textos: aListaTextos(x.otros_textos),
    otros_numerico: x.otros_numerico === true,
    otros_resto: x.otros_resto === true,
    resto: x.resto === true,
  };
}

export function normalizeAgrupacionSpec(x: unknown, parent: string): AgrupacionSpec | null {
  if (!isRecord(x) || Object.keys(x).length === 0) return null;
  return {
    parent: aTexto(x.parent, parent) || parent,
    target: aTexto(x.target).trim(),
    text_col: aTextoONulo(x.text_col),
    codigo_otro: aTextoONulo(x.codigo_otro),
    categorias: aLista(x.categorias)
      .map(normalizarCategoria)
      .filter((c): c is AgrupacionCategoria => c !== null),
  };
}

function normalizarCodigos(x: unknown): AgrupacionCodigoOriginal[] {
  return aLista(x).flatMap((v) => {
    if (!isRecord(v)) return [];
    const codigo = aTexto(v.codigo).trim();
    if (!codigo) return [];
    return [{ codigo, etiqueta: aTexto(v.etiqueta, codigo) || codigo, n: aEntero(v.n) }];
  });
}

export function normalizeAgrupacionResponse(x: unknown, parent: string): AgrupacionResponse {
  const r = isRecord(x) ? x : {};
  const p = aTexto(r.parent, parent) || parent;
  return {
    base: aTexto(r.base, "default") || "default",
    parent: p,
    parent_label: aTexto(r.parent_label, p) || p,
    spec: normalizeAgrupacionSpec(r.spec, p),
    target_sugerido: aTexto(r.target_sugerido).trim() || `${p}_agrup`,
    text_col_sugerida: aTextoONulo(r.text_col_sugerida),
    nombres_ocupados: aListaTextos(r.nombres_ocupados),
    codigos: normalizarCodigos(r.codigos),
    textos_otro: aLista(r.textos_otro).flatMap((v) => {
      if (!isRecord(v)) return [];
      const texto = aTexto(v.texto).trim();
      return texto ? [{ texto, n: aEntero(v.n) }] : [];
    }),
  };
}

export function normalizeAgrupacionGuardada(x: unknown, parent: string): AgrupacionGuardadaResponse {
  const r = isRecord(x) ? x : {};
  const p = aTexto(r.parent, parent) || parent;
  const vp = isRecord(r.vista_previa) ? r.vista_previa : null;
  return {
    base: aTexto(r.base, "default") || "default",
    parent: p,
    spec: normalizeAgrupacionSpec(r.spec, p),
    vista_previa: vp
      ? { categorias: normalizarCodigos(vp.categorias), n_sin_categoria: aEntero(vp.n_sin_categoria) }
      : null,
  };
}

export async function apiCodifAgrupacionGet(parent: string, base?: string) {
  const q = new URLSearchParams({ parent });
  if (base) q.set("base", base);
  const raw = await handle<unknown>(
    await apiFetch(`/api/codificacion/agrupacion?${q.toString()}`, { headers: headers() })
  );
  return normalizeAgrupacionResponse(raw, parent);
}

/** Guarda la spec (o la borra con `spec = null`) y devuelve la vista previa. */
export async function apiCodifAgrupacionSet(parent: string, spec: AgrupacionSpec | null, base?: string) {
  const res = await apiFetch("/api/codificacion/agrupacion", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ parent, spec, ...(base ? { base } : {}) }),
  });
  if (res.status === 409) {
    // `handle` no expone `details`; el sugerido se lee aquí antes de delegar.
    const body: unknown = await res.clone().json().catch(() => null);
    const err = isRecord(body) && isRecord(body.error) ? body.error : null;
    if (err && err.code === "E_CODIF_AGRUPACION_TARGET_OCUPADO") {
      const det = isRecord(err.details) ? err.details : {};
      const sugerido = aTexto(det.sugerido).trim()
        || (aTexto(err.message).match(/«([^»]+)»\.?\s*$/)?.[1] ?? "");
      throw new AgrupacionTargetOcupadoError(
        aTexto(err.message, "El nombre de la variable nueva ya está ocupado."),
        aTexto(det.target, spec?.target ?? ""),
        sugerido,
      );
    }
  }
  const raw = await handle<unknown>(res);
  return normalizeAgrupacionGuardada(raw, parent);
}


// ---------- Codificación: módulo sugerido del comentario abierto (TXT-3) ----------
// GET /api/codificacion/sugerencias-seccion. Sólo lectura: propone el o los módulos del formulario de cada comentario
// por las palabras que comparte con ellos; el analista confirma por el flujo de grupos. Nunca trae asignaciones.

export type ModuloSugerible = { codigo: string; seccion: string; etiqueta: string; nTerminos: number };
export type PropuestaModulo = { codigo: string; seccion: string; etiqueta: string; puntaje: number; palabras: string[] };
export type RespuestaConPropuesta = {
  idCaso: string;
  fila: number;
  texto: string;
  noRespuesta: boolean;
  candidatoOtro: boolean;
  propuestas: PropuestaModulo[];
};
export type CodifSugerenciasSeccion = {
  variable: string;
  base: string;
  /** Siempre `true`: es una propuesta. */
  requiereConfirmacion: true;
  modulos: ModuloSugerible[];
  otro: { codigo: string; etiqueta: string };
  respuestas: RespuestaConPropuesta[];
  resumen: { escribieron: number; conContenido: number; conPropuesta: number; candidatosOtro: number; porModulo: Record<string, number> };
};

function codifVerdad(value: unknown): boolean {
  return codifEscalar(value) === true;
}

function codifNumero(value: unknown): number {
  const v = codifEscalar(value);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function normalizeCodifSugerenciasSeccion(raw: unknown): CodifSugerenciasSeccion {
  const r = codifRegistro(raw);
  const modulos: ModuloSugerible[] = [];
  for (const m of codifLista(r.modulos)) {
    const o = codifRegistro(m);
    const codigo = codifTexto(o.codigo);
    if (!codigo || modulos.some((x) => x.codigo === codigo)) continue;
    modulos.push({ codigo, seccion: codifTexto(o.seccion), etiqueta: codifTexto(o.etiqueta) || codigo, nTerminos: codifEntero(o.n_terminos) });
  }
  const conocidos = new Set(modulos.map((m) => m.codigo));
  const respuestas: RespuestaConPropuesta[] = [];
  for (const x of codifLista(r.respuestas)) {
    const o = codifRegistro(x);
    const idCaso = codifTexto(o.id_caso);
    if (!idCaso) continue;
    const noRespuesta = codifVerdad(o.no_respuesta);
    const propuestas: PropuestaModulo[] = noRespuesta ? [] : codifLista(o.propuestas).flatMap((p) => {
      const q = codifRegistro(p);
      const codigo = codifTexto(q.codigo);
      if (!conocidos.has(codigo)) return [];
      return [{
        codigo,
        seccion: codifTexto(q.seccion),
        etiqueta: codifTexto(q.etiqueta) || codigo,
        puntaje: codifNumero(q.puntaje),
        palabras: codifLista(q.palabras).map(codifTexto).filter(Boolean),
      }];
    });
    respuestas.push({
      idCaso,
      fila: codifEntero(o.fila),
      texto: typeof codifEscalar(o.texto) === "string" ? (codifEscalar(o.texto) as string) : codifTexto(o.texto),
      noRespuesta,
      candidatoOtro: !noRespuesta && codifVerdad(o.candidato_otro) && propuestas.length === 0,
      propuestas,
    });
  }
  const otro = codifRegistro(r.otro);
  const resumen = codifRegistro(r.resumen);
  const porModulo: Record<string, number> = {};
  for (const [k, v] of Object.entries(codifRegistro(resumen.por_modulo))) porModulo[k] = codifEntero(v);
  return {
    variable: codifTexto(r.variable),
    base: codifTexto(r.base_name),
    requiereConfirmacion: true,
    modulos,
    otro: { codigo: codifTexto(otro.codigo) || "80", etiqueta: codifTexto(otro.etiqueta) || "Otro" },
    respuestas,
    resumen: {
      escribieron: codifEntero(resumen.escribieron),
      conContenido: codifEntero(resumen.con_contenido),
      conPropuesta: codifEntero(resumen.con_propuesta),
      candidatosOtro: codifEntero(resumen.candidatos_otro),
      porModulo,
    },
  };
}

export async function apiCodifSugerenciasSeccion(variable: string, opts?: { base?: string; secciones?: string[] }) {
  const q = new URLSearchParams({ variable });
  if (opts?.base) q.set("base", opts.base);
  if (opts?.secciones?.length) q.set("secciones", opts.secciones.join(","));
  const raw = await handle<unknown>(await apiFetch(`/api/codificacion/sugerencias-seccion?${q.toString()}`, { headers: headers() }));
  return normalizeCodifSugerenciasSeccion(raw);
}
