import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  apiMonitoreoTerritorialProductionAnnulmentApply,
  apiMonitoreoTerritorialProductionAnnulmentPreview,
  apiMonitoreoTerritorialProductionAnnulmentRevert,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialProductionAnnulment,
  type MonitoreoTerritorialProductionAnnulmentImpact,
  type MonitoreoTerritorialProductionAnnulmentsPayload,
} from "../../../../api/client";
import { EmptyState } from "../../../../components/States";

type TerritorialProductionAnnulmentRequest = {
  phase?: MonitoreoTerritorialPhase;
  responsible_key: string;
  responsible_label?: string;
  reason?: string;
  note?: string;
};

type TerritorialProductionAnnulmentWorkspaceProps = {
  reports: MonitoreoTerritorialDashboard;
  phase?: MonitoreoTerritorialPhase | string;
  onStateChange?: (state: MonitoreoState) => void;
};

export function TerritorialProductionAnnulmentWorkspace({
  reports,
  phase,
  onStateChange,
}: TerritorialProductionAnnulmentWorkspaceProps) {
  const responsibles = useMemo(() => territorialProductionAnnulmentResponsibles(reports), [reports]);
  const activeEntries = useMemo(
    () => (reports.production_annulments?.entries ?? []).filter((entry) => stringOrEmpty(entry.status) === "active"),
    [reports.production_annulments?.entries],
  );
  const historyEntries = reports.production_annulments?.entries ?? [];
  const [selectedKey, setSelectedKey] = useState(() => responsibles.find((item) => item.status !== "anulado")?.key ?? responsibles[0]?.key ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<MonitoreoTerritorialProductionAnnulmentImpact | null>(null);
  const [localError, setLocalError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedResponsible = responsibles.find((item) => item.key === selectedKey) ?? responsibles[0] ?? null;
  const alreadyAnnulled = !!activeEntries.find((entry) => entry.responsible_key === selectedKey);
  const blocks = preview?.blocks ?? [];

  useEffect(() => {
    if (!selectedKey && responsibles.length) setSelectedKey(responsibles[0]!.key);
  }, [responsibles, selectedKey]);

  useEffect(() => {
    setPreview(null);
    setLocalError("");
  }, [selectedKey]);

  const requestPayload = (): TerritorialProductionAnnulmentRequest | null => {
    if (!selectedResponsible) return null;
    return {
      phase: (phase === "pilot" ? "pilot" : "field") as MonitoreoTerritorialPhase,
      responsible_key: selectedResponsible.key,
      responsible_label: selectedResponsible.label,
      reason,
      note,
    };
  };

  const runPreview = async () => {
    const payload = requestPayload();
    if (!payload) return;
    setSaving(true);
    setLocalError("");
    try {
      const result = await apiMonitoreoTerritorialProductionAnnulmentPreview(payload);
      setPreview(result.impact);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const applyAnnulment = async () => {
    const payload = requestPayload();
    if (!payload) return;
    if (!reason.trim()) {
      setLocalError("Escribe un motivo antes de anular la producción.");
      return;
    }
    const ok = window.confirm(`Anular toda la producción de ${selectedResponsible?.label ?? "este responsable"}? Esta acción no borra Kobo y puede revertirse.`);
    if (!ok) return;
    setSaving(true);
    setLocalError("");
    try {
      const result = await apiMonitoreoTerritorialProductionAnnulmentApply({ ...payload, reason: reason.trim() });
      setPreview(result.impact);
      onStateChange?.(result.state);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const revertAnnulment = async (entry: MonitoreoTerritorialProductionAnnulment) => {
    const reasonText = window.prompt("Motivo de reversión", "Se restaura la producción tras revisión.");
    if (reasonText == null) return;
    setSaving(true);
    setLocalError("");
    try {
      const result = await apiMonitoreoTerritorialProductionAnnulmentRevert({
        id: entry.id,
        phase: (phase === "pilot" ? "pilot" : "field") as MonitoreoTerritorialPhase,
        reason: reasonText,
      });
      setPreview(null);
      onStateChange?.(result.state);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!responsibles.length) {
    return (
      <EmptyState
        icon={<Trash2 size={18} />}
        title="Sin responsables para anular"
        hint="Sin respuestas de campo no hay producción que tachar."
      />
    );
  }

  return (
    <section className="mon-production-annulments" aria-label="Anulación de producción territorial">
      <header className="mon-production-annulments__hero">
        <div>
          <span><Trash2 size={14} /> Anulación auditada · Campo</span>
          <strong>Tachar producción de un Responsable Pulso</strong>
          <p>La tacha excluye sus respuestas de avance, cuotas, consultas, mapas y exportables normales. Kobo permanece intacto.</p>
        </div>
        <div className="mon-production-annulments__chips" aria-label="Resumen de anulaciones">
          <span className="is-danger"><strong>{formatMetric(reports.production_annulments?.summary?.active ?? 0)}</strong><em>activas</em></span>
          <span><strong>{formatMetric(reports.production_annulments?.summary?.annulled_responses ?? 0)}</strong><em>respuestas excluidas</em></span>
          <span><strong>{formatMetric(reports.production_annulments?.summary?.affected_umps ?? 0)}</strong><em>UMP afectadas</em></span>
        </div>
      </header>

      <div className="mon-production-annulments__grid">
        <section className="mon-production-annulments__control">
          <label>
            <span>Responsable Pulso</span>
            <select value={selectedKey} onChange={(event) => setSelectedKey(event.currentTarget.value)}>
              {responsibles.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} · {formatMetric(item.responses ?? 0)} respuestas · {formatMetric(item.valid_responses ?? 0)} válidas · {formatMetric(item.umps ?? 0)} UMP
                </option>
              ))}
            </select>
          </label>
          {selectedResponsible ? (
            <div className="mon-production-annulments__responsible">
              <strong>{selectedResponsible.label}</strong>
              <span>
                {formatMetric(selectedResponsible.responses ?? 0)} respuestas · {formatMetric(selectedResponsible.valid_responses ?? 0)} válidas · {formatMetric(selectedResponsible.umps ?? 0)} UMP · {selectedResponsible.districts || "sin distrito"}
              </span>
              {alreadyAnnulled ? <em>Ya tiene una anulación activa.</em> : null}
            </div>
          ) : null}
          <label>
            <span>Motivo obligatorio</span>
            <input value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Ej. producción observada por supervisión" />
          </label>
          <label>
            <span>Nota de auditoría</span>
            <textarea value={note} onChange={(event) => setNote(event.currentTarget.value)} rows={4} placeholder="Describe qué se revisó y por qué se toma la decisión." />
          </label>
          {localError ? <p className="mon-production-annulments__error">{localError}</p> : null}
          <div className="mon-production-annulments__actions">
            <button type="button" onClick={runPreview} disabled={saving || !selectedResponsible}>
              {saving ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
              <span>Previsualizar impacto</span>
            </button>
            <button type="button" className="is-danger" onClick={applyAnnulment} disabled={saving || !selectedResponsible || alreadyAnnulled}>
              <Trash2 size={14} />
              <span>Anular producción</span>
            </button>
          </div>
        </section>

        <section className="mon-production-annulments__impact">
          <header>
            <span>Impacto previsto</span>
            <strong>{preview ? `${formatMetric(preview.responses_excluded ?? 0)} respuestas saldrían del avance` : "Previsualización pendiente"}</strong>
          </header>
          <div className="mon-production-annulments__metrics">
            <span><strong>{formatMetric(preview?.valid_responses_excluded ?? 0)}</strong><em>válidas excluidas</em></span>
            <span><strong>{formatMetric(preview?.umps_affected ?? 0)}</strong><em>UMP afectadas</em></span>
            <span><strong>{formatMetric(preview?.blocks_affected ?? 0)}</strong><em>manzanas afectadas</em></span>
            <span><strong>{formatMetric(preview?.after?.valid_responses ?? reports.kpis.validas)}</strong><em>válidas después</em></span>
          </div>
          <div className="mon-production-annulments__tablewrap">
            <table>
              <thead>
                <tr>
                  <th>UMP</th>
                  <th>Manzana</th>
                  <th>Antes</th>
                  <th>Después</th>
                  <th>Pérdida</th>
                  <th>Brecha</th>
                </tr>
              </thead>
              <tbody>
                {blocks.length ? blocks.slice(0, 12).map((block) => (
                  <tr key={`${block.id_manzana ?? ""}-${block.ump ?? ""}`}>
                    <td><strong>{block.ump || "S/D"}</strong><span>{block.distrito || ""}</span></td>
                    <td>{block.manzana || "S/D"}</td>
                    <td>{territorialAnnulmentStatusLabel(block.estado_antes)} · {formatMetric(block.validas_antes ?? 0)}</td>
                    <td>{territorialAnnulmentStatusLabel(block.estado_despues)} · {formatMetric(block.validas_despues ?? 0)}</td>
                    <td>{formatMetric(block.validas_anuladas ?? block.respuestas_anuladas ?? 0)}</td>
                    <td>{formatMetric(block.brecha_despues ?? 0)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>Previsualiza un responsable para ver las UMP afectadas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mon-production-annulments__history">
        <header>
          <span>Historial</span>
          <strong>{formatMetric(historyEntries.length)} tachas registradas</strong>
        </header>
        <div className="mon-production-annulments__history-list">
          {historyEntries.length ? historyEntries.map((entry) => (
            <article key={entry.id} className={stringOrEmpty(entry.status) === "active" ? "is-active" : ""}>
              <div>
                <span>{stringOrEmpty(entry.status) === "active" ? "Activa" : "Revertida"}</span>
                <strong>{entry.responsible_label}</strong>
                <em>{entry.reason || "Sin motivo registrado"} · {entry.created_at ? formatDate(entry.created_at) : "sin fecha"}</em>
              </div>
              <div>
                <strong>{formatMetric(entry.impact?.responses_excluded ?? 0)}</strong>
                <span>respuestas</span>
              </div>
              {stringOrEmpty(entry.status) === "active" ? (
                <button type="button" onClick={() => { void revertAnnulment(entry); }} disabled={saving}>
                  <RefreshCw size={14} />
                  <span>Revertir</span>
                </button>
              ) : (
                <span className="mon-production-annulments__reverted">{entry.revert_reason || "Revertida"}</span>
              )}
            </article>
          )) : (
            <p>Sin anulaciones registradas.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function territorialProductionAnnulmentKey(value: unknown) {
  return normalizeMatch(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function territorialProductionAnnulmentResponsibles(
  reports: MonitoreoTerritorialDashboard,
): NonNullable<MonitoreoTerritorialProductionAnnulmentsPayload["responsibles"]> {
  const fromPayload = reports.production_annulments?.responsibles ?? [];
  const grouped = new Map<string, {
    key: string;
    label: string;
    pulso_code?: string;
    responses: number;
    valid_responses: number;
    umps: Set<string>;
    districts: Set<string>;
    latest_activity: string;
    status: string;
  }>();
  for (const row of reports.response_audit ?? []) {
    const label = stringOrEmpty(row.responsible_display || row.submitted_by || row.pulso_code || "Sin responsable").trim();
    const key = territorialProductionAnnulmentKey(label);
    if (!key) continue;
    const current = grouped.get(key) ?? {
      key,
      label,
      pulso_code: stringOrEmpty(row.pulso_code),
      responses: 0,
      valid_responses: 0,
      umps: new Set<string>(),
      districts: new Set<string>(),
      latest_activity: "",
      status: "activo",
    };
    current.responses += 1;
    if (row.source_effective === true || stringOrEmpty(row.source_effective).toLowerCase() === "true") current.valid_responses += 1;
    const ump = stringOrEmpty(row.advance_block_ump || row.declared_ump_raw || row.declared_ump_normalized).trim();
    if (ump) current.umps.add(ump);
    const district = stringOrEmpty(row.distrito || row.advance_block_distrito).trim();
    if (district) current.districts.add(district);
    const date = stringOrEmpty(row.submission_date_iso || row.submission_time).trim();
    if (date && date > current.latest_activity) current.latest_activity = date;
    grouped.set(key, current);
  }
  const fromAudit = [...grouped.values()]
    .sort((a, b) => b.responses - a.responses || a.label.localeCompare(b.label))
    .map((item) => ({
      key: item.key,
      label: item.label,
      pulso_code: item.pulso_code,
      responses: item.responses,
      valid_responses: item.valid_responses,
      umps: item.umps.size,
      districts: [...item.districts].join(" · "),
      latest_activity: item.latest_activity,
      status: item.status,
    }));
  if (!fromPayload.length) return fromAudit;
  const auditByKey = new Map(fromAudit.map((item) => [item.key, item]));
  const auditByPulsoCode = new Map(
    fromAudit
      .map((item) => [stringOrEmpty(item.pulso_code).toUpperCase(), item] as const)
      .filter(([code]) => code),
  );
  return fromPayload.map((item) => {
    const fallback = auditByKey.get(item.key)
      ?? auditByPulsoCode.get(stringOrEmpty(item.pulso_code).toUpperCase())
      ?? auditByKey.get(territorialProductionAnnulmentKey(item.label));
    if (!fallback) return item;
    const payloadUmps = Math.max(0, Math.round(numberOrNull(item.umps) ?? 0));
    return {
      ...item,
      label: item.label || fallback.label,
      pulso_code: item.pulso_code || fallback.pulso_code,
      responses: numberOrNull(item.responses) ?? fallback.responses,
      valid_responses: numberOrNull(item.valid_responses) ?? fallback.valid_responses,
      umps: payloadUmps > 0 ? payloadUmps : fallback.umps,
      districts: item.districts || fallback.districts,
      latest_activity: item.latest_activity || fallback.latest_activity,
      status: item.status || fallback.status,
    };
  });
}

function territorialAnnulmentStatusLabel(value: string | undefined | null) {
  const status = stringOrEmpty(value);
  const labels: Record<string, string> = {
    complete: "Completa",
    subsanada: "Subsanada",
    subsanado: "Subsanada",
    subsanacion: "Subsanada",
    subsanacion_operativa: "Subsanada",
    exceeded: "Completa",
    in_field: "En campo",
    pending: "Cuota pendiente",
    missing: "No iniciada",
    not_configured: "Sin cuota",
    sin_cruce_ruta: "Sin cruce de ruta",
  };
  return labels[status] ?? (status || "S/D");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrEmpty(value: unknown) {
  return value == null ? "" : String(value);
}

function normalizeMatch(value: unknown) {
  return stringOrEmpty(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}
