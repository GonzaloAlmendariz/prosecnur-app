import { memo, useEffect, useMemo, useState } from "react";
import { Eye, Hash, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
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
  scope?: "all_production" | "response";
  responsible_key?: string;
  responsible_label?: string;
  response_id?: string;
  response_label?: string;
  reason?: string;
  note?: string;
};

type TerritorialProductionAnnulmentMode = "responsible" | "response";

type TerritorialProductionAnnulmentCase = {
  response_id: string;
  label: string;
  responsible_key?: string;
  responsible_label?: string;
  pulso_code?: string;
  district?: string;
  ump?: string;
  validation_status?: string;
  source_effective?: string;
  latest_activity?: string;
};

type TerritorialProductionAnnulmentWorkspaceProps = {
  reports: MonitoreoTerritorialDashboard;
  phase?: MonitoreoTerritorialPhase | string;
  onStateChange?: (state: MonitoreoState) => void;
};

function TerritorialProductionAnnulmentWorkspaceImpl({
  reports,
  phase,
  onStateChange,
}: TerritorialProductionAnnulmentWorkspaceProps) {
  const responsibles = useMemo(() => territorialProductionAnnulmentResponsibles(reports), [reports]);
  const caseOptions = useMemo(() => territorialProductionAnnulmentCases(reports), [reports]);
  const activeEntries = useMemo(
    () => (reports.production_annulments?.entries ?? []).filter((entry) => stringOrEmpty(entry.status) === "active"),
    [reports.production_annulments?.entries],
  );
  const historyEntries = reports.production_annulments?.entries ?? [];
  const [mode, setMode] = useState<TerritorialProductionAnnulmentMode>("responsible");
  const [selectedKey, setSelectedKey] = useState(() => responsibles.find((item) => item.status !== "anulado")?.key ?? responsibles[0]?.key ?? "");
  const [responsibleQuery, setResponsibleQuery] = useState("");
  const [responseId, setResponseId] = useState(() => caseOptions[0]?.response_id ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<MonitoreoTerritorialProductionAnnulmentImpact | null>(null);
  const [localError, setLocalError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedResponsible = responsibles.find((item) => item.key === selectedKey) ?? responsibles[0] ?? null;
  const filteredResponsibles = useMemo(() => {
    const query = normalizeMatch(responsibleQuery);
    if (!query) return responsibles;
    return responsibles.filter((item) => territorialProductionAnnulmentResponsibleSearchText(item).includes(query));
  }, [responsibleQuery, responsibles]);
  const visibleResponsibles = useMemo(() => {
    if (!selectedResponsible) return filteredResponsibles;
    if (filteredResponsibles.some((item) => item.key === selectedResponsible.key)) return filteredResponsibles;
    return [selectedResponsible, ...filteredResponsibles];
  }, [filteredResponsibles, selectedResponsible]);
  const selectedCase = caseOptions.find((item) => territorialProductionAnnulmentResponseKey(item.response_id) === territorialProductionAnnulmentResponseKey(responseId)) ?? null;
  const alreadyAnnulled = mode === "response"
    ? !!activeEntries.find((entry) => stringOrEmpty(entry.scope) === "response" && territorialProductionAnnulmentResponseKey(entry.response_id) === territorialProductionAnnulmentResponseKey(responseId))
    : !!activeEntries.find((entry) => stringOrEmpty(entry.scope || "all_production") !== "response" && entry.responsible_key === selectedKey);
  const hasTarget = mode === "response" ? !!responseId.trim() : !!selectedResponsible;
  const blocks = preview?.blocks ?? [];

  useEffect(() => {
    if (!selectedKey && responsibles.length) setSelectedKey(responsibles[0]!.key);
  }, [responsibles, selectedKey]);

  useEffect(() => {
    if (mode === "responsible" && !responsibles.length && caseOptions.length) setMode("response");
  }, [caseOptions.length, mode, responsibles.length]);

  useEffect(() => {
    if (!responseId && caseOptions.length) setResponseId(caseOptions[0]!.response_id);
  }, [caseOptions, responseId]);

  useEffect(() => {
    setPreview(null);
    setLocalError("");
  }, [mode, selectedKey, responseId]);

  const requestPayload = (): TerritorialProductionAnnulmentRequest | null => {
    if (mode === "response") {
      const id = responseId.trim();
      if (!id) {
        setLocalError("Ingresa el UUID o ID de respuesta del caso.");
        return null;
      }
      return {
        phase: (phase === "pilot" ? "pilot" : "field") as MonitoreoTerritorialPhase,
        scope: "response",
        response_id: id,
        response_label: selectedCase?.label ?? id,
        responsible_key: selectedCase?.responsible_key,
        responsible_label: selectedCase?.responsible_label,
        reason,
        note,
      };
    }
    if (!selectedResponsible) return null;
    return {
      phase: (phase === "pilot" ? "pilot" : "field") as MonitoreoTerritorialPhase,
      scope: "all_production",
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
      setLocalError("Escribe un motivo antes de registrar la anulación.");
      return;
    }
    const targetLabel = mode === "response"
      ? (selectedCase?.label ?? responseId.trim())
      : `toda la producción de ${selectedResponsible?.label ?? "este responsable"}`;
    const ok = window.confirm(`Anular ${targetLabel}? Esta acción no borra Kobo y puede revertirse.`);
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

  if (!responsibles.length && !caseOptions.length) {
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
          <strong>Tachar producción o un caso por UUID</strong>
          <p>La tacha excluye respuestas de avance, cuotas, consultas, mapas y exportables normales. Kobo permanece intacto.</p>
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
            <span>Tipo de anulación</span>
            <select value={mode} onChange={(event) => setMode(event.currentTarget.value as TerritorialProductionAnnulmentMode)}>
              <option value="responsible">Responsable completo</option>
              <option value="response">Caso individual por UUID</option>
            </select>
          </label>
          {mode === "responsible" ? (
            <>
              <label className="mon-production-annulments__responsible-picker">
                <span>Responsable Pulso</span>
                <div className="mon-production-annulments__search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={responsibleQuery}
                    onChange={(event) => setResponsibleQuery(event.currentTarget.value)}
                    placeholder="Buscar código o nombre del responsable"
                    aria-label="Buscar código o nombre del responsable Pulso"
                  />
                </div>
                <select value={selectedKey} onChange={(event) => setSelectedKey(event.currentTarget.value)}>
                  {visibleResponsibles.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {responsibleQuery ? (
                  <em className="mon-production-annulments__filter-note">
                    {filteredResponsibles.length
                      ? `${formatMetric(filteredResponsibles.length)} coincidencia${filteredResponsibles.length === 1 ? "" : "s"}`
                      : "Sin coincidencias; se mantiene la selección actual."}
                  </em>
                ) : null}
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
            </>
          ) : (
            <>
              <label>
                <span>UUID / ID respuesta</span>
                <input
                  list="mon-production-annulments-cases"
                  value={responseId}
                  onChange={(event) => setResponseId(event.currentTarget.value)}
                  placeholder="Pega el UUID del caso"
                />
                <datalist id="mon-production-annulments-cases">
                  {caseOptions.slice(0, 500).map((item) => (
                    <option key={item.response_id} value={item.response_id} label={item.label} />
                  ))}
                </datalist>
              </label>
              <div className="mon-production-annulments__responsible">
                <strong>{selectedCase?.label ?? "Caso ingresado manualmente"}</strong>
                <span>
                  {selectedCase
                    ? `${selectedCase.responsible_label || "sin responsable"} · ${selectedCase.district || "sin distrito"} · ${selectedCase.ump || "sin UMP"} · ${selectedCase.validation_status || "sin estado"}`
                    : "Se validará contra la auditoría territorial vigente al previsualizar o aplicar."}
                </span>
                {alreadyAnnulled ? <em>Ya tiene una anulación activa.</em> : null}
              </div>
            </>
          )}
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
            <button type="button" onClick={runPreview} disabled={saving || !hasTarget}>
              {saving ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
              <span>Previsualizar impacto</span>
            </button>
            <button type="button" className="is-danger" onClick={applyAnnulment} disabled={saving || !hasTarget || alreadyAnnulled}>
              {mode === "response" ? <Hash size={14} /> : <Trash2 size={14} />}
              <span>{mode === "response" ? "Anular caso" : "Anular producción"}</span>
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
                    <td colSpan={6}>Previsualiza la anulación para ver las UMP afectadas.</td>
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
                <strong>{territorialProductionAnnulmentEntryLabel(entry)}</strong>
                <em>{territorialProductionAnnulmentEntryScope(entry) === "response" ? "Caso individual" : "Responsable completo"} · {entry.reason || "Sin motivo registrado"} · {entry.created_at ? formatDate(entry.created_at) : "sin fecha"}</em>
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

function territorialProductionAnnulmentResponseKey(value: unknown) {
  return stringOrEmpty(value).trim().replace(/^uuid[:/]+/i, "").toLowerCase();
}

function territorialProductionAnnulmentEntryScope(entry: MonitoreoTerritorialProductionAnnulment) {
  return stringOrEmpty(entry.scope || "all_production") === "response" ? "response" : "all_production";
}

function territorialProductionAnnulmentEntryLabel(entry: MonitoreoTerritorialProductionAnnulment) {
  if (territorialProductionAnnulmentEntryScope(entry) === "response") {
    return entry.response_label || entry.response_id || "Caso individual";
  }
  return entry.responsible_label || entry.responsible_key || "Responsable Pulso";
}

function territorialProductionAnnulmentResponsibleSearchText(
  item: NonNullable<MonitoreoTerritorialProductionAnnulmentsPayload["responsibles"]>[number],
) {
  return normalizeMatch([
    item.key,
    item.label,
    item.pulso_code,
    item.districts,
    item.responses,
    item.valid_responses,
    item.umps,
  ].filter((value) => value != null && value !== "").join(" "));
}

function territorialProductionAnnulmentKey(value: unknown) {
  return normalizeMatch(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function territorialProductionAnnulmentCases(reports: MonitoreoTerritorialDashboard): TerritorialProductionAnnulmentCase[] {
  const seen = new Set<string>();
  const rows: TerritorialProductionAnnulmentCase[] = [];
  for (const row of reports.response_audit ?? []) {
    const rowAliases = row as unknown as Record<string, unknown>;
    const responseId = stringOrEmpty(row.response_id || rowAliases._uuid || rowAliases.uuid || rowAliases.id_respuesta).trim();
    const responseKey = territorialProductionAnnulmentResponseKey(responseId);
    if (!responseKey || seen.has(responseKey)) continue;
    seen.add(responseKey);
    const responsibleLabel = stringOrEmpty(row.responsible_display || row.submitted_by || row.pulso_code || "Sin responsable").trim();
    const district = stringOrEmpty(row.distrito || row.advance_block_distrito || rowAliases.district).trim();
    const ump = stringOrEmpty(row.advance_block_ump || row.declared_ump_raw || row.declared_ump_normalized || rowAliases.ump).trim();
    const validationStatus = stringOrEmpty(row.validation_status).trim();
    const latestActivity = stringOrEmpty(row.submission_date_iso || row.submission_time).trim();
    rows.push({
      response_id: responseId,
      label: [responseId, responsibleLabel, district, ump].filter(Boolean).join(" · "),
      responsible_key: territorialProductionAnnulmentKey(responsibleLabel),
      responsible_label: responsibleLabel,
      pulso_code: stringOrEmpty(row.pulso_code).trim(),
      district,
      ump,
      validation_status: validationStatus,
      source_effective: stringOrEmpty(row.source_effective).trim(),
      latest_activity: latestActivity,
    });
  }
  return rows.sort((a, b) => (b.latest_activity || "").localeCompare(a.latest_activity || "") || a.response_id.localeCompare(b.response_id));
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

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialProductionAnnulmentWorkspace = memo(TerritorialProductionAnnulmentWorkspaceImpl);
