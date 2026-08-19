import { useMemo, useState } from "react";

import {
  apiRecopiladoresDeploymentPrepare,
  apiRecopiladoresDeploymentPreview,
  apiRecopiladoresDeploymentPut,
  apiRecopiladoresProviderPreflight,
  type CollectionAdapterId,
  type CollectionCapabilityPreflight,
  type CollectionDeployment,
  type CollectionDeploymentPreview,
  type CollectionStatePayload,
  type CollectionTarget,
} from "../../api/recopiladores";
import { PulsoButton } from "../../components/PulsoButton";
import { CheckCircle2, Eye, Link2, Loader2, Save, ShieldCheck } from "../../vendor/lucide-react";
import {
  COLLECTION_ADAPTER_LABELS,
  adapterOperation,
  deploymentFromPreview,
  localProviderBlocking,
} from "./providerRules";
import type { RecopiladoresPestana } from "./navegacion";
import "./styles/access.css";

type Props = {
  payload: CollectionStatePayload | null;
  activeTab: RecopiladoresPestana;
  onState: (payload: CollectionStatePayload) => void;
};

const PROVIDER_BY_ADAPTER: Record<CollectionAdapterId, string> = {
  aulas_v1: "manual",
  manual_links_v1: "manual",
  kobo_existing_v1: "kobo",
  surveymonkey_weblink_existing_v1: "surveymonkey",
  surveymonkey_recipient_existing_v1: "surveymonkey",
};

function targetFromFields(
  adapterId: CollectionAdapterId,
  fields: {
    profile: string;
    baseUrl: string;
    remoteId: string;
    assetType: string;
    active: boolean;
    customVariable: string;
    recipientJson: string;
    prefillField: string;
    returnUrl: string;
  },
): CollectionTarget {
  let recipients: Array<Record<string, unknown>> = [];
  if (fields.recipientJson.trim()) {
    try {
      const parsed: unknown = JSON.parse(fields.recipientJson);
      if (Array.isArray(parsed)) recipients = parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    } catch {
      recipients = [];
    }
  }
  return {
    provider: PROVIDER_BY_ADAPTER[adapterId],
    connection_profile_id: fields.profile || null,
    base_access_url: fields.baseUrl || null,
    asset_uid: adapterId === "kobo_existing_v1" ? fields.remoteId || null : null,
    collector_id: adapterId.startsWith("surveymonkey") ? fields.remoteId || null : null,
    asset_type: adapterId === "kobo_existing_v1" ? fields.assetType || null : null,
    deployment_active: adapterId === "kobo_existing_v1" ? fields.active : null,
    type: adapterId === "surveymonkey_weblink_existing_v1" ? "web_link" : null,
    // Sin valor, el motor decide sola: ruta XPath completa si el Asset UID
    // se conoce, nombre pelado si no. Este campo es la salida de escape
    // explicita, no el camino por defecto.
    prefill_field: adapterId === "kobo_existing_v1" ? fields.prefillField || null : null,
    return_url: adapterId === "kobo_existing_v1" ? fields.returnUrl || null : null,
    custom_variable: adapterId === "surveymonkey_weblink_existing_v1" ? fields.customVariable || null : null,
    custom_variables: adapterId === "surveymonkey_weblink_existing_v1" && fields.customVariable
      ? [fields.customVariable]
      : null,
    recipients: adapterId === "surveymonkey_recipient_existing_v1" ? recipients : null,
  };
}

function capabilityTone(capability: { implementation?: string; policy?: string }) {
  if (capability.policy === "disabled_v1" || capability.implementation === "unavailable") return "is-disabled";
  if (capability.implementation === "available") return "is-ready";
  return "is-pending";
}

