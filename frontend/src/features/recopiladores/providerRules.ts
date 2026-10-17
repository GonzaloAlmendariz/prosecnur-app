import type {
  CollectionAccessBinding,
  CollectionAdapterId,
  CollectionDeployment,
  CollectionDeploymentPreview,
  CollectionPlan,
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

/**
 * Campos que el backend DEDUJO al leer el deployment (H27): vienen en
 * `deployment_derived_fields` con su ruta («adapter_id»,
 * «target.deployment_active») y no están guardados. Se pintan, pero no se
 * reenvían como si alguien los hubiera observado.
 */
export const CAMPO_ACTIVO_DERIVADO = "target.deployment_active";
export const CAMPO_ADAPTER_DERIVADO = "adapter_id";

/** Los derivados que siguen siéndolo: el que el usuario tocó pasa a ser suyo. */
export function derivadosPendientes(
  derivados: readonly string[] | null | undefined,
  tocados: ReadonlySet<string>,
): string[] {
  return (derivados ?? []).filter((ruta) => !tocados.has(ruta));
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Copia sin las rutas dadas («a» o «a.b»); no muta el original. */
export function sinCampos<T extends object>(objeto: T, rutas: readonly string[]): T {
  const copia: Record<string, unknown> = { ...(objeto as Record<string, unknown>) };
  for (const ruta of rutas) {
    const [cabeza, ...resto] = ruta.split(".");
    if (!cabeza || !(cabeza in copia)) continue;
    if (!resto.length) {
      delete copia[cabeza];
      continue;
    }
    const hijo = copia[cabeza];
    if (esObjeto(hijo)) copia[cabeza] = sinCampos(hijo, [resto.join(".")]);
  }
  return copia as T;
}

/** El target que sale hacia el backend, sin los `target.*` aún deducidos. */
export function targetParaEnviar(target: CollectionTarget, pendientes: readonly string[]): CollectionTarget {
  const rutas = pendientes
    .filter((ruta) => ruta.startsWith("target."))
    .map((ruta) => ruta.slice("target.".length));
  return sinCampos(target, rutas);
}

/** El deployment leído del estado, listo para PUT/prepare sin sus deducidos. */
export function deploymentParaEnviar(
  deployment: CollectionDeployment,
  pendientes: readonly string[],
): CollectionDeployment {
  return sinCampos(deployment, pendientes);
}

/** Cuerpo de `deployment/preview`: el `adapter_id` es el del selector, no un deducido. */
export function cuerpoDeVistaPrevia(input: {
  adapterId: CollectionAdapterId;
  plan: CollectionPlan;
  target: CollectionTarget;
  pendientes: readonly string[];
}): { adapter_id: CollectionAdapterId; plan: CollectionPlan; target: CollectionTarget } {
  return { adapter_id: input.adapterId, plan: input.plan, target: targetParaEnviar(input.target, input.pendientes) };
}

/** Bloqueos visibles antes del preflight autoritativo del backend. */
export function localProviderBlocking(
  adapterId: CollectionAdapterId,
  target: CollectionTarget,
  pendientes: readonly string[] = [],
): string[] {
  if (adapterId === "kobo_existing_v1") {
    const activoDeducido = pendientes.includes(CAMPO_ACTIVO_DERIVADO) && target.deployment_active === true;
    return [
      captureUrlIssue(target.base_access_url),
      target.asset_type === "survey" ? null : "Kobo exige un asset_type survey observado.",
      activoDeducido
        ? "Confirma que el formulario sigue aceptando respuestas."
        : target.deployment_active === true ? null : "Kobo exige un formulario publicado y activo.",
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
