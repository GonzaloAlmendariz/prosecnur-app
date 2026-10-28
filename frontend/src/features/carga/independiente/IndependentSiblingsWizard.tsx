// Asistente de fuentes independientes de Carga (SurveyMonkey/Kobo): cada encuesta como su propia base.
// Sale de BasesPanel.tsx en L6 (2026-10-28) sin cambio de comportamiento; el stepper llega en el paso 4.

import { useEffect, useMemo, useState } from "react";
import { BotonConfigurarCredenciales } from "../BotonConfigurarCredenciales";
import { AlertTriangle, Check, CheckCircle2, Cloud, Database, FileSpreadsheet, Filter, GitMerge, Layers, Loader2, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Pencil, X as XIcon } from "lucide-react";
import { apiCargaImportKoboIndependentAsync, apiCargaRefreshKoboIndependentAsync, apiConnectionTokenLoad, apiEstudioApplyIndependentTemplateLogic, apiEstudioProcessingSuggestions, apiEstudioPromoteIndependentSiblings, apiEstudioUpdateBaseMetadata, apiSurveyMonkeyMultibaseAudit, apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic, apiSurveyMonkeyMultibaseCollectors, apiSurveyMonkeyMultibaseImportIndependentAsync, apiSurveyMonkeyMultibaseListSurveys, apiSurveyMonkeyMultibaseRefreshAsync, apiSurveyMonkeyMultibaseRefreshPlan, apiSurveyMonkeyMultibaseWorkbookImport, apiSurveyMonkeyMultibaseWorkbookInspect, apiXlsformEditorSmInterpretRule, apiUpload, uploadKindForDataFile } from "../../../api/client";
import type { ConnectionTokenState, EstudioBase, EstudioLogicSyncResult, EstudioPayload, EstudioProcessingSuggestionGroup, EstudioProcessingSuggestions, KoboIndependentImportResult, KoboIndependentRefreshResult, KoboIndependentAssetInput, SurveyMonkeyMultibaseSurveyInput, SurveyMonkeyMultibaseAudit, SurveyMonkeyMultibaseCollector, SurveyMonkeyMultibaseImportIndependentResult, SurveyMonkeyMultibaseListItem, SurveyMonkeyRefreshBasePlan, SurveyMonkeyRefreshPlan, SurveyMonkeyRefreshResult, SurveyMonkeyWorkbookImportResult, SurveyMonkeyWorkbookInspection } from "../../../api/client";
import { ErrorBlock } from "../../../components/States";
import { esperarResultadoImport, textoDeProgresoImport } from "../importEnSegundoPlano";
import { SavBundleImportPanel } from "../SavBundleImportPanel";
import { useCargaStore } from "../store";
import { SmEstructuraFuenteAccion } from "../SmEstructuraFuenteAccion";
import { smDiffKindLabel, smDiffSeverityLabel, smRefreshAction, smRefreshStructureDetail } from "../smEstructuraFuente";
import type { SmExtraSourceDraft, SmImportScopeDraft, SmImportScopeFields } from "../store";
import { SM_DEFAULT_BASE_URL, independentSiblingsCapacity, independentSiblingsCapacityLabel, koboAssetIdsFromBase, koboMonitoringSuggestionCanImport, koboMonitoringSuggestionInput, koboMonitoringSuggestionPrimarySource, smAliasDraftValue, smBaseChannel, smBaseChannelDetail, smBaseConsentVar, smBaseHasMixedChannels, smBaseSlug, smBestExistingBaseTarget, smCatalogDateLabel, smChannelIcon, smChannelKey, smChannelLabel, smChannelOptions, smClipboardGuard, smCollectorCacheKey, smCollectorCatalogCache, smCollectorDisplayName, smCollectorResponseLabel, smCollectorTypeLabel, smConsentFilterInfo, smConsentOptions, smDateLabel, smDefaultScopeDraft, smDefaultScopeFields, smDuplicateSurveyAlert, smExistingBaseTargetLabel, smExtraSourceCandidates, smIndependentBaseTitle, smIndependentSurveyInput, smIndependentTemplateBase, smKnownSourceCount, smLogicPreviewRow, smMergeSuggestionCatalog, smMonitoringSuggestionCanImport, smMonitoringSuggestionPrimarySource, smMonitoringSuggestionScope, smNewScopeKey, smNumberRangeLabel, smRefreshIsNoop, smRefreshResultSourcesText, smRefreshRowStatusText, smRefreshSourcesText, smScopeSummary, smScopeValueFromCollectorIds, smSelectedCampaignInputs, smShortQuestionLabel, smSourceCollectorLabel, smSourceCountLabel, smSourceMetricLabel, smSourceSummariesFromBase, smSourceSummariesFromSpec, smSpecCollectorSummary, smSpecDraftFromBase, smSpecSources, smSpecWithConsentVar, smSpecWithPrimaryChannel, smSpecWithSourceCollectors, smSplitScopeList, smStringList, smSuggestedSurveyMonkeyLogicRulesFromMonitoring, smSuggestionResponseLabel, smSurveyAlias, smSurveyAuditLabel, smSurveyById, smSurveyCatalogAvailability, smSurveyDefaultAlias, smSurveyDefaultChannel, smSurveyIdsFromBase, smSurveyMonkeyLogicPreviewEntries, smSurveyMonkeyLogicPreviewNeedsReview, smSurveyResponseLabel, smSurveySpecificLogicRulesBySurvey, smSurveyTitle, smTextShortcutGuard, smToggleCollectorId, smWorkbookInspectionCanImport, smWorkbookInspectionCellErrorCount, smWorkbookInspectionWarningCount, smWorkbookMissingLabel, smWorkbookSheetIssueLabel, smWorkbookSheetIssueTitle } from "../surveymonkey/smBasesModel";
import type { SmLogicPreviewEntry, SmLogicPreviewRow, SmSourceSummary } from "../surveymonkey/smBasesModel";
import { SmDecisionSuite } from "./SmDecisionSuite";
import { FilePicker } from "../BasesFilePicker";

type SmCanonicalOption = {
  fileId: string;
  label: string;
};

function SmChannelBadge({ channel }: { channel: string }) {
  const label = smChannelLabel(channel) || "Sin canal";
  const key = smChannelKey(label);
  const Icon = smChannelIcon(key);
  return (
    <span className={`pulso-sm-channel-badge is-${key || "unset"}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function SmChannelSelect({
  value,
  disabled,
  onChange,
  label = "Canal",
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  label?: string;
}) {
  const displayValue = smChannelLabel(value);
  const key = smChannelKey(displayValue);
  const Icon = smChannelIcon(key);
  return (
    <label className="pulso-sm-channel-select">
      <span>{label}</span>
      <div className={`pulso-sm-channel-select-control is-${key || "unset"}`}>
        <Icon size={14} />
        <select value={displayValue} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Definir canal</option>
          {smChannelOptions(displayValue).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SmConsentSelect({
  base,
  disabled,
  onChange,
  compact = false,
}: {
  base: EstudioBase;
  disabled?: boolean;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const value = smBaseConsentVar(base);
  const options = smConsentOptions(base);
  const filter = smConsentFilterInfo(base);
  return (
    <label className="pulso-sm-channel-select pulso-sm-consent-select">
      <span>Filtro de registros válidos</span>
      <div className="pulso-sm-channel-select-control is-consent">
        <Filter size={14} />
        <select
          value={value}
          disabled={disabled || !options.length}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Variable de consentimiento para ${base.nombre}`}
        >
          <option value="">Sin definir</option>
          {options.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}{option.label ? ` · ${smShortQuestionLabel(option.label)}` : ""}
            </option>
          ))}
        </select>
      </div>
      {!compact ? (
        <div className="pulso-sm-consent-summary">
          <strong>{filter.value || "Sin definir"}</strong>
          {filter.label ? <span>{filter.label}</span> : null}
          <em>
            {filter.value
              ? `Aprueba: ${filter.approved.map((choice) => (
                choice.name && choice.label ? `${choice.name} · ${choice.label}` : choice.label || choice.name
              )).join(", ")}`
              : "Selecciona una variable select_one"}
          </em>
        </div>
      ) : null}
    </label>
  );
}

function SmSourceSummaryBlock({ sources }: { sources: SmSourceSummary[] }) {
  const rows = sources.length ? sources : [];
  if (!rows.length) return null;
  return (
    <div className="pulso-sm-source-table" role="table" aria-label="Fuentes y campañas SurveyMonkey conectadas">
      <div className="pulso-sm-source-table-head" role="row">
        <span>Campaña/encuesta</span>
        <span>Canal</span>
        <span>Descargadas</span>
        <span>Efectivas</span>
        <span>Incluidas</span>
        <span>Excluidas</span>
        <span>Filtros</span>
      </div>
      {rows.map((source, index) => (
        <div key={`${source.surveyId || source.title}-${index}`} className="pulso-sm-source-table-row" role="row">
          <div className="pulso-sm-source-title-cell">
            <strong title={source.title}>{source.title}</strong>
            <small>
              {source.surveyId ? `Survey ID ${source.surveyId}` : "SurveyMonkey"}
              {source.consentVar ? ` · filtro ${source.consentVar}` : ""}
            </small>
          </div>
          <span>{source.channel ? <SmChannelBadge channel={source.channel} /> : "S/D"}</span>
          <span>{smSourceMetricLabel(source.rawRecords ?? source.originalRecords)}</span>
          <span>{smSourceMetricLabel(source.effectiveRecords ?? source.validRecords)}</span>
          <span>{smSourceMetricLabel(source.includedRecords ?? source.validRecords)}</span>
          <span>{smSourceMetricLabel(source.excludedRecords)}</span>
          <span title={source.collectorIds.join(", ")}>{smSourceCollectorLabel(source)}</span>
        </div>
      ))}
    </div>
  );
}

