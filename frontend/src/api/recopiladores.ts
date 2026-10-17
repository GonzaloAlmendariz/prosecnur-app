// recopiladores.ts — despliegue pre-campo de la recolección (ADR 0046).
//
// Este módulo importa el transporte compartido directamente. No se reexporta
// desde client.ts: Recopiladores es dueño de su contrato y no vuelve a depender
// del barrel histórico de Monitoreo.

import { apiFetch, handle, headers } from "./core";
import type { JobStart } from "./jobs";

export type CollectionAdapterId =
  | "aulas_v1"
  | "manual_links_v1"
  | "kobo_existing_v1"
  | "surveymonkey_weblink_existing_v1"
  | "surveymonkey_recipient_existing_v1";

export type CollectionUnit = {
  unit_id: string;
  label: string;
  role?: string | null;
  group?: string | null;
  dimensions?: Record<string, unknown> | null;
  scheduling?: Record<string, unknown> | null;
};

export type CollectionPlan = {
  schema: "collection_plan/v1";
  plan_id: string;
  adapter: { id: CollectionAdapterId; version: number };
  source_ref: { module: string; run_id: string; fingerprint: string };
  instrument_ref: { revision_id: string; sha256: string; provider?: string | null };
  unit_type: string;
  units: CollectionUnit[];
  revision: number;
  input_fingerprint: string;
};

export type CollectionTarget = {
  provider: string;
  connection_profile_id?: string | null;
  remote_ref?: Record<string, unknown> | null;
  asset_uid?: string | null;
  version_id?: string | null;
  asset_type?: string | null;
  deployment_active?: boolean | null;
  collector_id?: string | null;
  type?: string | null;
  base_access_url?: string | null;
  prefill_field?: string | null;
  return_url?: string | null;
  custom_variable?: string | null;
  custom_variables?: string[] | null;
  recipients?: Array<Record<string, unknown>> | null;
  links?: Array<Record<string, unknown>> | Record<string, unknown> | null;
};

export type CollectionAccessBinding = {
  access_id: string;
  logical_collector_id: string;
  unit_id: string;
  provider_collector_id?: string | null;
  recipient_id?: string | null;
  operator_id?: string | null;
  access_kind: "parameterized_link" | "provider_collector" | "recipient_link" | "manual_handoff";
  access_ref?: string | null;
  prefill?: Record<string, string> | null;
  status: string;
};

export type CollectionCoverage = {
  units_total: number;
  units_with_access: number;
  units_missing_access: number;
};

export type CollectionHandoffReceipt = {
  schema: "collection_handoff/v1";
  deployment_id: string;
  deployment_fingerprint: string;
  plan_fingerprint: string;
  handed_off_at: string;
  state_revision: number;
};

export type CollectionDeployment = {
  schema: "collection_deployment/v1";
  deployment_id: string;
  plan_id: string;
  plan_fingerprint: string;
  deployment_fingerprint?: string | null;
  adapter_id?: CollectionAdapterId | null;
  target: CollectionTarget;
  capabilities: Record<string, CollectionCapability> & {
    remote_write?: CollectionCapability | { observed: false; source: "disabled_v1" };
  };
  bindings: CollectionAccessBinding[];
  coverage: CollectionCoverage;
  sensitivity: { access_urls: string };
  status: "draft" | "prepared" | "handed_off" | "stale";
  stale?: { reasons?: string[] | null } | null;
  handoff?: CollectionHandoffReceipt | null;
  artifacts?: CollectionArtifactReceipt[] | null;
};

export type CollectionState = {
  schema: "collection_state/v1";
  state_revision: number;
  plan: CollectionPlan | null;
  deployment: CollectionDeployment | null;
  migration?: Record<string, unknown> | null;
  material_template?: CollectionMaterialTemplate | null;
  material_instances?: CollectionMaterialInstance[] | null;
  artifact_receipts?: CollectionArtifactReceipt[] | null;
};

/** Lo que rehacer el plan descarta del estado vigente (`.collection_reseed_descartado`). */
export type CollectionReseedDescartado = {
  plan_run_id: string;
  unidades: number;
  tenia_despliegue: boolean;
  entregado: boolean;
  fichas: { instancias: number; unidades_cubiertas: number };
  recibos: number;
  publicaciones_drive: number;
  /** Campos presentes que el backend no clasifica: se pierden igual. */
  otros_campos: string[];
  /** Claves del estado que sobreviven (`material_template`, `pruebas`…). */
  conservado: string[];
};

export type CollectionReseedPropuesto = {
  plan_run_id: string;
  unidades: number;
  /**
   * Cuántas unidades entran, salen, cambian algún dato o cambian de rol: el
   * mismo conteo que `GET /origen`. `null` en un backend que no lo emite.
   */
  diferencias?: CollectionOrigenConteo | null;
};