export function AccessSection({ payload, activeTab, onState }: Props) {
  const plan = payload?.state.plan ?? null;
  const currentDeployment = payload?.state.deployment ?? null;
  const [adapterId, setAdapterId] = useState<CollectionAdapterId>(
    currentDeployment?.adapter_id ?? plan?.adapter.id ?? "manual_links_v1",
  );
  const [profile, setProfile] = useState(currentDeployment?.target.connection_profile_id ?? "");
  const [baseUrl, setBaseUrl] = useState(currentDeployment?.target.base_access_url ?? "");
  const [remoteId, setRemoteId] = useState(
    currentDeployment?.target.asset_uid ?? currentDeployment?.target.collector_id ?? "",
  );
  const [assetType, setAssetType] = useState(currentDeployment?.target.asset_type ?? "survey");
  const [active, setActive] = useState(currentDeployment?.target.deployment_active === true);
  const [customVariable, setCustomVariable] = useState(currentDeployment?.target.custom_variable ?? "");
  const [recipientJson, setRecipientJson] = useState("[]");
  const [prefillField, setPrefillField] = useState(currentDeployment?.target.prefill_field ?? "");
  const [returnUrl, setReturnUrl] = useState(currentDeployment?.target.return_url ?? "");
  const [preflight, setPreflight] = useState<CollectionCapabilityPreflight | null>(null);
  const [preview, setPreview] = useState<CollectionDeploymentPreview | null>(null);
  const [busy, setBusy] = useState<"preflight" | "preview" | "save" | "prepare" | null>(null);
  const [error, setError] = useState("");

  const target = useMemo(() => targetFromFields(adapterId, {
    profile, baseUrl, remoteId, assetType, active, customVariable, recipientJson, prefillField, returnUrl,
  }), [active, adapterId, assetType, baseUrl, customVariable, prefillField, profile, recipientJson, remoteId, returnUrl]);
  const localBlocking = useMemo(() => localProviderBlocking(adapterId, target), [adapterId, target]);
  const candidate = deploymentFromPreview(preview) ?? currentDeployment;
  const backendBlocking = preflight?.blocking ?? [];
  const blocked = localBlocking.length > 0 || backendBlocking.length > 0;

  const changeAdapter = (next: CollectionAdapterId) => {
    setAdapterId(next);
    setPreflight(null);
    setPreview(null);
    setError("");
  };

  const runPreflight = async () => {
    setBusy("preflight");
    setError("");
    try {
      setPreflight(await apiRecopiladoresProviderPreflight({
        adapter_id: adapterId,
        operation: adapterOperation(adapterId),
        connection_ref: profile ? { connection_profile_id: profile } : {},
        target_ref: target,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo comprobar el target.");
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    if (!plan || blocked) return;
    setBusy("preview");
    setError("");
    try {
      setPreview(await apiRecopiladoresDeploymentPreview({ adapter_id: adapterId, plan, target }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo construir la vista previa.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const deployment = deploymentFromPreview(preview);
    if (!payload || !deployment) return;
    setBusy("save");
    setError("");
    try {
      onState(await apiRecopiladoresDeploymentPut(payload.state_revision, deployment));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el deployment local.");
    } finally {
      setBusy(null);
    }
  };

  const prepare = async () => {
    if (!payload || !candidate || blocked) return;
    setBusy("prepare");
    setError("");
    try {
      onState(await apiRecopiladoresDeploymentPrepare(payload.state_revision, candidate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar el deployment.");
    } finally {
      setBusy(null);
    }
  };

  if (!plan) {
    return <div className="rec-contained-empty" data-qa-geometry-capacity="owned">Crea o adapta un plan antes de configurar accesos.</div>;
  }

  return (
    <div className="rec-access-layout">
      <aside className="rec-target-panel">
        <header><Link2 size={18} /><div><span>Adapter</span><h2>Target existente</h2></div></header>
        <span className="rec-field-group-heading">Conexión</span>
        <label>Tipo de acceso
          <select value={adapterId} onChange={(event) => changeAdapter(event.target.value as CollectionAdapterId)}>
            {Object.entries(COLLECTION_ADAPTER_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>Referencia de conexión
          <input value={profile} onChange={(event) => setProfile(event.target.value)} placeholder="profile-… (sin credenciales)" />
        </label>
        {adapterId === "kobo_existing_v1" || adapterId === "surveymonkey_weblink_existing_v1" ? (
          <label>URL base de captura
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…" />
          </label>
        ) : null}
        {adapterId === "kobo_existing_v1" ? (
          <>
            <span className="rec-field-group-heading">Identidad del asset</span>
            <label>Asset UID<input value={remoteId} onChange={(event) => setRemoteId(event.target.value)} /></label>
            <label>Tipo observado
              <select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
                <option value="survey">survey</option><option value="collection">collection</option><option value="unknown">unknown</option>
              </select>
            </label>
            <label className="rec-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Deployment activo observado</label>
            <span className="rec-field-group-heading">Personalización del enlace</span>
            <label>Campo de personalización (avanzado)
              <input
                value={prefillField}
                onChange={(event) => setPrefillField(event.target.value)}
                placeholder={remoteId ? `/${remoteId}/collectorID` : "collectorID"}
              />
            </label>
            <label>Return URL
              <input
                value={returnUrl}
                onChange={(event) => setReturnUrl(event.target.value)}
                placeholder="https://… (opcional, una sola para todo el estudio)"
              />
            </label>
          </>
        ) : null}
        {adapterId.startsWith("surveymonkey") ? (
          <>
            <span className="rec-field-group-heading">Identidad del collector</span>
            <label>Collector ID<input value={remoteId} onChange={(event) => setRemoteId(event.target.value)} /></label>
          </>
        ) : null}
        {adapterId === "surveymonkey_weblink_existing_v1" ? (
          <label>Custom Variable observada<input value={customVariable} onChange={(event) => setCustomVariable(event.target.value)} placeholder="unit_id" /></label>
        ) : null}
        {adapterId === "surveymonkey_recipient_existing_v1" ? (
          <label>Recipients aprovisionados (JSON)
            <textarea value={recipientJson} onChange={(event) => setRecipientJson(event.target.value)} rows={5} spellCheck={false} />
          </label>
        ) : null}
        <div className="rec-target-actions">
          <PulsoButton variant="secondary" size="sm" onClick={() => { void runPreflight(); }} disabled={Boolean(busy)}>
            {busy === "preflight" ? <Loader2 size={14} className="pulso-spin" /> : <ShieldCheck size={14} />} Comprobar
          </PulsoButton>
          <PulsoButton variant="primary" size="sm" onClick={() => { void runPreview(); }} disabled={Boolean(busy) || blocked}>
            {busy === "preview" ? <Loader2 size={14} className="pulso-spin" /> : <Eye size={14} />} Vista previa local
          </PulsoButton>
        </div>
        <p className="rec-policy-note"><ShieldCheck size={13} /> remote_write está unavailable / disabled_v1. Esta pantalla no crea ni modifica recursos del proveedor.</p>
      </aside>

      <section className="rec-access-result" data-qa-geometry-capacity="owned">
        {activeTab === "canales" ? (
          <>
            <header><div><span>Capabilities observadas</span><h2>Preflight del target</h2></div></header>
            {preflight ? (
              <div className="rec-capability-grid" data-qa-geometry-group="recopiladores/capabilities" data-qa-geometry-contract="equal">
                {Object.entries(preflight.capabilities).map(([name, capability]) => (
                  <article key={name} className={capabilityTone(capability)}>
                    <strong>{name.replaceAll("_", " ")}</strong>
                    <span>{capability.provider_support ?? (capability.observed === false ? "no observado" : "desconocido")}</span>
                    <small>{capability.implementation ?? capability.source ?? "sin implementación"} · {capability.policy ?? "sin política"}</small>
                  </article>
                ))}
              </div>
            ) : <div className="rec-contained-empty">Ejecuta el preflight para separar soporte del proveedor, implementación y política V1.</div>}
          </>
        ) : (
          <>
            <header><div><span>Vinculación</span><h2>Unidad ↔ acceso</h2></div>
              <div className="rec-result-actions">
                <PulsoButton variant="secondary" size="sm" onClick={() => { void save(); }} disabled={!deploymentFromPreview(preview) || Boolean(busy)}><Save size={14} /> Guardar borrador</PulsoButton>
                <PulsoButton variant="primary" size="sm" onClick={() => { void prepare(); }} disabled={!candidate || blocked || Boolean(busy)}><CheckCircle2 size={14} /> Preparar</PulsoButton>
              </div>
            </header>
            {candidate?.bindings.length ? (
              <div className="rec-table-scroll">
                <table><thead><tr><th>Unidad</th><th>Tipo</th><th>Identidad lógica</th><th>Estado</th></tr></thead>
                  <tbody>{candidate.bindings.map((binding) => (
                    <tr key={binding.access_id}><td><strong>{binding.unit_id}</strong><small>{binding.access_id}</small></td><td>{binding.access_kind}</td><td>{binding.logical_collector_id}</td><td><span className={`rec-state is-${binding.status}`}>{binding.status}</span></td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="rec-contained-empty">La vista previa todavía no produjo bindings. Los recipient links solo aparecen si ya llegaron del proveedor.</div>}
          </>
        )}

        {(localBlocking.length || backendBlocking.length) ? (
          <div className="rec-blockers" role="status">
            <strong>Bloqueos antes de generar</strong>
            <ul>{localBlocking.map((item) => <li key={item}>{item}</li>)}{backendBlocking.map((item, index) => <li key={`${item.code}-${index}`}>{item.code}</li>)}</ul>
          </div>
        ) : null}
        {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
