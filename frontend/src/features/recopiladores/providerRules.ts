import type {
  CollectionAccessBinding,
  CollectionAdapterId,
  CollectionDeployment,
  CollectionDeploymentPreview,
  CollectionTarget,
} from "../../api/recopiladores";

export const COLLECTION_ADAPTER_LABELS: Record<CollectionAdapterId, string> = {
  aulas_v1: "Aulas (compatibilidad)",
  manual_links_v1: "Enlaces entregados manualmente",
  kobo_existing_v1: "Kobo · asset existente",
  surveymonkey_weblink_existing_v1: "SurveyMonkey · Web Link existente",
  surveymonkey_recipient_existing_v1: "SurveyMonkey · recipients existentes",
};

// `CollectionDeployment["status"]` es un union type cerrado de 4 valores
// (api/recopiladores.ts) — a diferencia de `unit_type`, que cada adapter
// declara libremente y por eso no se traduce. RecopiladoresShell.tsx (chip
// del top bar) y MaterialsSection.tsx (pestaña Paquetes) mostraban el valor
// crudo del backend; ambos consumen este mismo mapa para no divergir.
const DEPLOYMENT_STATUS_LABELS: Record<CollectionDeployment["status"], string> = {
  draft: "Borrador",
  prepared: "Preparado",
  handed_off: "Entregado a Monitoreo",
  stale: "Desactualizado",
};

export function deploymentStatusLabel(status: string): string {
  return DEPLOYMENT_STATUS_LABELS[status as CollectionDeployment["status"]] ?? status;
}

// `access_kind` es un union type cerrado de 4 valores (api/recopiladores.ts).
const ACCESS_KIND_LABELS: Record<CollectionAccessBinding["access_kind"], string> = {
  parameterized_link: "Enlace personalizado",
  provider_collector: "Collector del proveedor",
  recipient_link: "Enlace de destinatario",
  manual_handoff: "Entrega manual",
};

export function accessKindLabel(kind: string): string {
  return ACCESS_KIND_LABELS[kind as CollectionAccessBinding["access_kind"]] ?? kind;
}

// `binding.status` llega tipado como `string` suelto (no un union cerrado),
// pero el motor solo produce estos dos valores: `.ca_binding()` en
// api/R/collection_adapters.R (~línea 398) —
// `status = if (...) "ready" else "missing"`. Si el motor agrega un tercer
// valor algún día, esta tabla queda corta y cae al string crudo, pero no
// rompe.
const BINDING_STATUS_LABELS: Record<string, string> = {
  ready: "Listo",
  missing: "Falta enlace",
};

export function bindingStatusLabel(status: string): string {
  return BINDING_STATUS_LABELS[status] ?? status;
}

// `target.provider` también llega como `string` suelto, pero el registro de
// adapters (`.ca_adapter()` en api/R/collection_adapters.R ~línea 534) solo
// produce estos tres. Kobo/SurveyMonkey son nombres de marca -Accesos ya los
// capitaliza así en el selector de canal-; DeliverySection.tsx los mostraba
// en minúscula cruda en el campo "Target".
const PROVIDER_LABELS: Record<string, string> = {
  manual: "manual",
  kobo: "Kobo",
  surveymonkey: "SurveyMonkey",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function adapterOperation(adapterId: CollectionAdapterId) {
  return adapterId === "surveymonkey_recipient_existing_v1"
    ? "native_link_reuse"
    : "local_generation";
}

function captureUrlIssue(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "Falta una URL de captura.";
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/.test(parsed.protocol)) return "La URL debe usar HTTP o HTTPS.";
    if (parsed.hash) return "La URL tiene un fragmento administrativo y no es una URL de captura.";
  } catch {
    return "La URL de captura no es válida.";
  }
  return null;
}

/** Bloqueos visibles antes del preflight autoritativo del backend. */
export function localProviderBlocking(
  adapterId: CollectionAdapterId,
  target: CollectionTarget,
): string[] {
  if (adapterId === "kobo_existing_v1") {
    return [
      captureUrlIssue(target.base_access_url),
      target.asset_type === "survey" ? null : "Kobo exige un asset_type survey observado.",
      target.deployment_active === true ? null : "Kobo exige un deployment activo observado.",
    ].filter((item): item is string => Boolean(item));
  }
  if (adapterId === "surveymonkey_weblink_existing_v1") {
    return [
      captureUrlIssue(target.base_access_url),
      String(target.custom_variable ?? "").trim()
        ? null
        : "SurveyMonkey Web Link exige una Custom Variable ya definida.",
    ].filter((item): item is string => Boolean(item));
  }
  if (adapterId === "surveymonkey_recipient_existing_v1") {
    return Array.isArray(target.recipients) && target.recipients.length
      ? []
      : ["Los recipient links deben venir aprovisionados por SurveyMonkey; no se fabrican localmente."];
  }
  return [];
}

export function deploymentFromPreview(
  value: CollectionDeploymentPreview | null,
): CollectionDeployment | null {
  if (!value) return null;
  if (value.deployment?.schema === "collection_deployment/v1") return value.deployment;
  if (value.preview && "schema" in value.preview && value.preview.schema === "collection_deployment/v1") {
    return value.preview;
  }
  if (value.preview && "deployment" in value.preview) {
    return value.preview.deployment?.schema === "collection_deployment/v1"
      ? value.preview.deployment
      : null;
  }
  return null;
}