export type CollectionStatePayload = CollectionState & {
  ok: true;
  noop?: boolean;
  seeded?: boolean;
  seed_available: boolean;
  /**
   * El plan congelado contra el sorteo vigente.
   *
   * El plan se siembra una vez y re-sortear no lo regenera: un proyecto puede
   * tener materiales de una corrida y una selección de otra. Ausente cuando no
   * hay con qué comparar; el backend nunca inventa un veredicto.
   */
  source_vigente?: {
    plan_run_id: string;
    selection_run_id: string;
    desfasado: boolean;
  } | null;
  /**
   * Rehacer el plan: `reseeded` sólo tras la escritura; `dry_run` en la
   * previsualización, que no muta nada y trae el MISMO `descartado`.
   */
  reseeded?: boolean;
  dry_run?: boolean;
  descartado?: CollectionReseedDescartado | null;
  /** Cómo quedaría el plan nuevo (previsualización y escritura). */
  propuesto?: CollectionReseedPropuesto | null;
  state: CollectionState;
  handoff?: CollectionHandoffReceipt | null;
  /**
   * Rutas del deployment que el backend DEDUJO al leer y no están guardadas
   * («adapter_id», «target.deployment_active»). `[]` si nada se dedujo.
   */
  deployment_derived_fields?: string[];
};

export type CapabilitySupport = "supported" | "unsupported" | "unknown";
export type CapabilityImplementation = "available" | "partial" | "planned" | "unavailable";
export type CapabilityPolicy = "allowed_v1" | "allowed_explicit" | "disabled_v1" | "future";
export type CapabilityEvidence = "observed" | "declared" | "current_code" | "unknown";

export type CollectionCapability = {
  provider_support?: CapabilitySupport;
  implementation?: CapabilityImplementation;
  policy?: CapabilityPolicy;
  evidence?: CapabilityEvidence;
  observed?: boolean;
  source?: string;
};

export type CollectionIssue = {
  code: string;
  operation?: string | null;
  field?: string | null;
  observed?: unknown;
};

export type CollectionCapabilityPreflight = {
  schema: "collection_capability_preflight/v1";
  adapter_id: CollectionAdapterId;
  operation_policy: string;
  capabilities: Record<string, CollectionCapability>;
  blocking: CollectionIssue[];
  warnings: CollectionIssue[];
};

export type CollectionDeploymentPreview = {
  ok?: boolean;
  adapter_id?: CollectionAdapterId;
  mode?: string;
  preflight?: CollectionCapabilityPreflight | null;
  blocking?: CollectionIssue[] | null;
  warnings?: CollectionIssue[] | null;
  deployment?: CollectionDeployment | null;
  preview?: CollectionDeployment | { deployment?: CollectionDeployment | null } | null;
};

// Espejo de `COLLECTION_MATERIAL_BLOCK_TYPES` (api/R/collection_materials.R),
// en el mismo orden. Se quedó en 9 cuando el backend ya aceptaba 13, y los
// bloques de los presets nuevos —la careta `brand_strip` del afiche y de la
// ficha de campo— salían sin rótulo en el editor y el inspector los rotulaba
// «brand_header» (el <select> caía a su primera opción).
export const COLLECTION_BLOCK_TYPES = [
  "brand_header",
  "brand_strip",
  "status_tag",
  "heading",
  "body",
  "access_qr",
  "field_grid",
  "form_lines",
  "instructions",
  "application_log",
  "divider",
  "footer",
  "campus_map",
] as const;
export type CollectionBlockType = (typeof COLLECTION_BLOCK_TYPES)[number];

export type CollectionMaterialField = string | {
  binding: string;
  label?: string | null;
  [key: string]: unknown;
};

export type CollectionMaterialBlock = {
  block_id: string;
  type: CollectionBlockType;
  binding?: string | null;
  required?: boolean | null;
  text?: string | null;
  fields?: CollectionMaterialField[] | null;
  [key: string]: unknown;
};

export type CollectionMaterialTemplate = {
  schema: "collection_material_template/v1";
  template_id: string;
  revision: number;
  preset_id: string;
  material_kind: string;
  compatible_adapters: CollectionAdapterId[];
  page: { size: string; orientation: string };
  pages: Array<{ page_id: string; layout_preset: string; blocks: CollectionMaterialBlock[] }>;
  brand_ref: string;
  sensitivity_policy: string;
  template_sha256?: string | null;
};

export type CollectionMaterialInstance = {
  schema: "collection_material_instance/v1";
  instance_id: string;
  template_ref: { template_id: string; revision: number; sha256: string };
  deployment_id: string;
  deployment_fingerprint: string;
  unit_refs: string[];
  access_refs: string[];
  locale: string;
  status: string;
  sensitivity: string;
  warnings: CollectionIssue[];
};

