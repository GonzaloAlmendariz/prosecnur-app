import type {
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
