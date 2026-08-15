// codificacion.ts — codificación (familias, plantilla, agrupamiento).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";

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
};

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