export type CollectionArtifactReceipt = {
  schema: "collection_artifact_receipt/v1";
  receipt_id: string;
  artifact_id: string;
  instance_id?: string | null;
  deployment_id: string;
  plan_fingerprint: string;
  deployment_fingerprint: string;
  template_ref?: { template_id: string; revision: number; sha256: string } | null;
  layout_fingerprint?: string | null;
  file_id: string;
  media_type: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  page_count: number;
  page_map?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  audience?: string | null;
  sensitivity?: string | null;
  /**
   * Si el archivo sigue en la sesión. Lo deriva el backend y no se persiste:
   * el `.pulso` guarda el recibo pero no el entregable, así que al reabrir el
   * proyecto el recibo queda como evidencia y su descarga daría 404. Ausente
   * en payloads viejos: se trata como disponible.
   */
  file_available?: boolean | null;
};

export type CollectionMaterialTemplatePayload = {
  ok?: boolean;
  template: CollectionMaterialTemplate | null;
  state_revision?: number | null;
};

export type CollectionMaterialInstancesPayload = {
  ok?: boolean;
  instances: CollectionMaterialInstance[];
  instance?: CollectionMaterialInstance | null;
  state_revision?: number | null;
  stale?: boolean;
};

export type CollectionMaterialRenderResult = {
  ok?: boolean;
  file_id: string;
  media_type: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  page_count: number;
  page_map?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  manifest?: CollectionArtifactReceipt | CollectionArtifactReceipt[] | null;
  receipt?: CollectionArtifactReceipt | null;
};

type UnknownRecord = Record<string, unknown>;

/** Conserva `file_available` sólo como booleano; cualquier otra cosa es «no dicho». */
function normalizeArtifactReceipt(receipt: CollectionArtifactReceipt): CollectionArtifactReceipt {
  const raw: unknown = (receipt as { file_available?: unknown }).file_available;
  return { ...receipt, file_available: typeof raw === "boolean" ? raw : null };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null || (isRecord(value) && !Object.keys(value).length)) return [];
  return [value as T];
}

/**
 * Un recibo de traspaso sólo existe si trae su contrato completo.
 *
 * El backend arma el despliegue con `handoff = NULL` y jsonlite serializa ese
 * NULL como `{}`: un objeto vacío que `isRecord` acepta. Tomarlo como recibo
 * pintaba «Recibo firmado» con Fecha, Revisión, Plan y Accesos en «—» sin que
 * hubiera habido traspaso a Monitoreo (H25). Sin schema o sin sus campos
 * obligatorios, no hay recibo.
 */
export function normalizeHandoffReceipt(value: unknown): CollectionHandoffReceipt | null {
  if (!isRecord(value) || value.schema !== "collection_handoff/v1") return null;
  const texto = (key: string) => (typeof value[key] === "string" ? (value[key] as string).trim() : "");
  const revision = Number(value.state_revision);
  const receipt: CollectionHandoffReceipt = {
    schema: "collection_handoff/v1",
    deployment_id: texto("deployment_id"),
    deployment_fingerprint: texto("deployment_fingerprint"),
    plan_fingerprint: texto("plan_fingerprint"),
    handed_off_at: texto("handed_off_at"),
    state_revision: revision,
  };
  if (
    !receipt.deployment_id
    || !receipt.deployment_fingerprint
    || !receipt.plan_fingerprint
    || !receipt.handed_off_at
    || !Number.isInteger(revision)
    || revision < 0
  ) return null;
  return receipt;
}

function contractError(detail: string): Error {
  return new Error(`El backend devolvió un contrato inválido de Recopiladores: ${detail}`);
}

// R serializa un escalar como `[x]` cuando no se le pide `auto_unbox`; la
// lectura acepta las dos formas y nada más.
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