function MonitoringProcessingSuggestionsCard({
  suggestions,
  status,
  disabled,
  importableGroups,
  importableKoboGroups,
  preparedGroups,
  onRefresh,
  onApplyGroup,
  onApplyAll,
  onImportKoboGroup,
  onImportAllKobo,
}: {
  suggestions: EstudioProcessingSuggestions | null;
  status: string;
  disabled: boolean;
  importableGroups: EstudioProcessingSuggestionGroup[];
  importableKoboGroups: EstudioProcessingSuggestionGroup[];
  preparedGroups: EstudioProcessingSuggestionGroup[];
  onRefresh: () => void;
  onApplyGroup: (group: EstudioProcessingSuggestionGroup) => void;
  onApplyAll: () => void;
  onImportKoboGroup: (group: EstudioProcessingSuggestionGroup) => void;
  onImportAllKobo: () => void;
}) {
  const groups = suggestions?.groups ?? [];
  const shouldShow = Boolean(status || suggestions?.has_suggestions || suggestions?.profile_family === "acreditacion");
  if (!shouldShow) return null;
  const importableIds = new Set(importableGroups.map((group) => group.id));
  const importableKoboIds = new Set(importableKoboGroups.map((group) => group.id));
  const preparedIds = new Set(preparedGroups.map((group) => group.id));
  const hasSurveyMonkeyGroups = groups.some((group) => group.platform === "surveymonkey");
  const hasKoboGroups = groups.some((group) => group.platform === "kobo");
  return (
    <div className="pulso-monitoring-suggestions" aria-label="Sugerencias desde Monitoreo para Procesamiento">
      <div className="pulso-monitoring-suggestions-head">
        <span className="pulso-monitoring-suggestions-icon" aria-hidden="true">
          {status ? <Loader2 size={15} className="pulso-spin" /> : <GitMerge size={15} />}
        </span>
        <div>
          <strong>Monitoreo detectó un procesamiento de acreditación</strong>
          <span>
            {status || suggestions?.message || "Fuentes listas para organizar por actor."}
          </span>
        </div>
        <div className="pulso-monitoring-suggestions-actions">
          <button type="button" className="pulso-sm-secondary" onClick={onRefresh} disabled={disabled}>
            <RefreshCw size={13} />
            Revisar
          </button>
          {hasSurveyMonkeyGroups && (
            <button type="button" onClick={onApplyAll} disabled={disabled || !importableGroups.length}>
              <Layers size={13} />
              Preparar SurveyMonkey
            </button>
          )}
          {hasKoboGroups && (
            <button type="button" className="pulso-sm-secondary" onClick={onImportAllKobo} disabled={disabled || !importableKoboGroups.length}>
              <Cloud size={13} />
              Importar Kobo
            </button>
          )}
        </div>
      </div>
      {suggestions?.warnings?.length ? (
        <div className="pulso-monitoring-suggestions-note">
          <AlertTriangle size={13} />
          <span>{suggestions.warnings[0]}</span>
        </div>
      ) : null}
      {groups.length ? (
        <div className="pulso-monitoring-suggestion-grid" role="list">
          {groups.map((group) => {
            const canImport = importableIds.has(group.id);
            const canImportKobo = importableKoboIds.has(group.id);
            const isPrepared = preparedIds.has(group.id);
            const koboUnavailable = group.platform === "kobo" && !group.importable;
            const koboLoaded = group.platform === "kobo" && group.importable && !canImportKobo;
            const primary = smMonitoringSuggestionPrimarySource(group);
            const koboPrimary = koboMonitoringSuggestionPrimarySource(group);
            const channels = Array.from(new Set(group.sources.map((source) => source.channel).filter(Boolean)));
            return (
              <div className={`pulso-monitoring-suggestion-row${canImport || canImportKobo ? "" : " is-muted"}`} role="listitem" key={group.id}>
                <div className="pulso-monitoring-suggestion-actor">
                  <strong>{group.actor}</strong>
                  <small>{group.platform === "surveymonkey" ? "SurveyMonkey" : "Kobo"} · {group.source_count} fuente{group.source_count === 1 ? "" : "s"}</small>
                </div>
                <div className="pulso-monitoring-suggestion-meta">
                  <span>{smSuggestionResponseLabel(group.response_count)}</span>
                  <span>{channels.length > 1 ? "Canal mixto" : channels[0] || "Canal por definir"}</span>
                  {primary?.survey_id ? <code>ID {primary.survey_id}</code> : koboPrimary?.asset_uid ? <code>Asset {koboPrimary.asset_uid}</code> : <code>{group.import_mode}</code>}
                </div>
                <button
                  type="button"
                  className="pulso-sm-secondary"
                  disabled={disabled || (!canImport && !canImportKobo)}
                  onClick={() => {
                    if (canImportKobo) onImportKoboGroup(group);
                    else onApplyGroup(group);
                  }}
                >
                  {canImport || canImportKobo || isPrepared ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {canImport ? "Usar actor" : canImportKobo ? "Importar Kobo" : isPrepared ? "Preparado" : koboUnavailable ? "Kobo detectado" : koboLoaded ? "Kobo cargado" : "Ya cargado"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pulso-monitoring-suggestions-note">
          <Database size={13} />
          <span>{suggestions?.message || "Sin fuentes activas para sugerir."}</span>
        </div>
      )}
    </div>
  );
}

function SmExistingCollectorsEditor({
  base,
  disabled,
  onSave,
}: {
  base: EstudioBase;
  disabled: boolean;
  onSave: (base: EstudioBase, spec: SurveyMonkeyMultibaseSurveyInput) => Promise<void>;
}) {
  const spec = useMemo(() => smSpecDraftFromBase(base), [
    base.nombre,
    base.surveymonkey_source_spec,
    base.response_filter,
    base.survey_id,
    base.source_alias,
    base.source_title,
    base.source_channel,
    base.consent_var,
  ]);
  const [draft, setDraft] = useState<SurveyMonkeyMultibaseSurveyInput | null>(spec ?? null);

  useEffect(() => {
    setDraft(spec ?? null);
  }, [base.nombre, spec]);

  if (!spec || !draft) return null;
  const sources = smSpecSources(draft);
  const activeFilters = sources.filter((source) => smStringList(source.collector_ids ?? source.collector_id).length > 0).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(spec);

  function updateSource(index: number, collectorIds: string) {
    setDraft((current) => smSpecWithSourceCollectors(current, index, collectorIds));
  }

  return (
    <details className="pulso-sm-existing-collectors">
      <summary>
        <Filter size={12} />
        <span>Recopiladores</span>
        <em>{activeFilters ? `${activeFilters} fuente${activeFilters === 1 ? "" : "s"} filtrada${activeFilters === 1 ? "" : "s"}` : "todos incluidos"}</em>
      </summary>
      <div className="pulso-sm-existing-collector-list">
        {sources.map((source, index) => {
          const title = String(source.source_alias || source.source_title || source.label || source.survey_id || `Fuente ${index + 1}`).trim();
          const surveyId = String(source.survey_id || "").trim();
          return (
            <div className="pulso-sm-existing-collector-source" key={`${surveyId || "source"}-${index}`}>
              <div className="pulso-sm-existing-collector-title">
                <strong>{title || `Fuente ${index + 1}`}</strong>
                {surveyId && <small>Survey ID {surveyId}</small>}
              </div>
              <SmCollectorPicker
                surveyId={surveyId}
                value={smScopeValueFromCollectorIds(source.collector_ids ?? source.collector_id)}
                disabled={disabled}
                label="Recopiladores que entran al refresh"
                onChange={(value) => updateSource(index, value)}
              />
            </div>
          );
        })}
      </div>
      <div className="pulso-sm-existing-collector-actions">
        <button
          type="button"
          className="pulso-sm-secondary"
          disabled={disabled || !dirty}
          onClick={() => void onSave(base, draft)}
        >
          <Check size={12} />
          Guardar recopiladores
        </button>
        <button
          type="button"
          className="pulso-sm-secondary"
          disabled={disabled || !dirty}
          onClick={() => setDraft(spec)}
        >
          <XIcon size={12} />
          Cancelar
        </button>
      </div>
    </details>
  );
}

function SmCollectorPicker({
  surveyId,
  profileId = "",
  value,
  disabled,
  onChange,
  label = "Recopiladores incluidos",
}: {
  surveyId: string;
  profileId?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [collectors, setCollectors] = useState<SurveyMonkeyMultibaseCollector[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cleanSurveyId = surveyId.trim();
  const selected = smSplitScopeList(value);
  const selectedSet = new Set(selected);
  const orderedIds = (collectors ?? []).map((item) => item.id).filter(Boolean);
  const missingSelected = selected.filter((id) => !orderedIds.includes(id));

  useEffect(() => {
    let cancelled = false;
    if (!cleanSurveyId) {
      setCollectors(null);
      setError("");
      return;
    }
    const cacheKey = smCollectorCacheKey(cleanSurveyId, SM_DEFAULT_BASE_URL, profileId);
    const cached = smCollectorCatalogCache.get(cacheKey);
    if (cached) {
      setCollectors(cached);
      setError("");
      return;
    }
    setError("");
    setCollectors(null);
  }, [cleanSurveyId, profileId]);

  function loadCollectors() {
    if (!cleanSurveyId || loading) return;
    const cacheKey = smCollectorCacheKey(cleanSurveyId, SM_DEFAULT_BASE_URL, profileId);
    const cached = smCollectorCatalogCache.get(cacheKey);
    if (cached) {
      setCollectors(cached);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    void apiSurveyMonkeyMultibaseCollectors(cleanSurveyId, SM_DEFAULT_BASE_URL, {
      profile_id: profileId || undefined,
    })
      .then((result) => {
        smCollectorCatalogCache.set(cacheKey, result.collectors);
        setCollectors(result.collectors);
      })
      .catch((e) => {
        setError((e as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className="pulso-sm-collector-picker">
      <div className="pulso-sm-collector-picker-head">
        <span><Filter size={13} /> {label}</span>
        <div>
          <em>{selected.length ? `${selected.length} seleccionados` : "Todos"}</em>
          <button
            type="button"
            className="pulso-sm-collector-load"
            disabled={disabled || loading || !cleanSurveyId}
            onClick={loadCollectors}
          >
            {loading ? <Loader2 size={11} className="pulso-spin" /> : null}
            Actualizar recopiladores
          </button>
        </div>
      </div>
      <div className="pulso-sm-collector-options">
        {!cleanSurveyId && <small>Elige una encuesta para listar sus recopiladores.</small>}
        {!collectors && !loading && cleanSurveyId && !error && (
          <small>Se muestran los filtros guardados. Actualiza recopiladores solo si necesitas cambiar la selección.</small>
        )}
        {loading && <small><Loader2 size={12} className="pulso-spin" /> Actualizando recopiladores...</small>}
        {error && <small className="is-error">{error}</small>}
        {collectors?.map((collector) => {
          const collectorId = collector.id;
          if (!collectorId) return null;
          return (
            <label key={collectorId} className="pulso-sm-collector-option">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selectedSet.has(collectorId)}
                onChange={(event) => onChange(smToggleCollectorId(value, collectorId, event.target.checked, orderedIds))}
              />
              <span>
                <strong>{smCollectorDisplayName(collector)}</strong>
                <small>{smCollectorTypeLabel(collector.type)} · {smCollectorResponseLabel(collector.response_count)} · ID {collectorId}</small>
              </span>
            </label>
          );
        })}
        {missingSelected.map((collectorId) => (
          <label key={collectorId} className="pulso-sm-collector-option is-manual">
            <input
              type="checkbox"
              disabled={disabled}
              checked
              onChange={(event) => onChange(smToggleCollectorId(value, collectorId, event.target.checked, orderedIds))}
            />
            <span>
              <strong>Recopilador {collectorId}</strong>
              <small>ID guardado en el proyecto</small>
            </span>
          </label>
        ))}
        {collectors && !collectors.length && !loading && !error && <small>SurveyMonkey no devolvió recopiladores para esta encuesta.</small>}
      </div>
      {selected.length > 0 && (
        <button type="button" className="pulso-sm-collector-clear" disabled={disabled} onClick={() => onChange("")}>
          Incluir todos
        </button>
      )}
    </div>
  );
}

export function IndependentSiblingsSurveyMonkeyWizard({
  estudio,
  plannedInputCount,
  canonicalOptions,
  disabled,
  onImported,
}: {
  estudio: EstudioPayload;
  plannedInputCount: number;
  canonicalOptions: SmCanonicalOption[];
  disabled: boolean;
  onImported: (payload: EstudioPayload) => Promise<void>;
}) {
  const [surveys, setSurveys] = useState<SurveyMonkeyMultibaseListItem[] | null>(null);
  const [surveyMeta, setSurveyMeta] = useState<{
    totalRecent: number;
    months: number;
    fromCache: boolean;
    fetchedAt: string | null;
    catalogCount: number;
    cacheStatus: string;
    refreshError: string;
  } | null>(null);
  // Borrador del wizard (filtro, selección, scope, reglas, canónico):
  // vive en useCargaStore para sobrevivir al unmount del panel. Los
  // payloads del backend (catálogo, auditorías, resultados) siguen locales.
  const query = useCargaStore((s) => s.smCatalogQuery);
  const setQuery = useCargaStore((s) => s.setSmCatalogQuery);
  const selectedIds = useCargaStore((s) => s.smSelectedIds);
  const setSelectedIds = useCargaStore((s) => s.setSmSelectedIds);
  const scopeDrafts = useCargaStore((s) => s.smScopeDrafts);
  const setScopeDrafts = useCargaStore((s) => s.setSmScopeDrafts);
  const [audit, setAudit] = useState<SurveyMonkeyMultibaseAudit | null>(null);
  const [logicSync, setLogicSync] = useState<EstudioLogicSyncResult | null>(null);
  const [canonicalRepairResult, setCanonicalRepairResult] = useState<EstudioLogicSyncResult | null>(null);
  const canonicalFileId = useCargaStore((s) => s.smCanonicalFileId);
  const setCanonicalFileId = useCargaStore((s) => s.setSmCanonicalFileId);
  const surveyMonkeyLogicRules = useCargaStore((s) => s.smSharedLogicRules);
  const setSurveyMonkeyLogicRules = useCargaStore((s) => s.setSmSharedLogicRules);
  const [surveyMonkeyLogicPreview, setSurveyMonkeyLogicPreview] = useState<SmLogicPreviewRow[] | null>(null);
  const [smConnection, setSmConnection] = useState<ConnectionTokenState | null>(null);
  const [selectedSmProfileId, setSelectedSmProfileId] = useState("");
  // Tri-estado en el store: `null` = sin decisión del usuario → default del
  // useState original (`estudio.n_bases === 0`).
  const smShowSurveyCatalogRaw = useCargaStore((s) => s.smShowSurveyCatalog);
  const setShowSurveyCatalog = useCargaStore((s) => s.setSmShowSurveyCatalog);
  const showSurveyCatalog = smShowSurveyCatalogRaw ?? estudio.n_bases === 0;
  const [refreshPlan, setRefreshPlan] = useState<SurveyMonkeyRefreshPlan | null>(null);
  const [refreshResult, setRefreshResult] = useState<SurveyMonkeyRefreshResult | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookFileId, setWorkbookFileId] = useState("");
  const [workbookInspection, setWorkbookInspection] = useState<SurveyMonkeyWorkbookInspection | null>(null);
  const [workbookImportResult, setWorkbookImportResult] = useState<SurveyMonkeyWorkbookImportResult | null>(null);
  const [koboRefreshResult, setKoboRefreshResult] = useState<KoboIndependentRefreshResult | null>(null);
  const [editingAliasBase, setEditingAliasBase] = useState<string | null>(null);
  const [editingAliasDraft, setEditingAliasDraft] = useState("");
  const [monitoringSuggestions, setMonitoringSuggestions] = useState<EstudioProcessingSuggestions | null>(null);
  const [monitoringSuggestionsStatus, setMonitoringSuggestionsStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const modeConflict = estudio.n_bases > 0 && estudio.processing_mode !== "independent_siblings";
  const existingBases = Object.values(estudio.bases ?? {});
  const existingKoboBases = existingBases.filter((base) => (
    String(base.source_kind || "").toLowerCase() === "kobo_api" ||
    !!String(base.kobo_source_spec?.asset_uid || "").trim()
  ));
  const hasExistingIndependentBases = existingBases.length > 0 && estudio.processing_mode === "independent_siblings";
  const templateSyncBase = smIndependentTemplateBase(estudio, existingBases);
  const promotedBase = existingBases.find((base) => base.nombre === estudio.active_base) ?? existingBases[0] ?? null;
  const promotedTitle = smIndependentBaseTitle(promotedBase, estudio);
  const promotedName = promotedBase?.nombre === "default" ? smBaseSlug(promotedTitle) : promotedBase?.nombre;
  const physicalCapacity = independentSiblingsCapacity(estudio);
  const independentMaxBases = Math.max(
    estudio.n_bases,
    Math.min(physicalCapacity.maxBases, plannedInputCount),
  );
  const capacityLeft = Math.max(0, independentMaxBases - estudio.n_bases);
  const existingSurveyIds = new Set(existingBases.flatMap(smSurveyIdsFromBase));
  const existingKoboAssetIds = new Set(existingBases.flatMap(koboAssetIdsFromBase));
  const selectedSurveyIds = selectedIds;
  const blockedSurveyIds = new Set([...Array.from(existingSurveyIds), ...Array.from(selectedSurveyIds)]);
  const surveyAvailability = smSurveyCatalogAvailability(surveys, query, existingSurveyIds, selectedSurveyIds);
  const visibleSurveys = surveyAvailability.available;
  const hiddenDuplicateSurveys = surveyAvailability.duplicates;
  const duplicateSurveyAlert = smDuplicateSurveyAlert(hiddenDuplicateSurveys, existingSurveyIds, selectedSurveyIds);
  const existingBaseByName = new Map(existingBases.map((base) => [base.nombre, base] as const));
  const selectedSurveys = (surveys ?? []).filter((item) => selectedIds.has(item.id));
  const selectedNewSurveys = selectedSurveys.filter((item) => !scopeDrafts[item.id]?.targetBaseName);
  const selectedMergeSurveys = selectedSurveys.filter((item) => !!scopeDrafts[item.id]?.targetBaseName);
  const selectedInputs = selectedNewSurveys.map((item) => smIndependentSurveyInput(item, scopeDrafts[item.id]));
  const selectedMergeCampaignCount = selectedMergeSurveys.reduce((total, item) => {
    const scope = scopeDrafts[item.id] ?? smDefaultScopeDraft();
    return total + smSelectedCampaignInputs(item, scope, surveys).length;
  }, 0);
  const selectedTotal = estudio.n_bases + selectedInputs.length;
  const plannedRemaining = Math.max(0, capacityLeft - selectedInputs.length);
  const selectedAliasRows = selectedNewSurveys.map((item) => {
    const alias = smAliasDraftValue(item, scopeDrafts[item.id]).trim();
    return { surveyId: item.id, alias, slug: smBaseSlug(alias) };
  });
  const duplicateAliasSlugs = new Set(
    selectedAliasRows
      .map((row) => row.slug)
      .filter((slug, index, slugs) => slugs.indexOf(slug) !== index),
  );
  const hasAliasIssues = selectedAliasRows.some((row) => !row.alias) || duplicateAliasSlugs.size > 0;
  const hasMergeTargetIssues = selectedMergeSurveys.some((item) => !existingBaseByName.has(scopeDrafts[item.id]?.targetBaseName || ""));
  const hasSelectedWork = selectedInputs.length > 0 || selectedMergeCampaignCount > 0;
  const canImport = hasSelectedWork && selectedInputs.length <= capacityLeft && !hasAliasIssues && !hasMergeTargetIssues && !modeConflict && !busy && !disabled;
  const overIndependentLimit = selectedInputs.length > capacityLeft;
  const canImportWorkbook = smWorkbookInspectionCanImport(workbookInspection) && !busy && !disabled;
  const hasCanonicalReference = canonicalOptions.length > 0;
  const selectedCanonical = canonicalOptions.find((option) => option.fileId === canonicalFileId) ?? canonicalOptions[0] ?? null;
  const canonicalReferenceKind = selectedCanonical?.fileId ? "Base existente" : "Formulario cargado en Carga/Editor";
  const familyStatus = String(estudio.independent_siblings?.status || "");
  const familyLogicAppliedAt = String(estudio.independent_siblings?.logic_applied_at || "");
  const hasFamilyLogicApplied = !!familyLogicAppliedAt || familyStatus.includes("logic_applied");
  const hasCanonicalBaseStatus = existingBases.some((base) => String(base.logic_template_status || "").startsWith("canonical_"));
  const shouldOfferCanonicalRepair = hasExistingIndependentBases && hasCanonicalReference && !hasFamilyLogicApplied && !hasCanonicalBaseStatus;
  const canonicalRepairChangedCells = (canonicalRepairResult?.results ?? []).reduce((sum, row) => sum + (Number(row.changed_cells) || 0), 0);
  const importableMonitoringSuggestionGroups = (monitoringSuggestions?.groups ?? [])
    .filter((group) => smMonitoringSuggestionCanImport(group, existingSurveyIds, selectedIds));
  const importableKoboMonitoringSuggestionGroups = (monitoringSuggestions?.groups ?? [])
    .filter((group) => koboMonitoringSuggestionCanImport(group, existingKoboAssetIds));
  const monitoringGroups = monitoringSuggestions?.groups ?? [];
  const hasMonitoringSurveyMonkeyGroups = monitoringGroups.some((group) => group.platform === "surveymonkey");
  const hasMonitoringKoboGroups = monitoringGroups.some((group) => group.platform === "kobo");
  const monitoringKoboOnly = hasMonitoringKoboGroups && !hasMonitoringSurveyMonkeyGroups;
  const shouldShowSurveyMonkeyActions = showSurveyCatalog ||
    selectedInputs.length > 0 ||
    selectedMergeCampaignCount > 0 ||
    hasMonitoringSurveyMonkeyGroups ||
    hasExistingIndependentBases;
  const independentProviderLabel = monitoringKoboOnly
    ? "Kobo"
    : hasMonitoringKoboGroups && hasMonitoringSurveyMonkeyGroups
      ? "SurveyMonkey / Kobo"
      : "SurveyMonkey";
  const monitoringLogicSuggestion = smSuggestedSurveyMonkeyLogicRulesFromMonitoring(monitoringSuggestions);
  const canInsertMonitoringLogicSuggestion = Boolean(
    monitoringLogicSuggestion && surveyMonkeyLogicRules.trim() !== monitoringLogicSuggestion,
  );
  const surveySpecificLogicRulesBySurvey = smSurveySpecificLogicRulesBySurvey(selectedNewSurveys, scopeDrafts);
  const surveyLogicLabels = Object.fromEntries(selectedNewSurveys.map((item) => [
    item.id,
    smAliasDraftValue(item, scopeDrafts[item.id]).trim() || smSurveyDefaultAlias(item),
  ]));
  const surveyMonkeyLogicPreviewEntries = smSurveyMonkeyLogicPreviewEntries(
    surveyMonkeyLogicRules,
    surveySpecificLogicRulesBySurvey,
    surveyLogicLabels,
  );
  const surveyMonkeyLogicRuleLines = surveyMonkeyLogicPreviewEntries.map((entry) => entry.rule);
  const hasSharedSurveyMonkeyLogic = surveyMonkeyLogicRuleLines.length > 0;
  const surveyMonkeyLogicPreviewErrors = surveyMonkeyLogicPreview?.filter((row) => !row.ok).length ?? 0;
  const surveyMonkeyLogicPreviewWarnings = surveyMonkeyLogicPreview?.reduce((sum, row) => sum + row.warnings.length, 0) ?? 0;
  const preparedMonitoringSuggestionGroups = (monitoringSuggestions?.groups ?? [])
    .filter((group) => {
      const primary = smMonitoringSuggestionPrimarySource(group);
      return Boolean(primary?.survey_id && selectedIds.has(primary.survey_id) && !existingSurveyIds.has(primary.survey_id));
    });

  useEffect(() => {
    if (!canonicalOptions.length) {
      if (canonicalFileId) setCanonicalFileId("");
      return;
    }
    if (!canonicalOptions.some((option) => option.fileId === canonicalFileId)) {
      setCanonicalFileId(canonicalOptions[0].fileId);
      setAudit(null);
    }
  }, [canonicalOptions, canonicalFileId]);

  useEffect(() => {
    if (monitoringKoboOnly && selectedIds.size === 0 && !(surveys?.length)) {
      setShowSurveyCatalog(false);
    }
  }, [monitoringKoboOnly, selectedIds.size, surveys?.length]);

  async function loadProcessingSuggestions() {
    setMonitoringSuggestionsStatus("Leyendo Monitoreo...");
    try {
      const result = await apiEstudioProcessingSuggestions();
      setMonitoringSuggestions(result);
      setMonitoringSuggestionsStatus("");
    } catch (e) {
      setMonitoringSuggestions(null);
      setMonitoringSuggestionsStatus((e as Error).message);
    }
  }

  async function refreshSurveyMonkeyConnection() {
    try {
      const next = await apiConnectionTokenLoad("surveymonkey");
      setSmConnection(next);
      setSelectedSmProfileId((current) => {
        if (current && next.profiles?.some((profile) => profile.id === current && profile.has_token)) {
          return current;
        }
        return next.active_profile_id
          || next.profiles?.find((profile) => profile.is_default && profile.has_token)?.id
          || next.profiles?.find((profile) => profile.has_token)?.id
          || "";
      });
    } catch {
      setSmConnection(null);
      setSelectedSmProfileId("");
    }
  }

  function selectSurveyMonkeyProfile(profileId: string) {
    if (!profileId) return;
    setError("");
    setSelectedSmProfileId(profileId);
    setSurveys(null);
    setSurveyMeta(null);
    setAudit(null);
  }

  async function loadSurveys(forceRefresh = false) {
    setError("");
    setBusy(forceRefresh ? "Actualizando catálogo SurveyMonkey..." : "Leyendo catálogo local SurveyMonkey...");
    try {
      await refreshSurveyMonkeyConnection();
      const result = await apiSurveyMonkeyMultibaseListSurveys("", 500, 6, {
        forceRefresh,
        profile_id: selectedSmProfileId || undefined,
      });
      setSurveys(result.surveys);
      setSurveyMeta({
        totalRecent: result.total_recent,
        months: result.months,
        fromCache: result.from_cache,
        fetchedAt: result.catalog_fetched_at,
        catalogCount: result.catalog_count,
        cacheStatus: result.cache_status,
        refreshError: result.refresh_error,
      });
      if (!result.surveys.length) setError("No encontré encuestas modificadas en los últimos 6 meses.");
    } catch (e) {
      setError((e as Error).message);
      void refreshSurveyMonkeyConnection();
    } finally {
      setBusy("");
    }
  }

  function toggleSurvey(item: SurveyMonkeyMultibaseListItem) {
    setAudit(null);
    setError("");
    const wasSelected = selectedIds.has(item.id);
    const inferredTarget = hasExistingIndependentBases
      ? smBestExistingBaseTarget(item, existingBases)
      : "";
    if (!wasSelected && existingSurveyIds.has(item.id)) {
      setError(`La encuesta ${item.id} ya está cargada en esta familia y no se puede agregar otra vez.`);
      return;
    }
    if (!wasSelected && !hasExistingIndependentBases && selectedInputs.length >= capacityLeft) {
      setError(`Este modo permite máximo ${independentMaxBases} fuentes independientes por estudio.`);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (wasSelected) {
      setScopeDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      setScopeDrafts((prev) => ({
        ...prev,
        [item.id]: {
          ...smDefaultScopeDraft(),
          ...(prev[item.id] ?? {}),
          alias: prev[item.id]?.alias?.trim() ? prev[item.id].alias : smSurveyDefaultAlias(item),
          channel: prev[item.id]?.channel || smSurveyDefaultChannel(item),
          targetBaseName: prev[item.id]?.targetBaseName ?? inferredTarget,
        },
      }));
    }
  }

  function updateScope(id: string, patch: Partial<SmImportScopeDraft>) {
    setAudit(null);
    setScopeDrafts((prev) => ({
      ...prev,
      [id]: {
        ...smDefaultScopeDraft(),
        ...(prev[id] ?? {}),
        ...patch,
      },
    }));
  }

  function updateAlias(id: string, alias: string) {
    updateScope(id, { alias });
  }

  function addExtraSource(id: string) {
    const current = scopeDrafts[id] ?? smDefaultScopeDraft();
    updateScope(id, {
      extraSources: [
        ...current.extraSources,
        {
          ...smDefaultScopeFields(),
          collectionStrategy: "whatsapp_link",
          channel: current.channel || "",
          key: smNewScopeKey(),
          surveyId: "",
          label: "",
          query: "",
        },
      ],
    });
  }

  function applyMonitoringSuggestionGroups(groups: EstudioProcessingSuggestionGroup[]) {
    const usable = groups.filter((group) => smMonitoringSuggestionCanImport(group, existingSurveyIds, selectedIds));
    if (!usable.length) {
      setError("No hay sugerencias SurveyMonkey nuevas para preparar.");
      return;
    }
    const newBaseCount = usable.filter((group) => !selectedIds.has(smMonitoringSuggestionPrimarySource(group)?.survey_id || "")).length;
    if (newBaseCount > capacityLeft) {
      setError(`Quedan ${capacityLeft} cupos para bases nuevas y la sugerencia necesita ${newBaseCount}.`);
      return;
    }
    setError("");
    setAudit(null);
    setLogicSync(null);
    setCanonicalRepairResult(null);
    setShowSurveyCatalog(true);
    setSurveys((prev) => smMergeSuggestionCatalog(prev, usable));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const group of usable) {
        const primary = smMonitoringSuggestionPrimarySource(group);
        if (primary?.survey_id) next.add(primary.survey_id);
      }
      return next;
    });
    setScopeDrafts((prev) => {
      const next = { ...prev };
      for (const group of usable) {
        const primary = smMonitoringSuggestionPrimarySource(group);
        if (!primary?.survey_id) continue;
        next[primary.survey_id] = smMonitoringSuggestionScope(group, next[primary.survey_id]);
      }
      return next;
    });
  }

  async function importKoboMonitoringSuggestionGroups(groups: EstudioProcessingSuggestionGroup[]) {
    const usable = groups.filter((group) => koboMonitoringSuggestionCanImport(group, existingKoboAssetIds));
    const assets = usable
      .map(koboMonitoringSuggestionInput)
      .filter((asset): asset is KoboIndependentAssetInput => Boolean(asset?.asset_uid));
    if (!assets.length) {
      setError("No hay sugerencias Kobo nuevas para importar como fuentes independientes.");
      return;
    }
    if (assets.length > capacityLeft) {
      setError(`Quedan ${capacityLeft} cupos para bases nuevas y Kobo necesita ${assets.length}.`);
      return;
    }
    setError("");
    setAudit(null);
    setLogicSync(null);
    setCanonicalRepairResult(null);
    const koboImportLabel = assets.length === 1 ? "Importando Kobo como fuente independiente" : "Importando Kobo como fuentes independientes";
    setBusy(`${koboImportLabel}...`);
    try {
      // Job en segundo plano (async: true): la app queda usable durante el
      // pull y result_data es el mismo payload que la respuesta síncrona.
      const start = await apiCargaImportKoboIndependentAsync({ assets });
      const result = await esperarResultadoImport<KoboIndependentImportResult>(start.job_id, {
        onProgress: (p) => setBusy(textoDeProgresoImport(koboImportLabel, p)),
      });
      if (result.xlsform_logic_sync) setLogicSync(result.xlsform_logic_sync);
      setKoboRefreshResult(null);
      await onImported(result.estudio);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function refreshKoboIndependentBases(baseNames?: string[]) {
    const targets = (baseNames?.length ? baseNames : existingKoboBases.map((base) => base.nombre))
      .filter((name) => !!name);
    if (!targets.length) {
      setError("No hay bases Kobo conectadas para actualizar.");
      return;
    }
    setError("");
    const koboRefreshLabel = targets.length === 1 ? "Actualizando base Kobo" : "Actualizando bases Kobo";
    setBusy(`${koboRefreshLabel}...`);
    try {
      const start = await apiCargaRefreshKoboIndependentAsync({ base_names: targets });
      const result = await esperarResultadoImport<KoboIndependentRefreshResult>(start.job_id, {
        onProgress: (p) => setBusy(textoDeProgresoImport(koboRefreshLabel, p)),
      });
      setKoboRefreshResult(result);
      await onImported(result.estudio);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function updateExtraSource(id: string, key: string, patch: Partial<SmExtraSourceDraft>) {
    const current = scopeDrafts[id] ?? smDefaultScopeDraft();
    updateScope(id, {
      extraSources: current.extraSources.map((source) => (
        source.key === key ? { ...source, ...patch } : source
      )),
    });
  }

  function selectExtraSource(id: string, key: string, survey: SurveyMonkeyMultibaseListItem) {
    if (blockedSurveyIds.has(survey.id)) {
      setError(`La encuesta ${survey.id} ya está cargada o seleccionada en esta familia.`);
      return;
    }
    updateExtraSource(id, key, {
      surveyId: survey.id,
      label: smSurveyDefaultAlias(survey),
      channel: smSurveyDefaultChannel(survey),
      query: "",
    });
  }

  function removeExtraSource(id: string, key: string) {
    const current = scopeDrafts[id] ?? smDefaultScopeDraft();
    updateScope(id, {
      extraSources: current.extraSources.filter((source) => source.key !== key),
    });
  }

  function selectedMergePayload() {
    const grouped = new Map<string, SurveyMonkeyMultibaseSurveyInput[]>();
    for (const item of selectedMergeSurveys) {
      const scope = scopeDrafts[item.id] ?? smDefaultScopeDraft();
      const baseName = scope.targetBaseName || "";
      if (!baseName || !existingBaseByName.has(baseName)) continue;
      const current = grouped.get(baseName) ?? [];
      current.push(...smSelectedCampaignInputs(item, scope, surveys));
      grouped.set(baseName, current);
    }
    return Array.from(grouped.entries()).map(([base_name, campaigns]) => ({ base_name, campaigns }));
  }

  async function runAudit() {
    if (!selectedInputs.length) return;
    setError("");
    setBusy("Auditando familia SurveyMonkey...");
    try {
      const result = await apiSurveyMonkeyMultibaseAudit(
        selectedInputs,
        hasCanonicalReference ? canonicalFileId : "",
        { profile_id: selectedSmProfileId || undefined },
      );
      setAudit(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runSurveyMonkeyLogicPreview() {
    const entries = surveyMonkeyLogicPreviewEntries;
    if (!entries.length) {
      setError("Escribe al menos una regla SurveyMonkey para validarla.");
      return;
    }
    setError("");
    setSurveyMonkeyLogicPreview(null);
    setBusy("Validando reglas SurveyMonkey...");
    try {
      await validateSurveyMonkeyLogicRows(entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function validateSurveyMonkeyLogicRows(entries: SmLogicPreviewEntry[]) {
    const rows = await Promise.all(entries.map(async (entry) => (
      smLogicPreviewRow(entry, await apiXlsformEditorSmInterpretRule(entry.rule))
    )));
    setSurveyMonkeyLogicPreview(rows);
    return rows;
  }

  async function runImport() {
    setError("");
    setLogicSync(null);
    setCanonicalRepairResult(null);
    setRefreshResult(null);
    const mergePayload = selectedMergePayload();
    const hasNewBases = selectedInputs.length > 0;
    const hasMergeCampaigns = mergePayload.some((row) => row.campaigns.length > 0);
    const importBusyLabel = hasNewBases && hasMergeCampaigns
      ? "Importando bases nuevas y fusionando campañas..."
      : hasMergeCampaigns
        ? "Agregando campañas a bases existentes..."
        : "Importando fuentes independientes...";
    try {
      const directLogicEntries = surveyMonkeyLogicPreviewEntries;
      const directLogicRules = directLogicEntries.map((entry) => entry.rule);
      if (hasNewBases && smSurveyMonkeyLogicPreviewNeedsReview(directLogicRules, surveyMonkeyLogicPreview)) {
        setSurveyMonkeyLogicPreview(null);
        setBusy("Validando reglas SurveyMonkey...");
        const previewRows = await validateSurveyMonkeyLogicRows(directLogicEntries);
        const failedRows = previewRows.filter((row) => !row.ok);
        if (failedRows.length) {
          setError("Corrige las reglas SurveyMonkey marcadas antes de importar bases nuevas.");
          return;
        }
      }
      setBusy(importBusyLabel);
      let latestEstudio: EstudioPayload | null = null;
      if (hasNewBases) {
        // Jobs en segundo plano, en serie (el backend rechaza dos imports de
        // plataforma simultáneos por sesión con E_CARGA_JOB_RUNNING).
        const start = await apiSurveyMonkeyMultibaseImportIndependentAsync({
          surveys: selectedInputs,
          profile_id: selectedSmProfileId || undefined,
          response_statuses: ["completed"],
          keep_missing_status: false,
          canonical_xlsform_file_id: canonicalFileId,
          use_canonical_xlsform_logic: hasCanonicalReference,
          surveymonkey_logic_rules: surveyMonkeyLogicRules.trim() || undefined,
          surveymonkey_logic_rules_by_survey: Object.keys(surveySpecificLogicRulesBySurvey).length
            ? surveySpecificLogicRulesBySurvey
            : undefined,
        });
        const result = await esperarResultadoImport<SurveyMonkeyMultibaseImportIndependentResult>(start.job_id, {
          onProgress: (p) => setBusy(textoDeProgresoImport("Importando fuentes independientes", p)),
        });
        setAudit(result.audit);
        if (result.xlsform_logic_sync) setLogicSync(result.xlsform_logic_sync);
        latestEstudio = result.estudio;
      }
      if (hasMergeCampaigns) {
        const start = await apiSurveyMonkeyMultibaseRefreshAsync({
          bases: mergePayload,
          months: 12,
          reapply_codificacion: true,
        });
        const result = await esperarResultadoImport<SurveyMonkeyRefreshResult>(start.job_id, {
          onProgress: (p) => setBusy(textoDeProgresoImport("Agregando campañas a bases existentes", p)),
        });
        setRefreshResult(result);
        setRefreshPlan(result.plan);
        latestEstudio = result.estudio;
      }
      if (latestEstudio) await onImported(latestEstudio);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runPromoteExisting() {
    if (!promotedBase) return;
    setError("");
    setLogicSync(null);
    setBusy("Convirtiendo el estudio actual a fuentes independientes...");
    try {
      const result = await apiEstudioPromoteIndependentSiblings({
        active_base: promotedBase.nombre,
        nombre_nuevo: promotedName,
        source_alias: promotedTitle,
        source_title: promotedTitle,
        source_kind: "existing_project",
      });
      await onImported(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runTemplateLogicSync() {
    const templateBase = smIndependentTemplateBase(estudio, existingBases);
    setError("");
    setLogicSync(null);
    setCanonicalRepairResult(null);
    setBusy("Sincronizando reglas de formulario entre bases compatibles...");
    try {
      const result = await apiEstudioApplyIndependentTemplateLogic({
        template_base: templateBase || undefined,
      });
      setLogicSync(result);
      if (result.estudio) {
        await onImported(result.estudio);
        window.dispatchEvent(new Event("pulso:session-changed"));
        window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
          detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
        }));
      }
    } catch (e) {
      const message = (e as Error).message;
      setError(message.includes("E_TEMPLATE_BASE_NOT_FOUND")
        ? "No hay una base de referencia válida. Selecciona una base activa de la familia o vuelve a cargar la familia."
        : message);
    } finally {
      setBusy("");
    }
  }

  async function runCanonicalLogicRepair() {
    if (!hasExistingIndependentBases || !hasCanonicalReference) return;
    setError("");
    setLogicSync(null);
    setCanonicalRepairResult(null);
    setBusy("Aplicando reglas del formulario de referencia...");
    try {
      const result = await apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic({
        canonical_xlsform_file_id: canonicalFileId,
        targets: existingBases.map((base) => base.nombre),
        clear_target_logic: false,
      });
      setLogicSync(result);
      setCanonicalRepairResult(result);
      if (result.estudio) {
        await onImported(result.estudio);
        window.dispatchEvent(new Event("pulso:session-changed"));
        window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
          detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
        }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function pickWorkbookFile(file: File | null) {
    setWorkbookFile(file);
    setWorkbookFileId("");
    setWorkbookInspection(null);
    setWorkbookImportResult(null);
    setError("");
  }

  async function inspectWorkbook() {
    if (!workbookFile && !workbookFileId) return;
    setError("");
    setWorkbookInspection(null);
    setWorkbookImportResult(null);
    setBusy("Inspeccionando Excel exportado...");
    try {
      let fileId = workbookFileId;
      if (!fileId) {
        if (!workbookFile) throw new Error("Selecciona un Excel exportado por SurveyMonkey.");
        const upload = await apiUpload(workbookFile, uploadKindForDataFile(workbookFile));
        fileId = upload.file_id;
        setWorkbookFileId(fileId);
      }
      const result = await apiSurveyMonkeyMultibaseWorkbookInspect({
        file_id: fileId,
        missing_required_policy: "fill_blank_warn",
      });
      setWorkbookInspection(result);
      if (!result.ok) {
        setError("Hay hojas sin base asignada. Revisa el nombre de las hojas o usa una plantilla con bases existentes.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function importWorkbook() {
    if (!workbookFileId || !workbookInspection) return;
    setError("");
    setWorkbookImportResult(null);
    setBusy("Aplicando Excel exportado a bases existentes...");
    try {
      const result = await apiSurveyMonkeyMultibaseWorkbookImport({
        file_id: workbookFileId,
        missing_required_policy: "fill_blank_warn",
      });
      setWorkbookImportResult(result);
      setWorkbookInspection(result.inspection);
      await onImported(result.estudio);
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function loadRefreshPlan(forceRefresh = false) {
    setError("");
    setRefreshResult(null);
    setBusy(forceRefresh ? "Actualizando catálogo y diagnosticando fuentes..." : "Diagnosticando fuentes SurveyMonkey...");
    try {
      const plan = await apiSurveyMonkeyMultibaseRefreshPlan({ months: 12, force_refresh: forceRefresh });
      setRefreshPlan(plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runRefreshSurveyMonkey() {
    if (!refreshPlan) return;
    setError("");
    setRefreshResult(null);
    setBusy("Actualizando respuestas SurveyMonkey...");
    try {
      const start = await apiSurveyMonkeyMultibaseRefreshAsync({
        bases: (refreshPlan.bases ?? []).map((row) => ({ base_name: row.base_name })),
        months: 12,
        reapply_codificacion: true,
      });
      const result = await esperarResultadoImport<SurveyMonkeyRefreshResult>(start.job_id, {
        onProgress: (p) => setBusy(textoDeProgresoImport("Actualizando respuestas SurveyMonkey", p)),
      });
      setRefreshResult(result);
      await onImported(result.estudio);
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
      }));
      const updatedPlan = await apiSurveyMonkeyMultibaseRefreshPlan({ months: 12, force_refresh: false });
      setRefreshPlan(updatedPlan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runRegenerateSurveyMonkeyRaw(base: EstudioBase) {
    const baseName = String(base.nombre || "").trim();
    if (!baseName) return;
    setError("");
    setRefreshResult(null);
    const regenerateLabel = `Regenerando respaldo de ${base.source_alias || base.source_title || baseName}`;
    setBusy(`${regenerateLabel}...`);
    try {
      const start = await apiSurveyMonkeyMultibaseRefreshAsync({
        bases: [{ base_name: baseName }],
        months: 12,
        force_refresh: true,
        reapply_codificacion: false,
        regenerate_raw_snapshot: true,
        raw_snapshot_only: true,
      });
      const result = await esperarResultadoImport<SurveyMonkeyRefreshResult>(start.job_id, {
        onProgress: (p) => setBusy(textoDeProgresoImport(regenerateLabel, p)),
      });
      const row = (result.results ?? []).find((item) => item.base_name === baseName);
      if (!row?.ok || !row.raw_snapshot_regenerated) {
        throw new Error(row?.reason || "SurveyMonkey no pudo regenerar el respaldo descargado de esta base.");
      }
      setRefreshResult(result);
      await onImported(result.estudio);
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: result.estudio.active_base, processing_mode: result.estudio.processing_mode },
      }));
      if (refreshPlan) {
        const updatedPlan = await apiSurveyMonkeyMultibaseRefreshPlan({ months: 12, force_refresh: false });
        setRefreshPlan(updatedPlan);
      }
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy("");
    }
  }

  function startEditingExistingAlias(base: EstudioBase) {
    setError("");
    setEditingAliasBase(base.nombre);
    setEditingAliasDraft(String(base.source_alias || base.source_title || base.nombre || "").trim());
  }

  function cancelEditingExistingAlias() {
    setEditingAliasBase(null);
    setEditingAliasDraft("");
  }

  async function saveExistingAlias(base: EstudioBase) {
    const nextAlias = editingAliasDraft.trim();
    if (!nextAlias) {
      setError("El alias visible no puede quedar vacío.");
      return;
    }
    setError("");
    setBusy(`Actualizando alias de ${base.nombre}...`);
    try {
      const payload = await apiEstudioUpdateBaseMetadata(base.nombre, {
        source_alias: nextAlias,
        source_title: base.source_title || nextAlias,
      });
      await onImported(payload);
      cancelEditingExistingAlias();
      window.dispatchEvent(new Event("pulso:session-changed"));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: payload.active_base, processing_mode: payload.processing_mode },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function saveExistingChannel(base: EstudioBase, channel: string) {
    const nextChannel = smChannelLabel(channel);
    setError("");
    setBusy(`Actualizando canal de ${base.nombre}...`);
    try {
      const payload = await apiEstudioUpdateBaseMetadata(base.nombre, {
        source_channel: nextChannel,
        surveymonkey_source_spec: smSpecWithPrimaryChannel(base.surveymonkey_source_spec, nextChannel),
      });
      await onImported(payload);
      window.dispatchEvent(new Event("pulso:session-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function saveExistingConsentVar(base: EstudioBase, consentVar: string) {
    const nextConsentVar = consentVar.trim();
    setError("");
    setBusy(`Actualizando consentimiento de ${base.nombre}...`);
    try {
      const payload = await apiEstudioUpdateBaseMetadata(base.nombre, {
        consent_var: nextConsentVar,
        surveymonkey_source_spec: smSpecWithConsentVar(base.surveymonkey_source_spec, nextConsentVar),
      });
      await onImported(payload);
      window.dispatchEvent(new Event("pulso:session-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function saveExistingCollectors(base: EstudioBase, spec: SurveyMonkeyMultibaseSurveyInput) {
    setError("");
    setBusy(`Actualizando recopiladores de ${base.nombre}...`);
    try {
      const payload = await apiEstudioUpdateBaseMetadata(base.nombre, {
        surveymonkey_source_spec: spec,
      });
      await onImported(payload);
      window.dispatchEvent(new Event("pulso:session-changed"));
      if (refreshPlan) {
        const updatedPlan = await apiSurveyMonkeyMultibaseRefreshPlan({ months: 12, force_refresh: false });
        setRefreshPlan(updatedPlan);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (!showSurveyCatalog) return;
    void refreshSurveyMonkeyConnection();
  }, [showSurveyCatalog]);

  return (
    <section className="pulso-integrated-panel pulso-sm-independent-workbench">
      <header className="pulso-integrated-head">
        <span className="pulso-sm-multibase-icon" aria-hidden="true"><Cloud size={18} /></span>
        <div>
          <div className="pulso-sm-multibase-kicker">{independentProviderLabel}</div>
          <h3>Fuentes independientes</h3>
          <p>Cada encuesta conserva sus respuestas y entregables, pero comparte una plantilla de referencia para revisar lógica compatible.</p>
          <p>
            Usa el catálogo conectado para sumar carreras o actores sin mezclar sus bases. Si ya tenías una base trabajada,
            puede servir como referencia para alinear saltos, cierres y preguntas comunes.
          </p>
          <div className="pulso-sm-family-meter pulso-sm-independent-meter" aria-label="Resumen de familia independiente">
            <span>{independentSiblingsCapacityLabel(selectedTotal, independentMaxBases)}</span>
            <span>{plannedRemaining > 0 ? `${plannedRemaining} por agregar` : "Plan completo"}</span>
            <span>{hasCanonicalReference ? "Plantilla lista" : "Plantilla pendiente"}</span>
            <span>{hasExistingIndependentBases ? "Actualización disponible" : "Por configurar"}</span>
          </div>
        </div>
      </header>

      {modeConflict && (
        <div className="pulso-sm-multibase-warning">
          <AlertTriangle size={15} />
          <span>
            Este estudio ya tiene una base normalizada o en proceso. Puedes convertirla en plantilla,
            conservar lo trabajado y sumar fuentes independientes después.
          </span>
          <button
            type="button"
            className="pulso-sm-secondary"
            onClick={runPromoteExisting}
            disabled={!promotedBase || !!busy || disabled}
          >
            <Layers size={13} />
            Convertir estudio actual
          </button>
        </div>
      )}

      <div className={`pulso-sm-logic-reference${hasCanonicalReference ? "" : " is-missing"}`} aria-label="Formulario de referencia para reglas compartidas">
        <div className="pulso-sm-logic-reference-main">
          <span className="pulso-sm-logic-reference-icon" aria-hidden="true">
            {hasCanonicalReference ? <FileSpreadsheet size={15} /> : <AlertTriangle size={15} />}
          </span>
          <div>
            <strong>Formulario de referencia</strong>
            <span>
              {hasCanonicalReference
                ? "Se aplicará a cada encuesta nueva antes de preparar las respuestas."
                : "Carga un formulario en Carga/Editor para usarlo como referencia."}
            </span>
          </div>
        </div>
        <label className="pulso-sm-logic-reference-select">
          <span>Referencia</span>
          <select
            value={canonicalFileId}
            disabled={!hasCanonicalReference || !!busy || disabled}
            onChange={(event) => {
              setCanonicalFileId(event.target.value);
              setAudit(null);
              setLogicSync(null);
              setCanonicalRepairResult(null);
            }}
          >
            {hasCanonicalReference ? canonicalOptions.map((option) => (
              <option key={option.fileId || "session-xlsform"} value={option.fileId}>
                {option.label}
              </option>
            )) : (
              <option value="">Sin formulario de referencia</option>
            )}
          </select>
        </label>
        <div className="pulso-sm-logic-reference-rules">
          <div className="pulso-sm-logic-reference-rules-head">
            <div className="pulso-sm-logic-reference-rules-title">
              <label htmlFor="pulso-sm-logic-rules">Reglas compartidas entre encuestas</label>
              <span>
                {hasSharedSurveyMonkeyLogic
                  ? `${surveyMonkeyLogicRuleLines.length} ${surveyMonkeyLogicRuleLines.length === 1 ? "regla lista" : "reglas listas"} para validar`
                  : "Opcional · cuando SurveyMonkey trae saltos o cierres directos"}
              </span>
            </div>
            <div className="pulso-sm-logic-reference-rules-actions">
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || surveyMonkeyLogicRuleLines.length === 0}
                onClick={() => void runSurveyMonkeyLogicPreview()}
                title="Revisar sintaxis e intención antes de importar"
              >
                {busy === "Validando reglas SurveyMonkey..." ? <Loader2 size={12} className="pulso-spin" /> : <CheckCircle2 size={12} />}
                Revisar reglas
              </button>
              {monitoringLogicSuggestion && (
                <button
                  type="button"
                  className="pulso-sm-secondary"
                  disabled={disabled || !!busy || !canInsertMonitoringLogicSuggestion}
                  onClick={() => {
                    setSurveyMonkeyLogicRules(monitoringLogicSuggestion);
                    setSurveyMonkeyLogicPreview(null);
                    setAudit(null);
                  }}
                  title="Insertar plantilla sugerida por Monitoreo para revisar antes de importar"
                >
                  <GitMerge size={12} />
                  Usar sugerencia
                </button>
              )}
            </div>
          </div>
          <textarea
            id="pulso-sm-logic-rules"
            value={surveyMonkeyLogicRules}
            disabled={disabled || !!busy}
            rows={3}
            placeholder={monitoringLogicSuggestion || "Ej.: Q1 = C1 => Ocultar P2 (oculta la pregunta 2)."}
            onChange={(event) => {
              setSurveyMonkeyLogicRules(event.target.value);
              setSurveyMonkeyLogicPreview(null);
              setAudit(null);
            }}
          />
          <div className="pulso-sm-logic-reference-guide" aria-label="Lectura rápida de lógica SurveyMonkey">
            <span><CheckCircle2 size={12} /> Se aplica a las encuestas nuevas</span>
            <span><GitMerge size={12} /> Puede venir de Monitoreo</span>
            <span><FileSpreadsheet size={12} /> Se revisa contra la referencia</span>
          </div>
          {surveyMonkeyLogicPreview && (
            <div className={`pulso-sm-logic-preview${surveyMonkeyLogicPreviewErrors ? " has-errors" : " is-ok"}`} role="status">
              <strong>
                {surveyMonkeyLogicPreviewErrors
                  ? `${surveyMonkeyLogicPreviewErrors} regla${surveyMonkeyLogicPreviewErrors === 1 ? "" : "s"} requieren revisión`
                  : `${surveyMonkeyLogicPreview.length} regla${surveyMonkeyLogicPreview.length === 1 ? "" : "s"} interpretada${surveyMonkeyLogicPreview.length === 1 ? "" : "s"}`}
                {surveyMonkeyLogicPreviewWarnings ? ` · ${surveyMonkeyLogicPreviewWarnings} advertencia${surveyMonkeyLogicPreviewWarnings === 1 ? "" : "s"}` : ""}
              </strong>
              <div className="pulso-sm-logic-preview-list">
                {surveyMonkeyLogicPreview.map((row, index) => (
                  <div className="pulso-sm-logic-preview-row" key={`${row.rule}-${index}`}>
                    {row.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
	                    <span>
	                      <code>{row.rule}</code>
	                      {row.origin && <em>{row.origin}</em>}
	                      <small>{row.summary}: {row.detail}</small>
	                      {row.warnings.map((warning) => <small key={warning} className="is-warning">{warning}</small>)}
	                    </span>
                  </div>
                ))}
              </div>
              <small>Esta revisión confirma sintaxis e intención general; la importación vuelve a validar cada regla contra el formulario de cada actor.</small>
            </div>
          )}
          {monitoringLogicSuggestion && (
            <small>
              Sugerida por Monitoreo para fuentes con enlaces personalizados; se valida antes de importar.
            </small>
          )}
        </div>
        <div className="pulso-sm-logic-reference-status">
          {hasCanonicalReference ? (
            <>
              <span><CheckCircle2 size={12} /> Lógica compartida activa</span>
              <small>{canonicalReferenceKind}: {selectedCanonical?.label ?? "formulario de referencia"}</small>
            </>
          ) : (
            <>
              <span><AlertTriangle size={12} /> Sin plantilla</span>
              <small>Las bases se importarían con la lógica directa de SurveyMonkey.</small>
            </>
          )}
        </div>
      </div>

      <MonitoringProcessingSuggestionsCard
        suggestions={monitoringSuggestions}
        status={monitoringSuggestionsStatus}
        disabled={disabled || !!busy}
        importableGroups={importableMonitoringSuggestionGroups}
        importableKoboGroups={importableKoboMonitoringSuggestionGroups}
        preparedGroups={preparedMonitoringSuggestionGroups}
        onRefresh={() => void loadProcessingSuggestions()}
        onApplyGroup={(group) => applyMonitoringSuggestionGroups([group])}
        onApplyAll={() => applyMonitoringSuggestionGroups(importableMonitoringSuggestionGroups)}
        onImportKoboGroup={(group) => void importKoboMonitoringSuggestionGroups([group])}
        onImportAllKobo={() => void importKoboMonitoringSuggestionGroups(importableKoboMonitoringSuggestionGroups)}
      />

      {shouldOfferCanonicalRepair && (
        <div className="pulso-sm-logic-repair" aria-label="Aviso de reglas pendientes en fuentes independientes">
          <div className="pulso-sm-logic-repair-copy">
            <span className="pulso-sm-logic-repair-icon" aria-hidden="true">
              <AlertTriangle size={15} />
            </span>
            <div>
              <strong>Estas bases podrían estar sin las reglas del formulario de referencia</strong>
              <span>
                Puedes alinear sus instrumentos con <b>{selectedCanonical?.label ?? "el formulario de referencia"}</b>.
                No reemplaza respuestas ni cambia la base; actualiza reglas de salto y visibilidad.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={runCanonicalLogicRepair}
            disabled={disabled || !!busy}
          >
            {busy ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
            Aplicar reglas
          </button>
        </div>
      )}

      {canonicalRepairResult && (
        <div className="pulso-sm-logic-repair is-done" aria-label="Resultado de alineación de lógica">
          <div className="pulso-sm-logic-repair-copy">
            <span className="pulso-sm-logic-repair-icon" aria-hidden="true">
              <CheckCircle2 size={15} />
            </span>
            <div>
              <strong>
                {canonicalRepairResult.n_updated_bases > 0
                  ? "Reglas aplicadas a las fuentes"
                  : "Las fuentes ya estaban alineadas"}
              </strong>
              <span>
                {canonicalRepairResult.n_updated_bases}/{canonicalRepairResult.n_targets} bases actualizadas
                {canonicalRepairChangedCells > 0 ? ` · ${canonicalRepairChangedCells} reglas ajustadas` : ""}.
              </span>
            </div>
          </div>
        </div>
      )}

      {hasExistingIndependentBases && (
        <div className="pulso-sm-family-config">
          <div className="pulso-sm-family-config-head">
            <strong>Familia cargada</strong>
            <span>{independentSiblingsCapacityLabel(estudio.n_bases, independentMaxBases)} · listas para procesar por base activa</span>
          </div>
          <div className="pulso-sm-workbook-import is-workbook" aria-label="Importar Excel exportado por SurveyMonkey">
            <div className="pulso-sm-family-config-head">
              <div>
                <strong>Importar Excel exportado</strong>
                <span>
                  Actualiza las respuestas de bases existentes con un Excel multihoja. Faltantes como p3, p4 o p5 quedan vacíos con advertencia.
                </span>
              </div>
              <div className="pulso-sm-family-actions">
                <button
                  type="button"
                  className="pulso-sm-secondary"
                  disabled={disabled || !!busy || !workbookFile}
                  onClick={inspectWorkbook}
                >
                  {busy ? <Loader2 size={13} className="pulso-spin" /> : <FileSpreadsheet size={13} />}
                  Inspeccionar
                </button>
                <button
                  type="button"
                  disabled={!canImportWorkbook}
                  onClick={importWorkbook}
                >
                  {busy ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                  Aplicar importación
                </button>
              </div>
            </div>
            <div className="pulso-sm-workbook-toolbar">
              <FilePicker
                icon={FileSpreadsheet}
                title="Excel exportado"
                accept=".xlsx,.xls"
                acceptLabel="XLSX / XLS"
                file={workbookFile}
                onPick={pickWorkbookFile}
              />
              <div className="pulso-sm-workbook-summary">
                {workbookInspection ? (
                  <>
                    <span className={`pulso-sm-family-status${workbookInspection.ok ? "" : " is-warning"}`}>
                      {workbookInspection.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {workbookInspection.n_matched}/{workbookInspection.n_sheets} hojas listas
                    </span>
                    <small>
                      {smWorkbookInspectionWarningCount(workbookInspection)} advertencias
                      {smWorkbookInspectionCellErrorCount(workbookInspection) > 0
                        ? ` · ${smWorkbookInspectionCellErrorCount(workbookInspection)} errores Excel`
                        : ""}
                      {" · "}
                      {workbookInspection.filename}
                    </small>
                  </>
                ) : (
                  <>
                    <span className="pulso-sm-family-status is-neutral">
                      <FileSpreadsheet size={12} />
                      Sin inspección
                    </span>
                    <small>Las hojas se emparejan por nombre normalizado con las fuentes cargadas.</small>
                  </>
                )}
              </div>
            </div>
            {workbookInspection && (
              <div className="pulso-sm-family-table is-workbook" role="table" aria-label="Inspección de Excel exportado">
                <div className="pulso-sm-family-row is-head is-workbook-row" role="row">
                  <span>Hoja</span>
                  <span>Base</span>
                  <span>Respuestas</span>
                  <span>Encabezados</span>
                  <span>Advertencias</span>
                </div>
                {workbookInspection.sheets.map((sheet) => {
                  const sheetHasIssues = sheet.warnings.length > 0 || (sheet.n_cell_errors ?? 0) > 0;
                  return (
                    <div className={`pulso-sm-family-row is-workbook-row${sheet.blocking ? " is-invalid" : ""}`} role="row" key={sheet.sheet_name}>
                      <div className="pulso-sm-family-origin-cell">
                        <strong>{sheet.sheet_name}</strong>
                        <small>{sheet.n_rows} filas · {sheet.n_columns} columnas de origen</small>
                      </div>
                      <div className="pulso-sm-family-origin-cell">
                        <strong>{sheet.base_name || "Sin match"}</strong>
                        <small>{sheet.matched ? "Match automático" : "Bloqueada"}</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className={`pulso-sm-family-status${sheet.blocking ? " is-warning" : " is-neutral"}`}>
                          {sheet.blocking ? <AlertTriangle size={12} /> : <Database size={12} />}
                          {sheet.n_output_columns ?? 0} columnas finales
                        </span>
                        <small>{smWorkbookMissingLabel(sheet)}</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className="pulso-sm-family-status is-neutral">
                          <CheckCircle2 size={12} />
                          {sheet.recognized_headers} reconocidos
                        </span>
                        <small>{sheet.unknown_headers.length} dudosos · {sheet.ambiguous_headers.length} ambiguos</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className={`pulso-sm-family-status${sheetHasIssues ? " is-warning" : " is-neutral"}`}>
                          {sheetHasIssues ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {sheet.warnings.length || (sheet.n_cell_errors ?? 0) || "OK"}
                        </span>
                        <small title={smWorkbookSheetIssueTitle(sheet)}>{smWorkbookSheetIssueLabel(sheet)}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {workbookImportResult && (
              <div className="pulso-sm-multibase-warning">
                <CheckCircle2 size={15} />
                <span>
                  Importadas {workbookImportResult.imported_bases} bases desde {workbookImportResult.filename}. Se reemplazaron las respuestas activas y se conservó cada formulario.
                </span>
              </div>
            )}
          </div>
          <SavBundleImportPanel bases={existingBases} disabled={disabled || !!busy} onImported={onImported} />
          <div className="pulso-sm-family-table" role="table" aria-label="Bases hermanas independientes cargadas">
            <div className="pulso-sm-family-row is-head" role="row">
              <span>#</span>
              <span>Base visible</span>
              <span>Fuente original</span>
              <span>Respuestas</span>
              <span>Estado</span>
              <span>Canal</span>
            </div>
            {existingBases.map((base, index) => {
              const alias = String(base.source_alias || base.source_title || base.nombre || "").trim();
              const title = String(base.source_title || base.xlsform_file_name || base.nombre || "").trim();
              const sourceKind = String(base.source_kind || "base cargada").replace(/_/g, " ");
              const importedAt = smCatalogDateLabel(base.imported_at);
              const isActive = base.nombre === estudio.active_base;
              const channel = smBaseChannel(base);
              const channelDetail = smBaseChannelDetail(base);
              const mixedChannel = smBaseHasMixedChannels(base);
              const sourceSummaries = smSourceSummariesFromBase(base);
              const sourceCount = sourceSummaries.length || 1;
              const sourceDetail = channelDetail || channel || "Sin canal";
              const sourceKindLower = String(base.source_kind || "").toLowerCase();
              const isWorkbookSource = sourceKindLower.includes("workbook");
              const canReviewSurveyMonkey = !isWorkbookSource && (
                sourceKindLower.includes("surveymonkey") ||
                !!String(base.survey_id || "").trim() ||
                !!String(base.surveymonkey_raw_snapshot_file_id || "").trim()
              );
              const showSourceDetail = sourceSummaries.length > 1 || isActive || canReviewSurveyMonkey;
              return (
                <div className={`pulso-sm-family-row${isActive ? " is-active" : ""}${showSourceDetail ? " has-source-detail" : ""}`} role="row" key={base.nombre}>
                  <span className="pulso-sm-survey-index">{index + 1}</span>
                  <div className="pulso-sm-family-base-cell">
                    {editingAliasBase === base.nombre ? (
                      <div className="pulso-sm-loaded-alias-editor">
                        <label className="pulso-sm-alias-field is-main">
                          <span>Alias visible</span>
                          <input
                            value={editingAliasDraft}
                            disabled={disabled || !!busy}
                            aria-label={`Editar alias ${base.nombre}`}
                            onChange={(event) => setEditingAliasDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") cancelEditingExistingAlias();
                              if (event.key === "Enter") void saveExistingAlias(base);
                            }}
                          />
                        </label>
                        <div className="pulso-sm-loaded-alias-actions">
                          <button type="button" onClick={() => void saveExistingAlias(base)} disabled={disabled || !!busy || !editingAliasDraft.trim()}>
                            <Check size={12} /> Guardar
                          </button>
                          <button type="button" className="is-ghost" onClick={cancelEditingExistingAlias} disabled={disabled || !!busy}>
                            <XIcon size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pulso-sm-family-base-title">
                        <strong title={alias}>{alias}</strong>
                        {isActive && <span>Activa</span>}
                        <button
                          type="button"
                          className="pulso-sm-inline-edit"
                          onClick={() => startEditingExistingAlias(base)}
                          disabled={disabled || !!busy}
                          aria-label={`Editar alias ${alias}`}
                          title="Editar alias visible"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <small>ID técnico <code>{base.nombre}</code></small>
                  </div>
                  <div className="pulso-sm-family-origin-cell">
                    <strong title={title}>{title}</strong>
                    <small>{sourceKind}{base.survey_id ? ` · Survey ID ${base.survey_id}` : ""} · {importedAt}</small>
                    <small>{sourceCount} fuente{sourceCount === 1 ? "" : "s"} · {sourceDetail}</small>
                  </div>
                  <div className="pulso-sm-family-data-cell">
                    <span className="pulso-sm-family-status">
                      <Database size={12} />
                      {base.n_filas ?? 0} registros válidos
                    </span>
                    <small>{base.n_columnas ?? 0} columnas · completos + consentimiento aprobado</small>
                  </div>
                  <div className="pulso-sm-family-data-cell">
                    <span className="pulso-sm-family-status is-neutral">
                      <Layers size={12} />
                      Independiente
                    </span>
                    <small>Validación, codificación, analítica y gráficos por base</small>
                  </div>
                  <div className="pulso-sm-family-data-cell">
                    {mixedChannel ? (
                      <div className="pulso-sm-channel-readonly">
                        <span>Canales</span>
                        <div>
                          <SmChannelBadge channel={channel || "Mixto"} />
                          {channelDetail ? <small>{channelDetail}</small> : null}
                        </div>
                      </div>
                    ) : (
                      <SmChannelSelect
                        value={channel}
                        disabled={disabled || !!busy}
                        onChange={(value) => void saveExistingChannel(base, value)}
                      />
                    )}
                    {!showSourceDetail ? (
                      <SmConsentSelect
                        base={base}
                        disabled={disabled || !!busy}
                        compact
                        onChange={(value) => void saveExistingConsentVar(base, value)}
                      />
                    ) : null}
                  </div>
                  {showSourceDetail ? (
                    <div className="pulso-sm-family-detail-tray">
                      <div className="pulso-sm-family-detail-head">
                        <span>
                          <GitMerge size={13} />
                          {sourceCount} fuente{sourceCount === 1 ? "" : "s"} conectada{sourceCount === 1 ? "" : "s"}
                        </span>
                        <em>{sourceDetail}</em>
                      </div>
                      <SmSourceSummaryBlock sources={sourceSummaries} />
                      <div className="pulso-sm-family-detail-actions">
                        <div className="pulso-sm-family-detail-controls">
                          <SmConsentSelect
                            base={base}
                            disabled={disabled || !!busy}
                            onChange={(value) => void saveExistingConsentVar(base, value)}
                          />
                          <SmExistingCollectorsEditor
                            base={base}
                            disabled={disabled || !!busy}
                            onSave={saveExistingCollectors}
                          />
                        </div>
                        {canReviewSurveyMonkey ? (
                          <SmDecisionSuite
                            base={base}
                            disabled={false}
                            onRegenerateRaw={runRegenerateSurveyMonkeyRaw}
                            onApplied={async (payload) => {
                              await onImported(payload);
                              window.dispatchEvent(new Event("pulso:session-changed"));
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {refreshPlan && (
            <div className="pulso-sm-family-config" aria-label="Diagnóstico de actualización SurveyMonkey">
              <div className="pulso-sm-family-config-head">
                <strong>Actualización SurveyMonkey</strong>
                <span>
                  {(refreshPlan.bases ?? []).filter((row) => row.updateable).length}/{refreshPlan.bases?.length ?? 0} bases procesables
                  {(refreshPlan.bases ?? []).filter((row) => smRefreshAction(row) === "noop_structure_warning").length
                    ? ` · ${(refreshPlan.bases ?? []).filter((row) => smRefreshAction(row) === "noop_structure_warning").length} sin nuevas con alerta estructural`
                    : ""}
                  {refreshPlan.catalog?.cache_status ? ` · catálogo ${refreshPlan.catalog.cache_status}` : ""}
                </span>
              </div>
              <div className="pulso-sm-refresh-explain">
                <RefreshCw size={14} />
                <span>Actualiza todas las fuentes ya guardadas en cada base, incluyendo combinaciones teléfono + correo cuando existan, y reporta registros válidos nuevos por SurveyMonkey. Para sumar campañas o canales usa Agregar desde SurveyMonkey.</span>
              </div>
              <div className="pulso-sm-family-table is-refresh" role="table" aria-label="Diagnóstico de fuentes SurveyMonkey">
                <div className="pulso-sm-family-row is-head is-refresh-row" role="row">
                  <span>Fuente</span>
                  <span>Respuestas</span>
                  <span>Estructura</span>
                  <span>Resultado</span>
                </div>
                {(refreshPlan.bases ?? []).map((row: SurveyMonkeyRefreshBasePlan) => {
                  const blocking = row.structure?.n_blocking ?? 0;
                  const action = smRefreshAction(row);
                  const noop = smRefreshIsNoop(row);
                  const warningOnly = action === "noop_structure_warning";
                  const structureDetail = smRefreshStructureDetail(row);
                  const collectorSummary = smSpecCollectorSummary(row.source_spec);
                  const refreshSources = smSourceSummariesFromSpec(row.source_spec);
                  const refreshSourcesText = smRefreshSourcesText(refreshSources);
                  return (
                    <div className={`pulso-sm-family-row is-refresh-row${row.updateable ? "" : " is-invalid"}${warningOnly ? " is-warning" : ""}`} role="row" key={row.base_name}>
                      <div className="pulso-sm-family-origin-cell">
                        <strong>{row.source_alias || row.base_name}</strong>
                        <small>
                          <code>{row.base_name}</code> · Survey ID {row.survey_id || "S/D"} · {row.source_count ?? 1} fuente{(row.source_count ?? 1) === 1 ? "" : "s"} actual{(row.source_count ?? 1) === 1 ? "" : "es"}
                        </small>
                        {refreshSourcesText && <small title={refreshSourcesText}>Actualiza base completa: {refreshSourcesText}</small>}
                        {collectorSummary && <small>{collectorSummary}</small>}
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className="pulso-sm-family-status">
                          <Database size={12} />
                          {row.new_rows ?? "S/D"} nuevas
                        </span>
                        <small>{row.current_rows ?? "S/D"} actuales · {row.edited_rows ?? 0} editadas reportadas</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className={`pulso-sm-family-status${blocking ? " is-warning" : " is-neutral"}`}>
                          {blocking ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {blocking
                            ? `${blocking} ${warningOnly ? "alerta" : "bloqueo"}${blocking === 1 ? "" : "s"}`
                            : "Compatible"}
                        </span>
                        {structureDetail && <small title={structureDetail.title}>{structureDetail.label}</small>}
                        <SmEstructuraFuenteAccion diffs={row.structure?.diffs} estudio={estudio} />
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className="pulso-sm-family-status is-neutral">
                          <Layers size={12} />
                          {noop ? "Sin cambios" : row.codificacion?.has_state ? "Se reaplica" : "Sin avance"}
                        </span>
                        <small>{smRefreshRowStatusText(row)}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pulso-sm-family-config-head">
                <span>Agrega solo `response_id` nuevos; las editadas se reportan sin reemplazar datos locales.</span>
                <div className="pulso-sm-family-actions">
                  <button type="button" className="pulso-sm-secondary" disabled={disabled || !!busy} onClick={() => loadRefreshPlan(true)}>
                    <RefreshCw size={13} />
                    Releer diagnóstico
                  </button>
                  <button
                    type="button"
                    disabled={disabled || !!busy || !(refreshPlan.bases ?? []).some((row) => row.updateable)}
                    onClick={runRefreshSurveyMonkey}
                  >
                    {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
                    Actualizar respuestas
                  </button>
                </div>
              </div>
              {refreshResult && (
                <div className="pulso-sm-multibase-warning">
                  <CheckCircle2 size={15} />
                  <div className="pulso-sm-refresh-result-copy">
                    <span>
                      Actualizadas {refreshResult.results.filter((row) => row.ok && !row.skipped).length} bases · {" "}
                      {refreshResult.results.filter((row) => row.ok && row.noop).length} sin cambios · {" "}
                      {refreshResult.results.reduce((sum, row) => sum + Number(row.n_new ?? 0), 0)} registros válidos nuevos · {" "}
                      {(refreshResult.codificacion_jobs ?? []).filter((job) => job.ok && job.job_id).length} jobs de recodificación lanzados.
                    </span>
                    {refreshResult.results.map((row) => {
                      const detail = smRefreshResultSourcesText(row);
                      return detail ? <small key={row.base_name}>{row.base_name}: {detail}</small> : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {koboRefreshResult && (
            <div className="pulso-sm-multibase-warning">
              <CheckCircle2 size={15} />
              <div className="pulso-sm-refresh-result-copy">
                <span>
                  Kobo actualizado: {koboRefreshResult.n_updated_bases} base{koboRefreshResult.n_updated_bases === 1 ? "" : "s"}.
                </span>
                {koboRefreshResult.results.map((row) => (
                  <small key={row.base_name}>
                    {row.base_name}: {row.rows_before} {"->"} {row.rows_after} registros · {row.total_remote} remotos
                  </small>
                ))}
              </div>
            </div>
          )}
          <div className="pulso-sm-family-config-head">
            <span>Para trabajar usa el selector de base activa del lateral. La base de referencia puede sincronizar reglas compatibles.</span>
            <div className="pulso-sm-family-actions">
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || existingKoboBases.length === 0}
                onClick={() => void refreshKoboIndependentBases()}
                title={existingKoboBases.length ? "Actualizar formulario y respuestas desde las fuentes Kobo guardadas" : "No hay bases Kobo conectadas"}
              >
                <RefreshCw size={13} />
                Actualizar Kobo
              </button>
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy}
                onClick={() => loadRefreshPlan(false)}
              >
                <RefreshCw size={13} />
                Actualizar respuestas SurveyMonkey
              </button>
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || estudio.n_bases < 2 || !templateSyncBase}
                onClick={runTemplateLogicSync}
                title={templateSyncBase ? `Usar ${templateSyncBase} como referencia de formulario` : "Primero debe existir una base de referencia en la familia"}
              >
                <GitMerge size={13} />
                Sincronizar reglas
              </button>
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || (capacityLeft <= 0 && !hasExistingIndependentBases)}
                onClick={() => {
                  setError("");
                  setShowSurveyCatalog(true);
                }}
              >
                <Plus size={13} />
                {capacityLeft <= 0 && hasExistingIndependentBases ? "Agregar campaña SurveyMonkey" : capacityLeft <= 0 ? "Límite alcanzado" : "Agregar desde SurveyMonkey"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSurveyCatalog && (
        <div className="pulso-integrated-sm">
        <div className="pulso-sm-token-strip">
          <div className="pulso-sm-token-strip-main">
            <Database size={14} />
            <span>
              <strong>SurveyMonkey</strong>
              {smConnection?.has_token
                ? `Perfil seleccionado: ${smConnection.profiles?.find((profile) => profile.id === selectedSmProfileId)?.alias || smConnection.active_profile_alias || selectedSmProfileId || "Principal"}`
                : "Sin token activo"}
            </span>
            {smConnection?.masked_token && <code>{smConnection.masked_token}</code>}
          </div>
          {!!smConnection?.profiles?.length && (
            <div className="pulso-sm-token-profiles" aria-label="Perfiles SurveyMonkey">
              {smConnection.profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={selectedSmProfileId === profile.id ? "is-active" : ""}
                  disabled={disabled || !!busy || selectedSmProfileId === profile.id || !profile.has_token}
                  onClick={() => selectSurveyMonkeyProfile(profile.id)}
                  title={profile.has_token ? `Usar ${profile.alias}` : `${profile.alias} no tiene token guardado`}
                >
                  {profile.alias}
                </button>
              ))}
            </div>
          )}
          <BotonConfigurarCredenciales sinToken={!smConnection?.has_token} />
        </div>
        <div className="pulso-sm-survey-picker">
          <label className="pulso-sm-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por carrera, nombre o ID" />
          </label>
          <button type="button" className="pulso-sm-secondary" onClick={() => loadSurveys(true)} disabled={!!busy || disabled}>
            {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Actualizar lista
          </button>
        </div>

        {surveys && (
          <>
            <div className="pulso-sm-list-caption">
              {visibleSurveys.length} disponibles de {surveyMeta?.totalRecent ?? surveys.length} encuestas modificadas en los últimos {surveyMeta?.months ?? 6} meses · {selectedInputs.length} bases nuevas · {selectedMergeCampaignCount} campañas/canales · {plannedRemaining} por agregar según el plan
              {hiddenDuplicateSurveys.length ? ` · ${hiddenDuplicateSurveys.length} ocultas por repetidas` : ""}
              {surveyMeta && (
                <> · {surveyMeta.cacheStatus === "stale_fallback" ? "refresco falló; usando catálogo local" : surveyMeta.fromCache ? "catálogo local" : "catálogo actualizado"} {smCatalogDateLabel(surveyMeta.fetchedAt)}</>
              )}
            </div>
            {duplicateSurveyAlert && (
              <div className="pulso-sm-duplicate-alert" role="status">
                <AlertTriangle size={14} />
                <span>{duplicateSurveyAlert}</span>
              </div>
            )}
            <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
              {visibleSurveys.map((item) => {
                const title = smSurveyTitle(item);
                const scopeDraft = scopeDrafts[item.id];
                const aliasPreview = smSurveyAlias(item, scopeDraft);
                const suggestedTargetName = hasExistingIndependentBases ? smBestExistingBaseTarget(item, existingBases) : "";
                const suggestedTarget = suggestedTargetName ? existingBaseByName.get(suggestedTargetName) : null;
                const cannotAdd = capacityLeft <= 0 && !hasExistingIndependentBases;
                const responses = smSurveyResponseLabel(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="pulso-sm-survey-card"
                    onClick={() => toggleSurvey(item)}
                    disabled={disabled || !!busy || cannotAdd}
                    title={title}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{title}</strong>
                      <small>
                        {aliasPreview}
                        {suggestedTarget ? ` · sugerido: agregar a ${smExistingBaseTargetLabel(suggestedTarget)}` : ""}
                      </small>
                      <span className="pulso-sm-survey-card-meta">
                        <b><Database size={11} /> {responses}</b>
                        <i>{smDateLabel(item.date_modified)}</i>
                        <i>ID {item.id}</i>
                      </span>
                    </span>
                    <em>{suggestedTarget ? "Elegir destino" : "Agregar"}</em>
                  </button>
                );
              })}
              {!visibleSurveys.length && (
                <div className="pulso-sm-empty">
                  {hiddenDuplicateSurveys.length
                    ? "Todas las coincidencias ya están cargadas o seleccionadas."
                    : "No hay coincidencias con el filtro actual."}
                </div>
              )}
            </div>
          </>
        )}

        {selectedSurveys.length > 0 && (
            <div className="pulso-sm-family-config">
              <div className="pulso-sm-family-config-head">
              <strong>Selección SurveyMonkey</strong>
              <span>
                {selectedTotal}/{independentMaxBases} bases configuradas
                {selectedMergeCampaignCount ? ` · ${selectedMergeCampaignCount} campaña${selectedMergeCampaignCount === 1 ? "" : "s"} a bases existentes` : ""}
              </span>
            </div>
            <div className="pulso-sm-family-table" role="table" aria-label="Bases hermanas independientes seleccionadas">
              <div className="pulso-sm-family-row is-head" role="row">
                <span>#</span>
                <span>Destino</span>
                <span>Encuesta original</span>
                <span>Respuestas</span>
                <span>Filtros y campañas</span>
                <span aria-hidden="true" />
              </div>
              {selectedSurveys.map((item, index) => {
                const scopeDraft = scopeDrafts[item.id];
                const scope = scopeDraft ?? smDefaultScopeDraft();
                const targetBaseName = scope.targetBaseName || "";
                const targetBase = targetBaseName ? existingBaseByName.get(targetBaseName) : null;
                const isMergeTarget = !!targetBaseName;
                const nSources = 1 + scope.extraSources.filter((source) => source.surveyId.trim()).length;
                const totalSourceResponses = smKnownSourceCount(item, scope, surveys);
                const aliasValue = smAliasDraftValue(item, scopeDraft);
                const aliasSlug = smBaseSlug(aliasValue);
                const aliasInvalid = !isMergeTarget && (!aliasValue.trim() || duplicateAliasSlugs.has(aliasSlug));
                const targetInvalid = isMergeTarget && !targetBase;
                const rowInvalid = aliasInvalid || targetInvalid;
                return (
                  <div className={`pulso-sm-family-row${rowInvalid ? " is-invalid" : ""}`} role="row" key={item.id}>
                    <span className="pulso-sm-survey-index">{index + 1}</span>
                    <div className="pulso-sm-family-base-cell">
                      {hasExistingIndependentBases && (
                        <label className={`pulso-sm-target-field${targetInvalid ? " is-invalid" : ""}`}>
                          <span>Destino</span>
                          <select
                            value={targetBaseName}
                            disabled={disabled || !!busy}
                            aria-label={`Destino para ${item.id}`}
                            onChange={(event) => updateScope(item.id, { targetBaseName: event.target.value })}
                          >
                            <option value="" disabled={capacityLeft <= 0}>
                              Nueva base independiente{capacityLeft <= 0 ? " (sin cupos)" : ""}
                            </option>
                            {existingBases.map((base) => (
                              <option key={base.nombre} value={base.nombre}>
                                Agregar a {smExistingBaseTargetLabel(base)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className={`pulso-sm-alias-field is-main${aliasInvalid ? " is-invalid" : ""}`}>
                        <span>{isMergeTarget ? "Etiqueta de campaña" : "Alias visible"}</span>
                        <input
                          value={aliasValue}
                          disabled={disabled || !!busy}
                          aria-label={`Alias visible ${item.id}`}
                          onChange={(event) => updateAlias(item.id, event.target.value)}
                          onKeyDown={smTextShortcutGuard}
                          onCopy={smClipboardGuard}
                          onCut={smClipboardGuard}
                          onPaste={smClipboardGuard}
                        />
                      </label>
                      {isMergeTarget && targetBase ? (
                        <small className="pulso-sm-target-note">
                          <GitMerge size={11} />
                          Se agregará a <code>{smExistingBaseTargetLabel(targetBase)}</code> como fuente adicional
                        </small>
                      ) : (
                        <small>ID técnico <code>{aliasSlug}</code></small>
                      )}
                      {(aliasInvalid || targetInvalid) && (
                        <em>
                          <AlertTriangle size={12} />
                          {targetInvalid
                            ? "Elige una carrera destino."
                            : !aliasValue.trim()
                              ? "Falta alias."
                              : `ID repetido: ${aliasSlug}`}
                        </em>
                      )}
                    </div>
                    <div className="pulso-sm-family-origin-cell">
                      <strong title={smSurveyTitle(item)}>{smSurveyTitle(item)}</strong>
                      <small>
                        SurveyMonkey · {smDateLabel(item.date_modified)} · {smSurveyResponseLabel(item)} · ID {item.id}
                      </small>
                    </div>
                    <div className="pulso-sm-family-data-cell">
                      <span className="pulso-sm-family-status">
                        <Database size={12} />
                        {nSources} fuente{nSources === 1 ? "" : "s"}
                      </span>
                      <small>{smSourceCountLabel(totalSourceResponses)} · {smScopeSummary(scope, nSources)}</small>
                      {scope.channel && <SmChannelBadge channel={scope.channel} />}
                    </div>
                    <details className="pulso-sm-scope-popover">
                      <summary>
                        <SlidersHorizontal size={13} />
                        Alcance
                      </summary>
                      <div className="pulso-sm-scope-popover-panel" aria-label={`Alcance de importación de ${smSurveyTitle(item)}`}>
                        <div className="pulso-sm-scope-head">
                          <span><Filter size={13} /> Alcance de respuestas</span>
                          <em>SurveyMonkey</em>
                        </div>
                        <div className="pulso-sm-scope-fixed" aria-label="Alcance aplicado">
                          <span>
                            <CheckCircle2 size={14} />
                            Estado
                            <strong>Completas</strong>
                          </span>
                          <span>
                            <Database size={14} />
                            Respuestas
                            <strong>{smSurveyResponseLabel(item)}</strong>
                          </span>
                        </div>
                        <SmCollectorPicker
                          surveyId={item.id}
                          profileId={selectedSmProfileId}
                          value={scope.collectorIds}
                          disabled={disabled || !!busy}
                          onChange={(value) => updateScope(item.id, { collectorIds: value })}
                        />
	                        <div className="pulso-sm-scope-fields is-operational">
	                          <SmChannelSelect
	                            value={scope.channel}
	                            disabled={disabled || !!busy}
	                            onChange={(value) => updateScope(item.id, { channel: value })}
                          />
                          <label className="pulso-sm-scope-field">
                            <span>Tipo de recojo</span>
                            <select
                              value={scope.collectionStrategy}
                              disabled={disabled || !!busy}
                              onChange={(event) => updateScope(item.id, {
                                collectionStrategy: event.target.value as SmImportScopeFields["collectionStrategy"],
                              })}
                            >
                              <option value="campo">Campo</option>
                              <option value="whatsapp_link">WhatsApp / link autoadministrado</option>
                              <option value="web_link">Enlace web</option>
                              <option value="email">Correo</option>
                              <option value="otro">Otro</option>
	                            </select>
	                          </label>
	                        </div>
	                        <label className="pulso-sm-scope-field pulso-sm-actor-logic-field">
	                          <span>Reglas de este actor</span>
	                          <textarea
	                            value={scope.logicRules}
	                            disabled={disabled || !!busy}
	                            rows={2}
	                            placeholder="Opcional: Q1 != C1 => Ocultar P2 (oculta la pregunta 2)."
	                            onChange={(event) => {
	                              updateScope(item.id, { logicRules: event.target.value });
	                              setSurveyMonkeyLogicPreview(null);
	                            }}
	                          />
	                          <small>Úsalo si este actor agregó una pregunta previa y cambió el orden de los saltos.</small>
	                        </label>

	                        <div className="pulso-sm-extra-sources">
                          {scope.extraSources.map((source, sourceIndex) => {
                            const pickedSurvey = smSurveyById(surveys, source.surveyId);
                            const excludeIds = new Set([
                              ...Array.from(blockedSurveyIds),
                              ...scope.extraSources
                                .filter((other) => other.key !== source.key)
                                .map((other) => other.surveyId.trim())
                                .filter(Boolean),
                            ]);
                            const sourceQuery = source.query ?? "";
                            const candidates = smExtraSourceCandidates(surveys, sourceQuery || source.surveyId, excludeIds, item);
                            return (
                              <div className="pulso-sm-extra-source" key={source.key}>
                                <div className="pulso-sm-extra-source-top">
                                  <span className="pulso-sm-extra-source-index">Campaña {sourceIndex + 2}</span>
                                  <button
                                    type="button"
                                    className="pulso-icon pulso-icon-danger"
                                    onClick={() => removeExtraSource(item.id, source.key)}
                                    aria-label={`Quitar fuente adicional ${sourceIndex + 1}`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <label className="pulso-sm-extra-search">
                                  <span>Buscar encuesta o pegar ID</span>
                                  <div>
                                    <Search size={14} />
                                    <input
                                      value={source.query ?? source.surveyId}
                                      disabled={disabled || !!busy}
                                      placeholder="Busca por carrera, campaña, fecha o ID"
                                      aria-label={`Buscar campaña adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, {
                                        query: event.target.value,
                                        surveyId: /^\d+$/.test(event.target.value.trim()) ? event.target.value.trim() : "",
                                      })}
                                    />
                                  </div>
                                </label>
                                <div className="pulso-sm-extra-results" aria-label={`Resultados campaña adicional ${sourceIndex + 1}`}>
                                  {pickedSurvey && (
                                    <div className="pulso-sm-extra-picked">
                                      <Database size={13} />
                                      <span>
                                        <strong>{smSurveyTitle(pickedSurvey)}</strong>
                                        <small>{smSurveyResponseLabel(pickedSurvey)} · {smDateLabel(pickedSurvey.date_modified)} · ID {pickedSurvey.id}</small>
                                      </span>
                                    </div>
                                  )}
                                  {candidates.length > 0 ? candidates.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      disabled={disabled || !!busy}
                                      onClick={() => selectExtraSource(item.id, source.key, candidate)}
                                    >
                                      <span className="pulso-sm-extra-result-copy">
                                        <strong>{smSurveyTitle(candidate)}</strong>
                                        <small>{smSurveyDefaultAlias(candidate)} · {smDateLabel(candidate.date_modified)} · ID {candidate.id}</small>
                                      </span>
                                      <em>{smSurveyResponseLabel(candidate)}</em>
                                    </button>
                                  )) : (
                                    <small className="pulso-sm-extra-empty">Sin coincidencias en el catálogo local. Puedes pegar un ID manualmente.</small>
                                  )}
                                </div>
                                <div className="pulso-sm-extra-advanced">
                                  <SmCollectorPicker
                                    surveyId={source.surveyId}
                                    profileId={selectedSmProfileId}
                                    value={source.collectorIds}
                                    disabled={disabled || !!busy || !source.surveyId.trim()}
                                    label="Recopiladores"
                                    onChange={(value) => updateExtraSource(item.id, source.key, { collectorIds: value })}
                                  />
                                  <label>
                                    <span>Etiqueta</span>
                                    <input
                                      value={source.label}
                                      disabled={disabled || !!busy}
                                      placeholder={pickedSurvey ? smSurveyDefaultAlias(pickedSurvey) : "Etiqueta opcional"}
                                      aria-label={`Etiqueta fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { label: event.target.value })}
                                      onKeyDown={smTextShortcutGuard}
                                      onCopy={smClipboardGuard}
                                      onCut={smClipboardGuard}
                                      onPaste={smClipboardGuard}
                                    />
                                  </label>
                                  <SmChannelSelect
                                    value={source.channel}
                                    disabled={disabled || !!busy}
                                    onChange={(value) => updateExtraSource(item.id, source.key, { channel: value })}
                                  />
                                  <label>
                                    <span>Recojo</span>
                                    <select
                                      value={source.collectionStrategy}
                                      disabled={disabled || !!busy}
                                      aria-label={`Tipo de recojo fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, {
                                        collectionStrategy: event.target.value as SmImportScopeFields["collectionStrategy"],
                                      })}
                                    >
                                      <option value="campo">Campo</option>
                                      <option value="whatsapp_link">WhatsApp / link</option>
                                      <option value="web_link">Enlace web</option>
                                      <option value="email">Correo</option>
                                      <option value="otro">Otro</option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            className="pulso-sm-secondary pulso-sm-add-source"
                            disabled={disabled || !!busy}
                            onClick={() => addExtraSource(item.id)}
                          >
                            <Plus size={13} />
                            Agregar campaña o fuente
                          </button>
                        </div>
                      </div>
                    </details>
                    <button type="button" className="pulso-icon pulso-icon-danger" onClick={() => toggleSurvey(item)} aria-label={`Quitar ${item.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {overIndependentLimit && (
        <div className="pulso-sm-multibase-warning">
          <AlertTriangle size={15} />
          Seleccionaste {selectedInputs.length} encuestas y quedan {plannedRemaining} por agregar. Este plan admite máximo {independentMaxBases} bases.
        </div>
      )}

      {shouldShowSurveyMonkeyActions && (
        <div className="pulso-sm-multibase-actions">
          <button type="button" className="pulso-sm-secondary" disabled={!selectedInputs.length || !!busy || disabled} onClick={runAudit}>
            {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Auditar nuevas bases
          </button>
          <button type="button" className="pulso-sm-primary" disabled={!canImport} onClick={runImport}>
            {selectedMergeCampaignCount && !selectedInputs.length ? <GitMerge size={14} /> : <Layers size={14} />}
            {selectedInputs.length && selectedMergeCampaignCount
              ? "Importar y agregar campañas"
              : selectedMergeCampaignCount
                ? "Agregar como campañas/canales"
                : "Importar como fuentes independientes"}
          </button>
        </div>
      )}

      {busy && <div className="pulso-sm-status"><Loader2 size={13} className="pulso-spin" /> {busy}</div>}
      {error && <ErrorBlock label="No se pudo completar la importación" detail={error} />}

      {logicSync && (
        <div className={`pulso-sm-logic-sync${logicSync.ok === false ? " is-warning" : ""}`}>
          <div className="pulso-sm-logic-sync-head">
            {logicSync.ok === false ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <strong>{logicSync.ok === false ? "Importación hecha; reglas pendientes" : "Reglas sincronizadas"}</strong>
            <span>
              Referencia <code>{logicSync.template_base}</code> · {logicSync.n_updated_bases ?? 0}/{logicSync.n_targets ?? 0} bases actualizadas
            </span>
          </div>
          {logicSync.error && <p>{logicSync.error}</p>}
          {!!logicSync.results?.length && (
            <div className="pulso-sm-logic-sync-grid">
              {logicSync.results.slice(0, 6).map((row) => (
                <div key={row.base} className="pulso-sm-logic-sync-row">
                  <strong>{row.base}</strong>
                  <span>{row.n_applied_variables} variables · {row.changed_cells} celdas</span>
                  <small>
                    {row.n_skipped_missing_variables
                      ? `${row.n_skipped_missing_variables} variables no existen en esta base`
                      : "Sin variables faltantes"}
                    {row.n_missing_references ? ` · ${row.n_missing_references} referencias huérfanas` : ""}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {audit && (() => {
        const totalResponses = audit.surveys.reduce((sum, item) => sum + (item.n_responses ?? 0), 0);
        const pageLabel = smNumberRangeLabel(audit.surveys.map((item) => item.n_pages), "página");
        const questionLabel = smNumberRangeLabel(audit.surveys.map((item) => item.n_questions), "pregunta");
        const refLabel = smSurveyAuditLabel(audit.ref_survey_id, audit, selectedInputs);
        return (
          <div className="pulso-integrated-audit">
            <div className="pulso-sm-audit-banner is-ok">
              <CheckCircle2 size={16} />
              <strong>Familia auditada</strong>
              <span>
                {audit.surveys.length} bases · guía: {refLabel}
              </span>
            </div>
            <div className="pulso-sm-family-evidence" aria-label="Puntos comunes de la familia">
              <span><b>{totalResponses}</b> respuestas visibles</span>
              <span>{pageLabel}</span>
              <span>{questionLabel}</span>
              <span><b>{audit.n_review + audit.n_special + audit.n_blocking}</b> diferencias informativas</span>
            </div>
            <div className="pulso-sm-audit-table">
              {audit.surveys.map((survey) => (
                <div key={survey.survey_id} className="pulso-sm-audit-survey">
                  <Database size={14} />
                  <span>
                    <strong title={survey.title}>{smSurveyAuditLabel(survey.survey_id, audit, selectedInputs)}</strong>
                    <span>
                      {survey.n_responses ?? 0} respuestas · {survey.n_pages} páginas · {survey.n_questions} preguntas
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="pulso-integrated-diff-list">
              {audit.diffs.slice(0, 12).map((diff, index) => (
                <div key={`${diff.survey_id}-${diff.pos}-${index}`} className={`pulso-integrated-diff is-${diff.severity}`}>
                  <div>
                    <strong>
                      <span>{smDiffKindLabel(diff.kind)} · {smSurveyAuditLabel(diff.survey_id, audit, selectedInputs)}</span>
                      <em>{smDiffSeverityLabel(diff.severity, diff.kind)}</em>
                    </strong>
                    <span>{diff.message}</span>
                    <SmEstructuraFuenteAccion diffs={[diff]} estudio={estudio} />
                    <small>
                      <code>{diff.variable}</code>
                      {diff.ref && ` · guía: ${diff.ref}`}
                      {diff.current && ` · base: ${diff.current}`}
                    </small>
                  </div>
                </div>
              ))}
              {!audit.diffs.length && <div className="pulso-sm-empty">La auditoría no encontró diferencias relevantes entre las encuestas seleccionadas.</div>}
            </div>
          </div>
        );
      })()}
    </section>
  );
}

// =====================================================================
// IntegratedHistoryPanel — bitácora persistida de una integración cerrada
// =====================================================================

