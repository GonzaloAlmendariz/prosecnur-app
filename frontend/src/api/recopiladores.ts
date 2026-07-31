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

export type CollectionStatePayload = CollectionState & {
  ok: true;
  noop?: boolean;
  seeded?: boolean;
  seed_available: boolean;
  state: CollectionState;
  handoff?: CollectionHandoffReceipt | null;
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

export const COLLECTION_BLOCK_TYPES = [
  "brand_header",
  "heading",
  "body",
  "access_qr",
  "field_grid",
  "instructions",
  "application_log",
  "divider",
  "footer",
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

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null || (isRecord(value) && !Object.keys(value).length)) return [];
  return [value as T];
}

function contractError(detail: string): Error {
  return new Error(`El backend devolvió un contrato inválido de Recopiladores: ${detail}`);
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

  const state: CollectionState = {
    schema: "collection_state/v1",
    state_revision: revision,
    plan: plan as CollectionPlan | null,
    deployment: deployment as CollectionDeployment | null,
    migration: isRecord(rawState.migration) ? rawState.migration : null,
    material_template: isRecord(rawState.material_template)
      ? rawState.material_template as CollectionMaterialTemplate
      : null,
    material_instances: asArray<CollectionMaterialInstance>(rawState.material_instances),
    artifact_receipts: asArray<CollectionArtifactReceipt>(rawState.artifact_receipts),
  };
  return {
    ok: true,
    noop: value.noop === true,
    seeded: value.seeded === true,
    seed_available: value.seed_available === true,
    ...state,
    state,
    handoff: isRecord(value.handoff) ? value.handoff as CollectionHandoffReceipt : state.deployment?.handoff ?? null,
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