/** Un conteo: entero no negativo o 0. Nunca `NaN` en pantalla. */
function conteo(value: unknown): number {
  const n = Number(escalar(value));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function textoPlano(value: unknown): string {
  const v = escalar(value);
  return typeof v === "string" ? v.trim() : "";
}

function listaDeTextos(value: unknown): string[] {
  const lista = typeof value === "string" ? [value] : asArray<unknown>(value);
  return [...new Set(lista.map(textoPlano).filter(Boolean))];
}

/**
 * `descartado` del reseed, campo por campo. Un booleano que no sea `true` no
 * cuenta: «tenía despliegue» o «entregado» no se afirman sin saberlo.
 */
export function normalizeReseedDescartado(value: unknown): CollectionReseedDescartado | null {
  if (!isRecord(value)) return null;
  const fichas = isRecord(value.fichas) ? value.fichas : {};
  return {
    plan_run_id: textoPlano(value.plan_run_id),
    unidades: conteo(value.unidades),
    tenia_despliegue: escalar(value.tenia_despliegue) === true,
    entregado: escalar(value.entregado) === true,
    fichas: {
      instancias: conteo(fichas.instancias),
      unidades_cubiertas: conteo(fichas.unidades_cubiertas),
    },
    recibos: conteo(value.recibos),
    publicaciones_drive: conteo(value.publicaciones_drive),
    otros_campos: listaDeTextos(value.otros_campos),
    conservado: listaDeTextos(value.conservado),
  };
}

function normalizeOrigenConteo(value: unknown): CollectionOrigenConteo | null {
  if (!isRecord(value)) return null;
  return {
    altas: conteo(value.altas),
    bajas: conteo(value.bajas),
    campos: conteo(value.campos),
    roles: conteo(value.roles),
    ...(escalar(value.unidades_con_cambios) == null ? {} : { unidades_con_cambios: conteo(value.unidades_con_cambios) }),
  };
}

export function normalizeReseedPropuesto(value: unknown): CollectionReseedPropuesto | null {
  if (!isRecord(value)) return null;
  const diferencias = normalizeOrigenConteo(value.diferencias);
  return {
    plan_run_id: textoPlano(value.plan_run_id),
    unidades: conteo(value.unidades),
    // Sólo si el backend lo emite: un backend previo no inventa «entran 0».
    ...(diferencias ? { diferencias } : {}),
  };
}

export function normalizeCollectionStatePayload(value: unknown): CollectionStatePayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  const rawState = isRecord(value.state) ? value.state : value;
  if (rawState.schema !== "collection_state/v1") throw contractError("schema de estado desconocido.");
  const revision = Number(rawState.state_revision);
  if (!Number.isInteger(revision) || revision < 0) throw contractError("state_revision no es un entero válido.");

  const plan = rawState.plan == null || (isRecord(rawState.plan) && !Object.keys(rawState.plan).length)
    ? null
    : rawState.plan;
  if (plan !== null && (!isRecord(plan) || plan.schema !== "collection_plan/v1" || !Array.isArray(plan.units))) {
    throw contractError("plan no cumple collection_plan/v1.");
  }

  const deployment = rawState.deployment == null
    || (isRecord(rawState.deployment) && !Object.keys(rawState.deployment).length)
    ? null
    : rawState.deployment;
  if (
    deployment !== null
    && (!isRecord(deployment) || deployment.schema !== "collection_deployment/v1" || !Array.isArray(deployment.bindings))
  ) {
    throw contractError("deployment no cumple collection_deployment/v1.");
  }

  // El `handoff` del despliegue pasa por el mismo filtro: `{}` no es recibo.
  const normalizedDeployment: CollectionDeployment | null = deployment === null
    ? null
    : { ...(deployment as CollectionDeployment), handoff: normalizeHandoffReceipt((deployment as { handoff?: unknown }).handoff) };

  const state: CollectionState = {
    schema: "collection_state/v1",
    state_revision: revision,
    plan: plan as CollectionPlan | null,
    deployment: normalizedDeployment,
    migration: isRecord(rawState.migration) ? rawState.migration : null,
    material_template: isRecord(rawState.material_template)
      ? rawState.material_template as CollectionMaterialTemplate
      : null,
    material_instances: asArray<CollectionMaterialInstance>(rawState.material_instances),
    artifact_receipts: asArray<CollectionArtifactReceipt>(rawState.artifact_receipts).map(normalizeArtifactReceipt),
  };
  // El normalizador reconstruye el payload campo por campo, así que TODO campo
  // nuevo del backend hay que añadirlo aquí o se pierde en silencio. Costó un
  // diagnóstico entero el 2026-08-22: `source_vigente` llegaba correcto en el
  // JSON —comprobado con curl contra la API— y no aparecía en pantalla, con el
  // backend, el endpoint y el componente los tres bien.
  const vigente = isRecord(value.source_vigente) ? value.source_vigente : null;
  return {
    ok: true,
    noop: value.noop === true,
    seeded: value.seeded === true,
    seed_available: value.seed_available === true,
    source_vigente: vigente === null ? null : {
      plan_run_id: String(vigente.plan_run_id ?? ""),
      selection_run_id: String(vigente.selection_run_id ?? ""),
      desfasado: vigente.desfasado === true,
    },
    reseeded: value.reseeded === true,
    dry_run: value.dry_run === true,
    descartado: normalizeReseedDescartado(value.descartado),
    propuesto: normalizeReseedPropuesto(value.propuesto),
    deployment_derived_fields: asArray<unknown>(value.deployment_derived_fields)
      .filter((campo): campo is string => typeof campo === "string" && campo.length > 0),
    ...state,
    state,
    handoff: normalizeHandoffReceipt(value.handoff) ?? state.deployment?.handoff ?? null,
  };
}

