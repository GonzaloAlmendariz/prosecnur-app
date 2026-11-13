// Auditoría de decisiones de SurveyMonkey del asistente de fuentes independientes (sale de BasesPanel.tsx en L6).

import { Fragment, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Loader2, RefreshCw, Search, SlidersHorizontal, X as XIcon } from "lucide-react";
import { apiSurveyMonkeyMultibaseDecisionApply, apiSurveyMonkeyMultibaseDecisionPreview } from "../../../api/client";
import type { EstudioBase, EstudioPayload, SurveyMonkeyDecisionAudit, SurveyMonkeyDecisionPolicy } from "../../../api/client";
import { ErrorBlock } from "../../../components/States";
import { Switch } from "../../../components/Switch";
import { smCollectorFriendlyName, smConsentOptions, smDecisionAuditReady, smDecisionCaseDecisionLabel, smDecisionCaseRows, smDecisionCollectorIsTest, smDecisionCollectorOptions, smDecisionCollectorStateClass, smDecisionCollectorStateLabel, smDecisionCompareLabel, smDecisionCompareTone, smDecisionDownstreamLabels, smDecisionDuplicateEvidenceLine, smDecisionDuplicateOptionLabel, smDecisionDuplicateOptions, smDecisionInitialPolicy, smDecisionNumber, smDecisionOptionalNumber, smDecisionPercentLabel, smDecisionPolicyFingerprint, smDecisionPolicyForSurveyMonkeyCommit, smDecisionProgressWidth, smDecisionQuestionOptionLabel, smDecisionRowsDeltaLabel, smDecisionRowsDeltaTone, smDecisionRowsImpactText, smDecisionRowsLabel, smDecisionSourceName, smDecisionTextToValues, smDecisionValidCollectorIds, smDecisionValuesToText, smDecisionVariableOptions, smSourceSummariesFromBase, smTextShortcutGuard } from "../surveymonkey/smBasesModel";
import type { SmDecisionCaseRow } from "../surveymonkey/smBasesModel";