function json(method: "POST" | "PUT", body?: unknown): RequestInit {
  return {
    method,
    headers: headers({ "Content-Type": "application/json" }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function stateRequest(path: string, init?: RequestInit): Promise<CollectionStatePayload> {
  return normalizeCollectionStatePayload(await handle<unknown>(await apiFetch(path, init)));
}

export function apiRecopiladoresState() {
  return stateRequest("/api/recopiladores/state", { headers: headers() });
}

export function apiRecopiladoresSeed() {
  return stateRequest("/api/recopiladores/seed", json("POST"));
}

/**
 * Rehace el plan desde el sorteo vigente.
 *
 * `apiRecopiladoresSeed` no sirve para esto: siembra una vez y no hace nada si el
 * plan ya existe. Rehacer descarta el despliegue y su handoff, así que la
 * respuesta trae `descartado` con lo que se pierde.
 */
export function apiRecopiladoresReseed(expected_revision: number, expected_source_fingerprint?: string | null) {
  return stateRequest("/api/recopiladores/reseed", json("POST", {
    expected_revision,
    dry_run: false,
    ...(expected_source_fingerprint ? { expected_source_fingerprint } : {}),
  }));
}

/**
 * Previsualiza el reseed: mismo `descartado` y `propuesto`, sin tocar estado,
 * revisión ni `project_dirty`. Es lo que se lee ANTES de confirmar.
 */
export function apiRecopiladoresReseedPreview(expected_revision: number, expected_source_fingerprint?: string | null) {
  return stateRequest("/api/recopiladores/reseed", json("POST", {
    expected_revision,
    dry_run: true,
    ...(expected_source_fingerprint ? { expected_source_fingerprint } : {}),
  }));
}

export function apiRecopiladoresPlanPut(expected_revision: number, plan: CollectionPlan) {
  return stateRequest("/api/recopiladores/plan", json("PUT", { expected_revision, plan }));
}

export function apiRecopiladoresDeploymentPut(expected_revision: number, deployment: CollectionDeployment) {
  return stateRequest("/api/recopiladores/deployment", json("PUT", { expected_revision, deployment }));
}

export function apiRecopiladoresDeploymentPrepare(expected_revision: number, deployment?: CollectionDeployment) {
  return stateRequest(
    "/api/recopiladores/deployment/prepare",
    json("POST", { expected_revision, ...(deployment ? { deployment } : {}) }),
  );
}

export function apiRecopiladoresReconcile(expected_revision: number, observed: Record<string, unknown>) {
  return stateRequest("/api/recopiladores/reconcile", json("POST", { expected_revision, observed }));
}

export function apiRecopiladoresHandoff(expected_revision: number, deployment_fingerprint: string) {
  return stateRequest(
    "/api/recopiladores/handoff",
    json("POST", { expected_revision, deployment_fingerprint }),
  );
}

export async function apiRecopiladoresProviderPreflight(input: {
  adapter_id: CollectionAdapterId;
  operation: string;
  connection_ref: Record<string, unknown>;
  target_ref: CollectionTarget;
}) {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/provider-preflight",
    json("POST", input),
  ));
  if (!isRecord(raw)) {
    throw contractError("preflight no es un objeto.");
  }
  const candidate = isRecord(raw.capability_preflight) ? raw.capability_preflight : raw;
  if (candidate.schema !== "collection_capability_preflight/v1") {
    throw contractError("preflight no cumple collection_capability_preflight/v1.");
  }
  return {
    ...candidate,
    blocking: asArray<CollectionIssue>(candidate.blocking),
    warnings: asArray<CollectionIssue>(candidate.warnings),
  } as CollectionCapabilityPreflight;
}

export async function apiRecopiladoresDeploymentPreview(input: {
  adapter_id: CollectionAdapterId;
  plan?: CollectionPlan | null;
  target: CollectionTarget;
}) {
  return handle<CollectionDeploymentPreview>(await apiFetch(
    "/api/recopiladores/deployment/preview",
    json("POST", input),
  ));
}

export async function apiRecopiladoresMaterialTemplateGet() {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/material-template",
    { headers: headers() },
  ));
  if (!isRecord(raw)) throw contractError("material-template no es un objeto.");
  const candidate = isRecord(raw.template) && Object.keys(raw.template).length
    ? raw.template
    : raw.schema === "collection_material_template/v1" ? raw : null;
  if (candidate && candidate.schema !== "collection_material_template/v1") {
    throw contractError("template no cumple collection_material_template/v1.");
  }
  return {
    ok: raw.ok === true,
    template: candidate as CollectionMaterialTemplate | null,
    state_revision: Number.isInteger(Number(raw.state_revision)) ? Number(raw.state_revision) : null,
  } satisfies CollectionMaterialTemplatePayload;
}

export async function apiRecopiladoresMaterialTemplatePut(input: {
  expected_revision: number;
  template: CollectionMaterialTemplate;
}) {
  return handle<CollectionMaterialTemplatePayload>(await apiFetch(
    "/api/recopiladores/material-template",
    json("PUT", input),
  ));
}

export async function apiRecopiladoresMaterialInstances(input: {
  expected_revision: number;
  unit_refs?: string[];
  access_refs?: string[];
  locale?: string;
}) {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/materials/instances",
    json("POST", input),
  ));
  if (!isRecord(raw)) throw contractError("materials/instances no es un objeto.");
  const instance = isRecord(raw.instance) && Object.keys(raw.instance).length
    ? raw.instance as CollectionMaterialInstance
    : null;
  return {
    ...raw,
    instance,
    instances: instance ? [instance] : asArray<CollectionMaterialInstance>(raw.instances),
  } as CollectionMaterialInstancesPayload;
}

export type CollectionDrivePublicacion = {
  driveFileId: string;
  webViewLink: string;
  folderId: string;
  folderName: string;
  filename: string;
  receiptId: string;
};

/**
 * B6(b): la respuesta de `materials/drive`, normalizada en la frontera. El
 * enlace es lo que el equipo abre: sin él (o con un esquema que no sea el de
 * Drive) es error de contrato, no un href hueco en la pantalla.
 */
export function normalizarDrivePublicacion(raw: unknown): CollectionDrivePublicacion {
  if (!isRecord(raw)) throw contractError("materials/drive no es un objeto.");
  const driveFileId = typeof raw.drive_file_id === "string" ? raw.drive_file_id : "";
  const webViewLink = typeof raw.web_view_link === "string" ? raw.web_view_link : "";
  if (!driveFileId) throw contractError("materials/drive no trae drive_file_id.");
  if (!/^https:\/\/drive\.google\.com\//.test(webViewLink)) {
    throw contractError("materials/drive no trae un enlace de Drive utilizable.");
  }
  return {
    driveFileId,
    webViewLink,
    folderId: typeof raw.folder_id === "string" ? raw.folder_id : "",
    folderName: typeof raw.folder_name === "string" ? raw.folder_name : "",
    filename: typeof raw.filename === "string" ? raw.filename : "",
    receiptId: typeof raw.receipt_id === "string" ? raw.receipt_id : "",
  };
}

/**
 * Sube al Drive del operativo un artefacto YA renderizado (por el file_id de
 * su recibo). Escritura de estado: la carpeta destino queda recordada y la
 * publicación anotada, así que viaja `expected_revision` como toda escritura.
 */
export async function apiRecopiladoresMaterialDrive(input: {
  file_id: string;
  expected_revision: number;
}) {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/materials/drive",
    json("POST", input),
  ));
  return normalizarDrivePublicacion(raw);
}

/**
 * Ficha suelta con un identificador inventado —`PRUEBA_2026`, `CAPACITACION`,
 * `prueba_interna`— y el MISMO enlace del operativo.
 *
 * No pasa por `materials/instances`: no persiste nada. Una ficha de prueba
 * dentro del plan movería el conteo de unidades y el handoff a Monitoreo.
 */
export async function apiRecopiladoresMaterialPrueba(input: {
  codigo: string;
  etiqueta?: string;
}) {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/materials/prueba",
    json("POST", input),
  ));
  if (!isRecord(raw) || typeof raw.job_id !== "string" || !raw.job_id) {
    throw contractError("materials/prueba no devolvió job_id.");
  }
  return raw as JobStart;
}

export type CollectionFichaPrueba = {
  codigo: string;
  etiqueta: string;
  enlace: string;
  creada_en: string;
  deployment_fingerprint?: string;
  /** El enlace sigue siendo el del despliegue actual. Lo calcula el backend al
      leer, no se guarda: es una relación con el despliegue de HOY. */
  vigente: boolean;
};

/**
 * Las fichas de prueba ya generadas, con su enlace tal como se generó.
 *
 * Viven en `collection_state$pruebas`, hermanas de `plan`. Del PDF se guarda el
 * enlace y no el archivo: regenerarlo es determinista.
 */
export async function apiRecopiladoresMaterialPruebas() {
  // Sin `headers()` la petición viaja SIN `X-Pulso-Session`. El backend
  // responde `E_NO_SESSION`, y el manejador de errores de `core.ts` reacciona a
  // ese código borrando el sid y emitiendo `pulso:session-lost`: la sesión se
  // rehace en blanco y el proyecto abierto se cierra solo. Como esta llamada la
  // dispara el `useEffect` de montaje de Materiales, entrar a esa sección
  // expulsaba del proyecto una y otra vez.
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/materials/pruebas",
    { headers: headers() },
  ));
  if (!isRecord(raw)) throw contractError("materials/pruebas no es un objeto.");
  return asArray<CollectionFichaPrueba>(raw.pruebas).filter((x) => Boolean(x?.codigo));
}

export async function apiRecopiladoresMaterialsRender(input: {
  format: "png" | "pdf" | "bundle";
  instance_id: string;
  page?: number;
  resolved_access?: Record<string, string>;
  audience?: "field_team" | "client" | "internal";
}) {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/materials/render",
    json("POST", input),
  ));
  if (!isRecord(raw) || typeof raw.job_id !== "string" || !raw.job_id) {
    throw contractError("materials/render no devolvió job_id.");
  }
  return raw as JobStart;
}