import { EstadoVacio } from "../../../components/EstadoVacio";
import { EstadoChip } from "../../../components/EstadoChip";
function SmDecisionMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return (
    <span className={`pulso-sm-decision-metric is-${tone}`}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

function SmDecisionCompletionCell({ row }: { row: SmDecisionCaseRow }) {
  const percent = smDecisionPercentLabel(row.completionRatio);
  return (
    <div
      className={`pulso-sm-case-completion${row.nearComplete ? " is-near" : ""}`}
      title="Obligatorias aplicables respondidas / obligatorias aplicables totales"
    >
      <div className="pulso-sm-case-completion-top">
        <b>{row.completionLabel || row.respondidas || "0"}</b>
        {percent && <span>{percent}</span>}
      </div>
      <span className="pulso-sm-case-completion-track" aria-hidden="true">
        <i style={{ width: smDecisionProgressWidth(row.completionRatio) }} />
      </span>
    </div>
  );
}

function SmDecisionSignature({ audit }: { audit: SurveyMonkeyDecisionAudit | null }) {
  if (!audit) {
    return (
      <div className="pulso-sm-decision-signature is-empty">
        <Loader2 size={13} className="pulso-spin" />
        <span>Calculando firma de impacto...</span>
      </div>
    );
  }
  return (
    <div className="pulso-sm-decision-signature" aria-label="Firma de impacto SurveyMonkey">
      <SmDecisionMetric label="descargadas" value={smDecisionNumber(audit.raw_total)} />
      <SmDecisionMetric label="efectivas" value={smDecisionNumber(audit.completed_with_consent)} tone="good" />
      <SmDecisionMetric label="parciales" value={smDecisionNumber(audit.partials_revisable)} tone="warn" />
      <SmDecisionMetric label="rechazos" value={smDecisionNumber(audit.rejections)} tone="danger" />
      <SmDecisionMetric label="duplicados" value={smDecisionNumber(audit.duplicate_extra_rows)} tone={smDecisionNumber(audit.duplicate_extra_rows) ? "warn" : "neutral"} />
      <SmDecisionMetric label="rescate manual" value={smDecisionNumber(audit.manual_included)} tone={smDecisionNumber(audit.manual_included) ? "warn" : "neutral"} />
      <SmDecisionMetric label="incluidas" value={smDecisionNumber(audit.included)} tone="good" />
      <SmDecisionMetric label="excluidas" value={smDecisionNumber(audit.excluded)} />
      <SmDecisionMetric label="fuentes" value={smDecisionNumber(audit.collectors_included)} />
    </div>
  );
}

function SmDecisionSourceAuditTable({ audit }: { audit: SurveyMonkeyDecisionAudit | null }) {
  const sources = audit?.sources ?? [];
  if (!sources.length) return null;
  return (
    <div className="pulso-sm-source-audit">
      <div className="pulso-sm-source-audit-head">
        <span>Campañas y fuentes</span>
        <em>{sources.length} fuente{sources.length === 1 ? "" : "s"}</em>
      </div>
      <div className="pulso-sm-source-audit-grid" role="table" aria-label="Auditoría por campaña SurveyMonkey">
        <span>Campaña</span>
        <span>Descargadas</span>
        <span>Efectivas</span>
        <span>Parciales</span>
        <span>Rechazos</span>
        <span>Duplicados</span>
        <span>Rescate</span>
        <span>Incluidas</span>
        {sources.map((source) => (
          <Fragment key={`${source.survey_id || "survey"}-${smDecisionSourceName(source)}`}>
            <strong title={smDecisionSourceName(source)}>
              {smDecisionSourceName(source)}
            </strong>
            <b>{smDecisionNumber(source.raw_total)}</b>
            <b>{smDecisionNumber(source.completed_with_consent)}</b>
            <b>{smDecisionNumber(source.partials_revisable)}</b>
            <b>{smDecisionNumber(source.rejections)}</b>
            <b>{smDecisionNumber(source.duplicate_extra_rows)}</b>
            <b>{smDecisionNumber(source.manual_included)}</b>
            <b>{smDecisionNumber(source.included)}</b>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SmDecisionImpactCard({
  currentRows,
  previewRows,
  impactText,
}: {
  currentRows: number | null;
  previewRows: number | null;
  impactText: string;
}) {
  return (
    <div className="pulso-sm-decision-impact" aria-label="Impacto sobre base activa">
      <div className="pulso-sm-decision-impact-copy">
        <strong>Si reemplazas la base activa</strong>
        <span>{impactText}</span>
      </div>
      <dl>
        <div>
          <dt>Ahora</dt>
          <dd>{smDecisionRowsLabel(currentRows)}</dd>
        </div>
        <div>
          <dt>Recalculada</dt>
          <dd>{smDecisionRowsLabel(previewRows)}</dd>
        </div>
        <div className={smDecisionRowsDeltaTone(currentRows, previewRows)}>
          <dt>Cambio</dt>
          <dd>{smDecisionRowsDeltaLabel(currentRows, previewRows)}</dd>
        </div>
      </dl>
      <small>Guardar solo revisión no cambia filas. Reemplazar reconstruye esta base completa con las fuentes y reglas visibles.</small>
    </div>
  );
}

function SmDecisionCaseAudit({
  audit,
  policy,
  disabled,
  onPolicyPatch,
}: {
  audit: SurveyMonkeyDecisionAudit | null;
  policy: SurveyMonkeyDecisionPolicy;
  disabled: boolean;
  onPolicyPatch: (patch: Partial<SurveyMonkeyDecisionPolicy>) => void;
}) {
  const [observedOnly, setObservedOnly] = useState(true);
  const [nearCompleteOnly, setNearCompleteOnly] = useState(false);
  const [collectorFilter, setCollectorFilter] = useState("");
  const [query, setQuery] = useState("");
  const rows = smDecisionCaseRows(audit);
  const manualSet = new Set((policy.manual_include_case_uids ?? []).map(String).filter(Boolean));
  const collectors = Array.from(rows.reduce((map, row) => {
    const id = String(row.collector_id || "").trim();
    if (!id) return map;
    const entry = map.get(id) ?? { id, label: row.collector_label || "Recopilador sin nombre", total: 0, observed: 0 };
    entry.total += 1;
    if (row.observado === true) entry.observed += 1;
    map.set(id, entry);
    return map;
  }, new Map<string, { id: string; label: string; total: number; observed: number }>()).values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
  const observedTotal = rows.filter((row) => row.observado === true).length;
  const nearCompleteTotal = rows.filter((row) => row.nearComplete === true).length;
  const manualTotal = manualSet.size;
  function matchesQuery(row: SmDecisionCaseRow) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      row.campania,
      row.collector_id,
      row.collector_label,
      row.case_uid,
      row.survey_id,
      row.response_id,
      row.custom_id,
      row.estado,
      row.decision,
      row.motivo,
    ].join(" ").toLowerCase();
    return q.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
  }
  const filtered = rows.filter((row) => {
    if (collectorFilter && row.collector_id !== collectorFilter) return false;
    if (observedOnly && row.observado !== true) return false;
    if (nearCompleteOnly && row.nearComplete !== true) return false;
    if (!matchesQuery(row)) return false;
    return true;
  });
  const visible = filtered.slice(0, 120);
  if (!rows.length) return null;
  function toggleManualInclude(caseUid: string, include: boolean) {
    const cleanCaseUid = String(caseUid || "").trim();
    if (!cleanCaseUid) return;
    const current = (policy.manual_include_case_uids ?? []).map(String).filter(Boolean);
    const next = include
      ? Array.from(new Set([...current, cleanCaseUid]))
      : current.filter((item) => item !== cleanCaseUid);
    onPolicyPatch({ manual_include_case_uids: next });
  }
  const emptyCopy = observedOnly
    ? collectorFilter
      ? "Este recopilador no tiene casos observados con la configuración actual."
      : "No hay casos observados con la configuración actual."
    : "No hay casos para el filtro seleccionado.";
  return (
    <details className="pulso-sm-case-audit" open>
      <summary>
        <span>
          <Search size={12} />
          Casos para revisar
        </span>
        <em>
          {observedTotal} observado{observedTotal === 1 ? "" : "s"}
          {nearCompleteTotal > 0 ? `, ${nearCompleteTotal} casi completa${nearCompleteTotal === 1 ? "" : "s"}` : ""}
          {manualTotal > 0 ? `, ${manualTotal} rescate${manualTotal === 1 ? "" : "s"}` : ""}
        </em>
      </summary>
      <div className="pulso-sm-case-filters">
        <label className="pulso-sm-filter-toggle">
          <Switch
            className="pulso-carga-switch"
            checked={observedOnly}
            onToggle={() => setObservedOnly(!observedOnly)}
            ariaLabel="Mostrar solo casos observados"
          />
          <span>Solo observados</span>
          <small>{observedTotal}</small>
        </label>
        <label className="pulso-sm-filter-toggle">
          <Switch
            className="pulso-carga-switch"
            checked={nearCompleteOnly}
            onToggle={() => setNearCompleteOnly(!nearCompleteOnly)}
            ariaLabel="Mostrar solo respuestas casi completas"
          />
          <span>Casi completas</span>
          <small>{nearCompleteTotal}</small>
        </label>
        <select
          value={collectorFilter}
          onChange={(event) => setCollectorFilter(event.target.value)}
          aria-label="Filtrar casos por recopilador"
        >
          <option value="">Todos los recopiladores</option>
          {collectors.map((collector) => (
            <option key={collector.id} value={collector.id}>
              {collector.label}, {collector.observed} obs., {collector.total} casos
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={smTextShortcutGuard}
          placeholder="Buscar por respuesta, llave de cruce o ID enlace"
          aria-label="Buscar caso SurveyMonkey"
        />
        <strong>{visible.length}/{filtered.length} visibles</strong>
      </div>
      {visible.length ? (
        <div className="pulso-sm-case-audit-table" role="table" aria-label="Casos SurveyMonkey para revisar">
          <div className="pulso-sm-case-audit-head" role="row">
            <span role="columnheader">Campaña</span>
            <span role="columnheader">Recopilador</span>
            <span role="columnheader">Respuesta</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" title="Obligatorias aplicables respondidas / obligatorias aplicables totales">Avance</span>
            <span role="columnheader">Resultado</span>
            <span role="columnheader">Acción</span>
            <span role="columnheader">Motivo</span>
          </div>
          {visible.map((row, index) => (
            <div
              className={`pulso-sm-case-row${row.observado === true ? " is-observed" : ""}${row.incluido === "1" ? " is-included" : ""}`}
              role="row"
              key={`${row.campania}-${row.case_uid || row.response_id}-${index}`}
            >
              <div className="pulso-sm-case-cell" role="cell" title={row.campania}>{row.campania || "Fuente"}</div>
              <div className="pulso-sm-case-cell" role="cell">{row.collector_label || "Recopilador sin nombre"}</div>
              <div className="pulso-sm-case-cell pulso-sm-case-ids" role="cell">
                <strong title={`Respuesta SurveyMonkey ${row.response_id || "-"}`}>Respuesta {row.response_id || "-"}</strong>
                {row.custom_id ? (
                  <small title="ID del enlace personalizado">ID enlace {row.custom_id}</small>
                ) : (
                  <small>Sin ID enlace</small>
                )}
              </div>
              <div className="pulso-sm-case-cell" role="cell">{row.estado || "-"}</div>
              <div className="pulso-sm-case-cell is-numeric" role="cell">
                <SmDecisionCompletionCell row={row} />
              </div>
              <div className={`pulso-sm-case-cell is-result${row.incluido === "1" ? " is-included" : ""}`} role="cell">
                {smDecisionCaseDecisionLabel(String(row.decision || ""))}
              </div>
              <div className="pulso-sm-case-cell" role="cell">
                {(() => {
                  const manuallyIncluded = row.manual || (!!row.case_uid && manualSet.has(row.case_uid));
                  const included = row.incluido === "1";
                  if (!row.case_uid) {
                    return <span className="pulso-sm-case-action-note">Sin llave</span>;
                  }
                  if (manuallyIncluded) {
                    return (
                      <button
                        type="button"
                        className="pulso-sm-case-action is-remove"
                        disabled={disabled}
                        onClick={() => toggleManualInclude(row.case_uid, false)}
                      >
                        Quitar rescate
                      </button>
                    );
                  }
                  if (included) {
                    return <span className="pulso-sm-case-action-note is-included">Incluida</span>;
                  }
                  return (
                    <button
                      type="button"
                      className="pulso-sm-case-action"
                      disabled={disabled}
                      onClick={() => toggleManualInclude(row.case_uid, true)}
                    >
                      Incluir caso
                    </button>
                  );
                })()}
              </div>
              <div className={`pulso-sm-case-cell pulso-sm-case-review ${row.observado === true ? "is-observed" : "is-normal"}`} role="cell">
                <div className="pulso-sm-case-review-main">
                  {row.nearComplete && <EstadoChip label="Casi completa" tone="info" />}
                  <span>{row.observado === true ? row.motivo || "Requiere revisión" : "Sin observación"}</span>
                </div>
                {smDecisionDuplicateEvidenceLine(row) && (
                  <div className="pulso-sm-case-evidence">
                    <strong>Posible duplicado</strong>
                    <span>{smDecisionDuplicateEvidenceLine(row)}</span>
                    <span className={`pulso-sm-case-evidence-chip ${smDecisionCompareTone(row.duplicateCodeMatch)}`}>
                      Código Pulso: {smDecisionCompareLabel(row.duplicateCodeMatch)}
                    </span>
                    <span className={`pulso-sm-case-evidence-chip ${smDecisionCompareTone(row.duplicateCareerMatch)}`}>
                      Carrera: {smDecisionCompareLabel(row.duplicateCareerMatch)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
      ) : (
        <EstadoVacio icono={<Search size={13} />} titulo={emptyCopy} />
      )}
      {smDecisionNumber(audit?.case_rows_omitted) > 0 && (
        <p>{smDecisionNumber(audit?.case_rows_omitted)} casos adicionales quedan fuera de esta vista rápida.</p>
      )}
    </details>
  );
}

export function SmDecisionSuite({
  base,
  disabled,
  onApplied,
  onRegenerateRaw,
}: {
  base: EstudioBase;
  disabled: boolean;
  onApplied: (payload: EstudioPayload) => Promise<void>;
  onRegenerateRaw?: (base: EstudioBase) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [savedPolicy, setSavedPolicy] = useState<SurveyMonkeyDecisionPolicy>(() => smDecisionInitialPolicy(base));
  const [policy, setPolicy] = useState<SurveyMonkeyDecisionPolicy>(() => smDecisionInitialPolicy(base));
  const [audit, setAudit] = useState<SurveyMonkeyDecisionAudit | null>(base.surveymonkey_decision_audit ?? null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const previewRequestSeq = useRef(0);
  const hasRaw = !!String(base.surveymonkey_raw_snapshot_file_id || "").trim();
  const options = smConsentOptions(base);
  const variableOptions = smDecisionVariableOptions(base);
  const adapted = base.status?.codificacion_adaptada === true;
  const downstreamLabels = smDecisionDownstreamLabels(base);
  const hasDownstreamProgress = downstreamLabels.length > 0;
  const collectorOptions = smDecisionCollectorOptions(audit);
  const duplicateOptions = smDecisionDuplicateOptions(base, variableOptions);
  const explicitCollectorIds = policy.collector_ids ?? [];
  const validCollectorIds = smDecisionValidCollectorIds(collectorOptions);
  const testCollectorCount = collectorOptions.length - validCollectorIds.length;
  const selectedCollectorIds = (explicitCollectorIds.length ? explicitCollectorIds : validCollectorIds)
    .filter((collectorId) => validCollectorIds.includes(collectorId));
  const selectedCollectorSet = new Set(selectedCollectorIds);
  const auditReady = smDecisionAuditReady(audit);
  const savedPolicyFingerprint = smDecisionPolicyFingerprint(savedPolicy);
  const pendingPolicyFingerprint = smDecisionPolicyFingerprint(policy);
  const hasPendingPolicyChanges = pendingPolicyFingerprint !== savedPolicyFingerprint;

  useEffect(() => {
    const nextSaved = smDecisionInitialPolicy(base);
    setSavedPolicy(nextSaved);
    setPolicy(nextSaved);
    setAudit(base.surveymonkey_decision_audit ?? null);
    setSavedNote("");
    previewRequestSeq.current += 1;
  }, [base.nombre, base.surveymonkey_decision_policy]);

  useEffect(() => {
    if (!open || !hasRaw) return;
    const handle = window.setTimeout(() => {
      void loadPreview(policy, true);
    }, 360);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasRaw, pendingPolicyFingerprint]);

  async function loadPreview(nextPolicy = policy, quiet = false) {
    if (!hasRaw) return;
    const requestId = previewRequestSeq.current + 1;
    previewRequestSeq.current = requestId;
    const previewBusyLabel = "Calculando impacto...";
    setError("");
    if (!quiet) setBusy(previewBusyLabel);
    try {
      const result = await apiSurveyMonkeyMultibaseDecisionPreview({
        base_name: base.nombre,
        policy: nextPolicy,
      });
      if (requestId !== previewRequestSeq.current) return;
      setAudit(result.audit);
    } catch (e) {
      if (requestId !== previewRequestSeq.current) return;
      setError((e as Error).message);
    } finally {
      if (requestId === previewRequestSeq.current) {
        setBusy((currentBusy) => (!quiet || currentBusy === previewBusyLabel ? "" : currentBusy));
      }
    }
  }

  async function saveReview() {
    if (!hasRaw) return;
    previewRequestSeq.current += 1;
    const nextPolicy = smDecisionPolicyForSurveyMonkeyCommit(policy, collectorOptions);
    setError("");
    setSavedNote("");
    setBusy("Guardando revisión...");
    try {
      const result = await apiSurveyMonkeyMultibaseDecisionApply({
        base_name: base.nombre,
        policy: nextPolicy,
        regenerate_data: false,
        force_replace_adapted: false,
      });
      setSavedPolicy(result.policy);
      setPolicy(result.policy);
      setAudit(result.audit);
      setSavedNote("Revisión guardada. La base activa no cambió.");
      await onApplied(result.estudio);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function applyToActiveBase() {
    if (!hasRaw) return;
    previewRequestSeq.current += 1;
    const nextPolicy = smDecisionPolicyForSurveyMonkeyCommit(policy, collectorOptions);
    setError("");
    setSavedNote("");
    setBusy("Aplicando a base efectiva...");
    try {
      const result = await apiSurveyMonkeyMultibaseDecisionApply({
        base_name: base.nombre,
        policy: nextPolicy,
        regenerate_data: true,
        force_replace_adapted: true,
      });
      setSavedPolicy(result.policy);
      setPolicy(result.policy);
      setAudit(result.audit);
      setSavedNote(result.replaced_active
        ? "Base efectiva actualizada con las fuentes seleccionadas."
        : "Revisión aplicada; no se reemplazó la base activa.");
      await onApplied(result.estudio);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function regenerateRawSnapshot() {
    if (!onRegenerateRaw) return;
    previewRequestSeq.current += 1;
    setError("");
    setSavedNote("");
    setBusy("Regenerando respaldo...");
    try {
      await onRegenerateRaw(base);
      setSavedNote("Respaldo SurveyMonkey regenerado. Ya se pueden recalcular las reglas.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function updatePolicy(patch: Partial<SurveyMonkeyDecisionPolicy>) {
    setSavedNote("");
    setPolicy((current) => ({ ...current, ...patch, edited: true }));
  }

  function discardPendingPolicy() {
    setError("");
    setSavedNote("Cambios pendientes descartados; vuelve la configuración guardada.");
    setPolicy(savedPolicy);
  }

  function toggleCollector(id: string, checked: boolean) {
    const collector = collectorOptions.find((item) => item.id === id);
    if (collector && smDecisionCollectorIsTest(collector)) return;
    const current = policy.collector_ids?.length ? policy.collector_ids : validCollectorIds;
    const next = checked
      ? Array.from(new Set([...current, id]))
      : current.filter((collectorId) => collectorId !== id);
    if (!next.length) return;
    updatePolicy({ collector_ids: next });
  }

  function selectValidCollectors() {
    if (!validCollectorIds.length) return;
    updatePolicy({ collector_ids: validCollectorIds });
  }

  const edited = hasPendingPolicyChanges || policy.edited || !!base.surveymonkey_decision_updated_at;
  const rejectionValuesText = smDecisionValuesToText(policy.rejection_values);
  const duplicateKey = policy.duplicate_key_vars?.[0] || "";
  const sourceCount = auditReady ? audit?.sources?.length ?? 0 : smSourceSummariesFromBase(base).length;
  const baseSurveyTitle = String(base.source_title || smSourceSummariesFromBase(base)[0]?.title || base.nombre || "").trim();
  const currentActiveRows = smDecisionOptionalNumber(base.n_filas);
  const previewIncludedRows = auditReady ? smDecisionOptionalNumber(audit?.included) : null;
  const replacementImpactText = smDecisionRowsImpactText(currentActiveRows, previewIncludedRows);

  return (
    <details
      className="pulso-sm-decision-suite"
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (nextOpen && hasRaw && !smDecisionAuditReady(audit)) void loadPreview(policy);
      }}
    >
      <summary>
        <SlidersHorizontal size={12} />
        <span>Revisión SurveyMonkey</span>
        <em>{hasRaw ? hasPendingPolicyChanges ? "cambios pendientes" : edited ? "configuración guardada" : "datos descargados" : "requiere descarga"}</em>
      </summary>
      {!hasRaw ? (
        <EstadoVacio
          icono={<AlertTriangle size={14} />}
          titulo="Esta base no tiene respaldo de respuestas descargadas"
          descripcion="Regenera desde SurveyMonkey para recalcular reglas."
          accion={onRegenerateRaw ? (
            <button
              type="button"
              className="pulso-sm-secondary"
              disabled={disabled || !!busy}
              onClick={() => void regenerateRawSnapshot()}
            >
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <RefreshCw size={12} />}
              Regenerar respaldo
            </button>
          ) : undefined}
        />
      ) : (
        <div className="pulso-sm-decision-panel">
          <div className="pulso-sm-decision-context">
            <strong title={baseSurveyTitle}>{baseSurveyTitle || "Base SurveyMonkey"}</strong>
            <span>
              {sourceCount || 1} campaña{(sourceCount || 1) === 1 ? "" : "s"}, {selectedCollectorIds.length} recopilador{selectedCollectorIds.length === 1 ? "" : "es"} entra{selectedCollectorIds.length === 1 ? "" : "n"}, {hasPendingPolicyChanges ? "cambios pendientes" : "configuración guardada"}
            </span>
          </div>
          <SmDecisionSignature audit={auditReady ? audit : null} />
          <SmDecisionSourceAuditTable audit={auditReady ? audit : null} />
          {collectorOptions.length > 0 && (
            <div className="pulso-sm-collector-picks" aria-label="Recopiladores SurveyMonkey">
              <div className="pulso-sm-collector-picks-head">
                <div>
                  <span>Fuentes que entran al conteo</span>
                  <em>
                    {selectedCollectorIds.length} entra{selectedCollectorIds.length === 1 ? "" : "n"}
                    {testCollectorCount > 0 ? `, ${testCollectorCount} prueba bloqueada${testCollectorCount === 1 ? "" : "s"}` : ""}
                  </em>
                  <small>Incluye las fuentes válidas disponibles. Los recopiladores de prueba quedan fuera.</small>
                </div>
                <button type="button" className="pulso-sm-secondary" disabled={disabled || !!busy || !validCollectorIds.length} onClick={selectValidCollectors}>
                  Usar fuentes válidas
                </button>
              </div>
              <div className="pulso-sm-collector-picks-grid">
                {collectorOptions.map((collector) => (
                  (() => {
                    const isTest = smDecisionCollectorIsTest(collector);
                    const isSelected = selectedCollectorSet.has(collector.id);
                    const savedCollectorIds = savedPolicy.collector_ids?.length
                      ? savedPolicy.collector_ids
                      : validCollectorIds;
                    const changedFromSaved = !isTest && savedCollectorIds.includes(collector.id) !== isSelected;
                    const stateLabel = smDecisionCollectorStateLabel(collector, isSelected);
                    return (
                      <label key={collector.id} className={`${isTest ? "is-excluded" : ""}${!isTest && isSelected ? " is-selected" : ""}${changedFromSaved ? " is-pending" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled || !!busy || isTest}
                          onChange={(event) => toggleCollector(collector.id, event.target.checked)}
                        />
                        <span>
                          <b>{smCollectorFriendlyName(collector.label, collector.id)}</b>
                          <small>
                            {isTest
                              ? "Recopilador de prueba"
                              : `${collector.count} respuestas descargadas${collector.source ? `, ${collector.source}` : ""}${changedFromSaved ? ", cambio pendiente" : ""}`}
                          </small>
                        </span>
                        <em className={smDecisionCollectorStateClass(stateLabel)}>{stateLabel}</em>
                      </label>
                    );
                  })()
                ))}
              </div>
            </div>
          )}
          <div className="pulso-sm-rule-board" aria-label="Reglas para contar respuestas efectivas">
            <section className="pulso-sm-rule-section">
              <div className="pulso-sm-rule-section-head">
                <strong>Cómo se cuenta una efectiva</strong>
                <span>Consentimiento, parciales y mínimo de avance.</span>
              </div>
              <div className="pulso-sm-decision-controls">
                <label className="is-wide">
                  <span>Pregunta de consentimiento</span>
                  <select
                    value={policy.consent_var || ""}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({
                      consent_var: event.target.value,
                      rejection_var: policy.rejection_var || event.target.value,
                    })}
                  >
                    <option value="">No aplicar consentimiento</option>
                    {variableOptions.map((option) => (
                      <option key={option.name} value={option.name}>
                        {smDecisionQuestionOptionLabel(option, 70)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="is-check">
                  <Switch
                    className="pulso-carga-switch"
                    checked={policy.include_partials === true}
                    disabled={disabled || !!busy}
                    onToggle={() => updatePolicy({ include_partials: policy.include_partials !== true })}
                    ariaLabel="Rescatar parciales con avance suficiente"
                  />
                  <span>Rescatar parciales con avance suficiente</span>
                </label>
                <label>
                  <span>Mínimo para rescatar parcial</span>
                  <input
                    type="number"
                    min={10}
                    value={Math.max(10, Number(policy.partial_min_answers ?? 15) || 15)}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ partial_min_answers: Math.max(10, Number(event.target.value) || 10) })}
                  />
                </label>
              </div>
            </section>

            <details className="pulso-sm-rule-section pulso-sm-rule-advanced">
              <summary>
                <span>Duplicados y rechazos</span>
                <em>Abrir opciones avanzadas</em>
              </summary>
              <div className="pulso-sm-decision-controls">
                <label>
                  <span>Llave para detectar repetidos</span>
                  <select
                    value={duplicateKey}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ duplicate_key_vars: event.target.value ? [event.target.value] : [] })}
                  >
                    <option value="">No detectar repetidos</option>
                    {duplicateOptions.map((option) => (
                      <option key={option.name} value={option.name}>
                        {smDecisionDuplicateOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Respuesta conservada</span>
                  <select
                    value={policy.duplicate_keep || "first"}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ duplicate_keep: event.target.value })}
                  >
                    <option value="first">La primera respuesta</option>
                    <option value="latest">La respuesta más reciente</option>
                    <option value="most_answered">La más completa</option>
                  </select>
                </label>
                <label className="is-check">
                  <Switch
                    className="pulso-carga-switch"
                    checked={policy.include_duplicates !== false}
                    disabled={disabled || !!busy}
                    onToggle={() => updatePolicy({ include_duplicates: policy.include_duplicates === false })}
                    ariaLabel="Permitir repetidos en la base"
                  />
                  <span>Permitir repetidos en la base</span>
                </label>
                <label>
                  <span>Pregunta donde se rechaza</span>
                  <select
                    value={policy.rejection_var || ""}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ rejection_var: event.target.value })}
                  >
                    <option value="">No aplicar rechazo</option>
                    {options.map((option) => (
                      <option key={option.name} value={option.name}>
                        {smDecisionQuestionOptionLabel(option, 62)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Respuestas tratadas como rechazo</span>
                  <input
                    value={rejectionValuesText}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ rejection_values: smDecisionTextToValues(event.target.value) })}
                    onKeyDown={smTextShortcutGuard}
                  />
                </label>
                <label className="is-check">
                  <Switch
                    className="pulso-carga-switch"
                    checked={policy.include_rejections === true}
                    disabled={disabled || !!busy}
                    onToggle={() => updatePolicy({ include_rejections: policy.include_rejections !== true })}
                    ariaLabel="Permitir rechazos en la base"
                  />
                  <span>Permitir rechazos en la base</span>
                </label>
              </div>
            </details>
          </div>
          <SmDecisionImpactCard
            currentRows={currentActiveRows}
            previewRows={previewIncludedRows}
            impactText={replacementImpactText}
          />
          {adapted && (
            <div className="pulso-sm-decision-warning">
              <AlertTriangle size={13} />
              <span>
                Esta base ya tiene codificación. Guardar solo revisión deja la decisión auditada sin tocar datos; reemplazar la base activa puede requerir revisar los pasos posteriores.
              </span>
            </div>
          )}
          {hasDownstreamProgress && (
            <div className="pulso-sm-decision-warning">
              <AlertTriangle size={13} />
              <span>
                Ya hay avance en {downstreamLabels.join(", ")}. Si reemplazas la base activa, esos módulos quedan trabajando sobre la base recalculada.
              </span>
            </div>
          )}
          <SmDecisionCaseAudit
            audit={auditReady ? audit : null}
            policy={policy}
            disabled={disabled || !!busy}
            onPolicyPatch={updatePolicy}
          />
          {error && <ErrorBlock label="No se pudo calcular la suite" detail={error} />}
          {savedNote && (
            <div className="pulso-sm-decision-ok">
              <CheckCircle2 size={13} />
              <span>{savedNote}</span>
            </div>
          )}
          <div className="pulso-sm-decision-actions">
            <button type="button" className="pulso-sm-secondary" disabled={disabled || !!busy} onClick={() => void loadPreview(policy)}>
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <RefreshCw size={12} />}
              Recalcular
            </button>
            <button type="button" className="pulso-sm-secondary" disabled={disabled || !!busy} onClick={() => void saveReview()}>
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <Check size={12} />}
              Guardar solo revisión
            </button>
            <button
              type="button"
              className="pulso-sm-secondary"
              disabled={disabled || !!busy || !hasPendingPolicyChanges}
              onClick={discardPendingPolicy}
            >
              <XIcon size={12} />
              Descartar cambios
            </button>
            <button
              type="button"
              className="pulso-sm-decision-primary"
              disabled={disabled || !!busy || !validCollectorIds.length}
              title="Reconstruye y reemplaza completa la base activa con estas fuentes y reglas; no agrega encima."
              onClick={() => void applyToActiveBase()}
            >
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <CheckCircle2 size={12} />}
              Reemplazar base activa
            </button>
          </div>
        </div>
      )}
    </details>
  );
}