// ---------------------------------------------------------------------------
// Origen de las unidades (E1e): de qué fuente sale el plan y qué cambió en ella
// ---------------------------------------------------------------------------
//
// `GET /api/recopiladores/origen` es puro: compara el plan guardado con lo que
// la fuente daría HOY, sin escribir estado ni marcar el proyecto. `nivel=resumen`
// no construye unidades y sirve para avisos baratos (Cálculo de muestra);
// `nivel=diferencias` trae las listas, con tope `limite`.

export type CollectionOrigenEstado = "al_dia" | "cambio" | "sin_plan" | "sin_fuente";

export type CollectionOrigenConteo = {
  altas: number;
  bajas: number;
  /** Datos que cambiaron (filas), no unidades. */
  campos: number;
  roles: number;
  /** Unidades con algún dato cambiado; ausente en un backend que no lo emite. */
  unidades_con_cambios?: number;
};

/** Una unidad que entra o sale de la lista. */
export type CollectionOrigenUnidad = {
  clave: string;
  unit_id: string;
  codigo: string;
  rol: string;
  facultad: string;
  curso: string;
};

/**
 * Un dato que cambió en una unidad que sigue en la lista. Un campo sensible
 * (el docente) llega con `antes`/`despues` en `null`: se dice que cambió, no a qué.
 */
export type CollectionOrigenCambio = {
  clave: string;
  unit_id: string;
  codigo: string;
  campo: string;
  antes: string | null;
  despues: string | null;
  sensible: boolean;
};

export type CollectionOrigenResumen = CollectionOrigenConteo & {
  unidades_con_cambios: number;
  sin_cambio: number;
  claves_repetidas: number;
  afectadas: { unidades: number; fichas: number; unidades_con_ficha: number; accesos: number };
  entregado: boolean;
};

export type CollectionOrigen = {
  ok: true;
  schema: "collection_origen/v1";
  nivel: "diferencias" | "resumen";
  state_revision: number;
  adapter: string;
  /** `fecha` = «AAAA-MM-DD» del sello del sorteo; "" en corridas sin fecha (QA). */
  fuente: { modulo: string; origen: string; disponible: boolean; run_id: string; fecha: string; unidades: number | null };
  plan: { existe: boolean; run_id: string; fecha: string; unidades: number; huella_registrada: string };
  fingerprint_actual: string | null;
  fingerprint_plan: string | null;
  sorteo_vigente: { run_id: string; fecha: string; desfasado: boolean } | null;
  /** La fuente que manda (Monitoreo) quedó atrás de la selección de Cálculo. */
  fuente_intermedia_desfasada: boolean;
  estado: CollectionOrigenEstado;
  stale: boolean;
  /** Cambió la corrida pero no las unidades. */
  solo_corrida: boolean;
  resumen: CollectionOrigenResumen;
  /** `null` en `nivel=resumen`. */
  cambios: {
    altas: CollectionOrigenUnidad[];
    bajas: CollectionOrigenUnidad[];
    campos: CollectionOrigenCambio[];
    roles: CollectionOrigenCambio[];
  } | null;
  truncado: { altas: boolean; bajas: boolean; campos: boolean; roles: boolean };
  limite: number;
};

const ESTADOS_ORIGEN: readonly CollectionOrigenEstado[] = ["al_dia", "cambio", "sin_plan", "sin_fuente"];

function verdadero(value: unknown): boolean {
  return escalar(value) === true;
}

/** Texto, número como texto, o `null` si el backend no dio valor. */
function textoOpcional(value: unknown): string | null {
  const v = escalar(value);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "sí" : "no";
  return null;
}

function huellaOpcional(value: unknown): string | null {
  const v = textoPlano(value);
  return v ? v : null;
}

function normalizeOrigenUnidad(value: unknown): CollectionOrigenUnidad | null {
  if (!isRecord(value)) return null;
  const clave = textoPlano(value.clave);
  if (!clave) return null;
  return {
    clave,
    unit_id: textoPlano(value.unit_id),
    codigo: textoPlano(value.codigo),
    rol: textoPlano(value.rol),
    facultad: textoPlano(value.facultad),
    curso: textoPlano(value.curso),
  };
}

function normalizeOrigenCambio(value: unknown): CollectionOrigenCambio | null {
  if (!isRecord(value)) return null;
  const clave = textoPlano(value.clave);
  const campo = textoPlano(value.campo);
  if (!clave || !campo) return null;
  const sensible = verdadero(value.sensible);
  return {
    clave,
    unit_id: textoPlano(value.unit_id),
    codigo: textoPlano(value.codigo),
    campo,
    // Lo sensible no se pinta aunque el backend lo mandara por error.
    antes: sensible ? null : textoOpcional(value.antes),
    despues: sensible ? null : textoOpcional(value.despues),
    sensible,
  };
}

function listaDe<T>(value: unknown, normalizar: (item: unknown) => T | null): T[] {
  return asArray<unknown>(value).map(normalizar).filter((item): item is T => item !== null);
}

export function normalizeCollectionOrigen(value: unknown): CollectionOrigen {
  if (!isRecord(value)) throw contractError("origen no es un objeto.");
  if (escalar(value.schema) !== "collection_origen/v1") throw contractError("schema de origen desconocido.");
  const fuente = isRecord(value.fuente) ? value.fuente : {};
  const plan = isRecord(value.plan) ? value.plan : {};
  const sorteo = isRecord(value.sorteo_vigente) ? value.sorteo_vigente : null;
  const resumen = isRecord(value.resumen) ? value.resumen : {};
  const afectadas = isRecord(resumen.afectadas) ? resumen.afectadas : {};
  const cambios = isRecord(value.cambios) ? value.cambios : null;
  const truncado = isRecord(value.truncado) ? value.truncado : {};
  const unidadesFuente = Number(escalar(fuente.unidades));

  const planExiste = verdadero(plan.existe);
  const fuenteDisponible = verdadero(fuente.disponible);
  const stale = verdadero(value.stale);
  const estadoCrudo = textoPlano(value.estado) as CollectionOrigenEstado;
  // Un estado que este front no conoce se deduce de lo que sí sabe; nunca se
  // afirma «al día» sin plan ni fuente.
  const estado: CollectionOrigenEstado = ESTADOS_ORIGEN.includes(estadoCrudo)
    ? estadoCrudo
    : !planExiste ? "sin_plan" : !fuenteDisponible ? "sin_fuente" : stale ? "cambio" : "al_dia";

  return {
    ok: true,
    schema: "collection_origen/v1",
    nivel: textoPlano(value.nivel) === "resumen" ? "resumen" : "diferencias",
    state_revision: conteo(value.state_revision),
    adapter: textoPlano(value.adapter),
    fuente: {
      modulo: textoPlano(fuente.modulo),
      origen: textoPlano(fuente.origen),
      disponible: fuenteDisponible,
      run_id: textoPlano(fuente.run_id),
      fecha: textoPlano(fuente.fecha),
      unidades: Number.isFinite(unidadesFuente) && unidadesFuente >= 0 && escalar(fuente.unidades) !== null
        ? Math.floor(unidadesFuente) : null,
    },
    plan: {
      existe: planExiste,
      run_id: textoPlano(plan.run_id),
      fecha: textoPlano(plan.fecha),
      unidades: conteo(plan.unidades),
      huella_registrada: textoPlano(plan.huella_registrada),
    },
    fingerprint_actual: huellaOpcional(value.fingerprint_actual),
    fingerprint_plan: huellaOpcional(value.fingerprint_plan),
    sorteo_vigente: sorteo === null ? null : {
      run_id: textoPlano(sorteo.run_id),
      fecha: textoPlano(sorteo.fecha),
      desfasado: verdadero(sorteo.desfasado),
    },
    fuente_intermedia_desfasada: verdadero(value.fuente_intermedia_desfasada),
    estado,
    stale,
    solo_corrida: verdadero(value.solo_corrida),
    resumen: {
      altas: conteo(resumen.altas),
      bajas: conteo(resumen.bajas),
      campos: conteo(resumen.campos),
      roles: conteo(resumen.roles),
      unidades_con_cambios: conteo(resumen.unidades_con_cambios),
      sin_cambio: conteo(resumen.sin_cambio),
      claves_repetidas: conteo(resumen.claves_repetidas),
      afectadas: {
        unidades: conteo(afectadas.unidades),
        fichas: conteo(afectadas.fichas),
        unidades_con_ficha: conteo(afectadas.unidades_con_ficha),
        accesos: conteo(afectadas.accesos),
      },
      entregado: verdadero(resumen.entregado),
    },
    cambios: cambios === null ? null : {
      altas: listaDe(cambios.altas, normalizeOrigenUnidad),
      bajas: listaDe(cambios.bajas, normalizeOrigenUnidad),
      campos: listaDe(cambios.campos, normalizeOrigenCambio),
      roles: listaDe(cambios.roles, normalizeOrigenCambio),
    },
    truncado: {
      altas: verdadero(truncado.altas),
      bajas: verdadero(truncado.bajas),
      campos: verdadero(truncado.campos),
      roles: verdadero(truncado.roles),
    },
    limite: conteo(value.limite),
  };
}

/**
 * Lee el origen de las unidades. `resumen` es barato (no arma unidades) y es el
 * único nivel que deben usar otros módulos; `diferencias` es el de la pestaña.
 */
export async function apiRecopiladoresOrigen(
  nivel: "diferencias" | "resumen" = "diferencias",
  limite = 200,
): Promise<CollectionOrigen> {
  const query = new URLSearchParams({ nivel, limite: String(limite) });
  const raw = await handle<unknown>(await apiFetch(`/api/recopiladores/origen?${query.toString()}`, {
    headers: headers(),
  }));
  return normalizeCollectionOrigen(raw);
}
