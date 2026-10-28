import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BotonConfigurarCredenciales } from "./BotonConfigurarCredenciales";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  GitMerge,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Pencil,
  X as XIcon,
} from "lucide-react";
import {
  apiCargaExportNormalized,
  apiCargaImportKoboIndependentAsync,
  apiCargaRefreshKoboIndependentAsync,
  apiConnectionTokenLoad,
  apiEstudioApplyIndependentTemplateLogic,
  apiEstudioDowngradeToSingle,
  apiEstudioGet,
  apiEstudioProcessingSuggestions,
  apiEstudioPromoteIndependentSiblings,
  apiEstudioRemoveBase,
  apiEstudioRenameBase,
  apiEstudioReplaceBaseFiles,
  apiEstudioSetNombre,
  apiEstudioUpdateBaseMetadata,
  apiSurveyMonkeyMultibaseAudit,
  apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic,
  apiSurveyMonkeyMultibaseCollectors,
  apiSurveyMonkeyMultibaseDecisionApply,
  apiSurveyMonkeyMultibaseDecisionPreview,
  apiSurveyMonkeyMultibaseImportIndependentAsync,
  apiSurveyMonkeyMultibaseListSurveys,
  apiSurveyMonkeyMultibaseRefreshAsync,
  apiSurveyMonkeyMultibaseRefreshPlan,
  apiSurveyMonkeyMultibaseWorkbookImport,
  apiSurveyMonkeyMultibaseWorkbookInspect,
  apiXlsformEditorSmInterpretRule,
  apiUpload,
  downloadUrl,
  uploadKindForDataFile,
} from "../../api/client";
import type {
  ConnectionTokenState,
  EstudioBase,
  EstudioLogicSyncResult,
  EstudioMultiIntegratedOrigin,
  EstudioPayload,
  EstudioProcessingSuggestionGroup,
  EstudioProcessingSuggestions,
  KoboIndependentImportResult,
  KoboIndependentRefreshResult,
  KoboIndependentAssetInput,
  SurveyMonkeyMultibaseSurveyInput,
  SurveyMonkeyMultibaseAudit,
  SurveyMonkeyMultibaseCollector,
  SurveyMonkeyDecisionAudit,
  SurveyMonkeyDecisionPolicy,
  SurveyMonkeyMultibaseImportIndependentResult,
  SurveyMonkeyMultibaseListItem,
  SurveyMonkeyRefreshBasePlan,
  SurveyMonkeyRefreshPlan,
  SurveyMonkeyRefreshResult,
  SurveyMonkeyWorkbookImportResult,
  SurveyMonkeyWorkbookInspection,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";
import { RepeatBadge } from "../../components/RepeatBadge";
import { Switch } from "../../components/Switch";
import { isRepeatChildBase } from "../../lib/repeatIdentity";
import { esperarResultadoImport, textoDeProgresoImport } from "./importEnSegundoPlano";
import { IntegratedInstrumentsWizard } from "./IntegratedInstrumentsWizard";
import { SavBundleImportPanel } from "./SavBundleImportPanel";
import { CargaManualBaseLanes } from "./CargaManualBaseLanes";
import { useCargaStore } from "./store";
import { SmEstructuraFuenteAccion } from "./SmEstructuraFuenteAccion";
import { smDiffKindLabel, smDiffSeverityLabel, smRefreshAction, smRefreshStructureDetail } from "./smEstructuraFuente";
import type {
  MultiBaseStrategy,
  SmExtraSourceDraft,
  SmImportScopeDraft,
  SmImportScopeFields,
} from "./store";

import {
  SM_DEFAULT_BASE_URL,
  fileLabel,
  importedAtLabel,
  independentSiblingsCapacity,
  independentSiblingsCapacityLabel,
  integratedHistoryArray,
  integratedLabelOverrideGroups,
  integratedStandardLabelEntries,
  integratedVariantGroups,
  koboAssetIdsFromBase,
  koboMonitoringSuggestionCanImport,
  koboMonitoringSuggestionInput,
  koboMonitoringSuggestionPrimarySource,
  responseFilterLabel,
  smAliasDraftValue,
  smBaseChannel,
  smBaseChannelDetail,
  smBaseConsentVar,
  smBaseHasMixedChannels,
  smBaseSlug,
  smBestExistingBaseTarget,
  smCatalogDateLabel,
  smChannelIcon,
  smChannelKey,
  smChannelLabel,
  smChannelOptions,
  smClipboardGuard,
  smCollectorCacheKey,
  smCollectorCatalogCache,
  smCollectorDisplayName,
  smCollectorFriendlyName,
  smCollectorResponseLabel,
  smCollectorTypeLabel,
  smConsentFilterInfo,
  smConsentOptions,
  smDateLabel,
  smDecisionAuditReady,
  smDecisionCaseDecisionLabel,
  smDecisionCaseRows,
  smDecisionCollectorIsTest,
  smDecisionCollectorOptions,
  smDecisionCollectorStateClass,
  smDecisionCollectorStateLabel,
  smDecisionCompareLabel,
  smDecisionCompareTone,
  smDecisionDownstreamLabels,
  smDecisionDuplicateEvidenceLine,
  smDecisionDuplicateOptionLabel,
  smDecisionDuplicateOptions,
  smDecisionInitialPolicy,
  smDecisionNumber,
  smDecisionOptionalNumber,
  smDecisionPercentLabel,
  smDecisionPolicyFingerprint,
  smDecisionPolicyForSurveyMonkeyCommit,
  smDecisionProgressWidth,
  smDecisionQuestionOptionLabel,
  smDecisionRowsDeltaLabel,
  smDecisionRowsDeltaTone,
  smDecisionRowsImpactText,
  smDecisionRowsLabel,
  smDecisionSourceName,
  smDecisionTextToValues,
  smDecisionValidCollectorIds,
  smDecisionValuesToText,
  smDecisionVariableOptions,
  smDefaultScopeDraft,
  smDefaultScopeFields,
  smDuplicateSurveyAlert,
  smExistingBaseTargetLabel,
  smExtraSourceCandidates,
  smIndependentBaseTitle,
  smIndependentSurveyInput,
  smIndependentTemplateBase,
  smKnownSourceCount,
  smLogicPreviewRow,
  smMergeSuggestionCatalog,
  smMonitoringSuggestionCanImport,
  smMonitoringSuggestionPrimarySource,
  smMonitoringSuggestionScope,
  smNewScopeKey,
  smNumberRangeLabel,
  smRefreshIsNoop,
  smRefreshResultSourcesText,
  smRefreshRowStatusText,
  smRefreshSourcesText,
  smScopeSummary,
  smScopeValueFromCollectorIds,
  smSelectedCampaignInputs,
  smShortQuestionLabel,
  smSourceCollectorLabel,
  smSourceCountLabel,
  smSourceMetricLabel,
  smSourceSummariesFromBase,
  smSourceSummariesFromSpec,
  smSpecCollectorSummary,
  smSpecDraftFromBase,
  smSpecSources,
  smSpecWithConsentVar,
  smSpecWithPrimaryChannel,
  smSpecWithSourceCollectors,
  smSplitScopeList,
  smStringList,
  smSuggestedSurveyMonkeyLogicRulesFromMonitoring,
  smSuggestionResponseLabel,
  smSurveyAlias,
  smSurveyAuditLabel,
  smSurveyById,
  smSurveyCatalogAvailability,
  smSurveyDefaultAlias,
  smSurveyDefaultChannel,
  smSurveyIdsFromBase,
  smSurveyMonkeyLogicPreviewEntries,
  smSurveyMonkeyLogicPreviewNeedsReview,
  smSurveyResponseLabel,
  smSurveySpecificLogicRulesBySurvey,
  smSurveyTitle,
  smTextShortcutGuard,
  smToggleCollectorId,
  smWorkbookInspectionCanImport,
  smWorkbookInspectionCellErrorCount,
  smWorkbookInspectionWarningCount,
  smWorkbookMissingLabel,
  smWorkbookSheetIssueLabel,
  smWorkbookSheetIssueTitle,
} from "./surveymonkey/smBasesModel";
import type {
  IconCmp,
  SmDecisionCaseRow,
  SmLogicPreviewEntry,
  SmLogicPreviewRow,
  SmSourceSummary,
} from "./surveymonkey/smBasesModel";
export {
  INDEPENDENT_SIBLINGS_MAX_BASES,
  independentSiblingsCapacity,
  independentSiblingsCapacityLabel,
  integratedHistoryArray,
  integratedLabelOverrideEntries,
  integratedLabelOverrideGroups,
  integratedStandardLabelEntries,
  integratedVariantGroups,
  integratedVariantRows,
  smBaseChannel,
  smBaseChannelDetail,
  smBestExistingBaseTarget,
  smCampaignInputFromSurvey,
  smDecisionCaseRows,
  smDecisionCollectorIsTest,
  smDecisionDuplicateEvidenceLine,
  smDecisionPolicyFingerprint,
  smDecisionPolicyForSurveyMonkeyCommit,
  smDecisionValidCollectorIds,
  smIndependentSurveyInput,
  smSourceSummariesFromBase,
  smSpecWithConsentVar,
  smSpecWithSourceCollectors,
  smSuggestedSurveyMonkeyLogicRulesFromMonitoring,
  smSurveyCatalogAvailability,
  smSurveyMonkeyLogicPreviewEntries,
  smSurveyMonkeyLogicPreviewNeedsReview,
  smSurveyMonkeyLogicRuleLines,
  smSurveyResponseCount,
  smSurveyResponseLabel,
  smSurveySpecificLogicRulesBySurvey,
  smWorkbookInspectionCanImport,
  smWorkbookInspectionCellErrorCount,
  smWorkbookInspectionWarningCount,
  smXlsformVariableLabelLookup,
} from "./surveymonkey/smBasesModel";

export {
  smSavBundleInspectionCanImport,
  smSavBundleInspectionWarningCount,
  smSavBundleIssueGroups,
  smSavBundleVariableLabel,
} from "./savBundleImportModel";

// Panel de bases del estudio (multi-base nativo).
//
// Se renderiza cuando la sesión ya tiene un estudio con ≥ 1 base real
// (ej. tras cargar un demo multi-base como Acreditación, o tras crear
// un estudio manualmente con `apiEstudioAddBase`). Reemplaza a los
// UploadCards single-base de CargaPage en ese caso.
//
// Acciones:
//  - Renombrar el estudio completo y cada base.
//  - Quitar cada base del estudio.
//  - Reemplazar los archivos (XLSForm y/o data) de una base existente.
//  - Agregar una base nueva subiendo su par (XLSForm + data). Nombre
//    opcional — si no se provee, el backend lo auto-nombra (base_N).
//  - "Volver a carga simple" cuando queda 1 sola base: degrada el
//    estudio y restaura el flujo single-base sin perder los archivos.
//
// Las bases tienen nombre único que se usa como prefijo en la notación
// `"fuente$variable"` de los slides — por eso el rename tiene impacto
// downstream que el usuario verá inmediatamente en Gráficos.

type Props = {
  estudio: EstudioPayload;
  plannedInputCount: number;
  onChanged: (payload: EstudioPayload) => Promise<void>;
  /** Si `true`, abre automáticamente el form "Agregar base" al montar.
      Útil cuando el usuario llega acá tras un "+ Agregar otra base" en
      la carga simple y queremos evitarle un click extra. */
  autoOpenAdd?: boolean;
  hasSessionXlsform?: boolean;
  /** Callback que disparamos una vez que consumimos el auto-open, para
      que el parent lo resetee (ej. React.StrictMode no vuelva a abrir). */
  onAutoOpenConsumed?: () => void;
  /** Callback tras degradar multi-base → single-base. El parent debe
      refrescar el state de sesión y limpiar la referencia al estudio. */
  onDowngraded?: () => Promise<void>;
  initialStrategy?: MultiBaseStrategy;
};

const MULTI_BASE_STRATEGY_COPY: Record<MultiBaseStrategy, { label: string; detail: string }> = {
  separate: {
    label: "Mantener bases separadas",
    detail: "formularios y respuestas por base",
  },
  integrated: {
    label: "Unificar bases compatibles",
    detail: "formulario común y base final",
  },
  independent: {
    label: "Fuentes independientes",
    detail: "entregables por encuesta",
  },
};

type SmCanonicalOption = {
  fileId: string;
  label: string;
};

export function BasesPanel({
  estudio, plannedInputCount, onChanged, autoOpenAdd, hasSessionXlsform, onAutoOpenConsumed, onDowngraded, initialStrategy,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [replacingFiles, setReplacingFiles] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editingEstudioNombre, setEditingEstudioNombre] = useState(false);
  const [estudioDraft, setEstudioDraft] = useState("");
  // Mesa de trabajo multi-base: vive en useCargaStore (features/carga/store.ts)
  // para sobrevivir a la navegación dentro del proyecto; los efectos de abajo
  // la re-derivan del estudio persistido (processing_mode / integración).
  const strategy = useCargaStore((s) => s.strategy);
  const setStrategy = useCargaStore((s) => s.setStrategy);
  const showNewIntegration = useCargaStore((s) => s.showNewIntegration);
  const setShowNewIntegration = useCargaStore((s) => s.setShowNewIntegration);

  // Consumir la señal de auto-open una sola vez al montar/recibir true.
  useEffect(() => {
    if (autoOpenAdd) {
      setStrategy("separate");
      onAutoOpenConsumed?.();
    }
  }, [autoOpenAdd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialStrategy) return;
    setStrategy(initialStrategy);
    setShowNewIntegration(false);
  }, [initialStrategy]);

  const bases = Object.values(estudio.bases);
  const integratedBases = bases.filter((base) => !!base.multi_integrated);
  const integratedSignature = integratedBases
    .map((base) => `${base.nombre}:${base.multi_integrated?.imported_at ?? ""}:${base.multi_integrated?.origin_key_name ?? ""}`)
    .join("|");
  const canonicalOptionsRaw = [
    ...(hasSessionXlsform ? [{ fileId: "", label: "Formulario cargado en Carga/Editor" }] : []),
    ...bases.map((base) => ({ fileId: base.xlsform_file_id, label: `${base.nombre} · formulario` })),
  ];
  const canonicalOptionKeys = new Set<string>();
  const canonicalOptions = canonicalOptionsRaw.filter((option) => {
    const key = option.fileId || "session-xlsform";
    if (canonicalOptionKeys.has(key)) return false;
    canonicalOptionKeys.add(key);
    return true;
  });

  useEffect(() => {
    if (estudio.processing_mode === "independent_siblings") {
      setStrategy("independent");
      setShowNewIntegration(false);
      return;
    }
    if (integratedBases.length > 0) {
      setStrategy("integrated");
      setShowNewIntegration(false);
    }
    // Solo reacciona cuando cambia la integración persistida del estudio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integratedSignature, estudio.processing_mode]);

  async function handleRemoveBase(nombre: string) {
    if (!window.confirm(
      `¿Quitar la base "${nombre}"?\n\nSus datos y su instrumento se descartan. Si un slide de gráficos usa variables con prefijo "${nombre}$", van a quedar huérfanas.`
    )) return;
    setError(""); setBusy(`Quitando ${nombre}…`);
    try {
      await apiEstudioRemoveBase(nombre);
      const p = await apiEstudioGet();
      await onChanged(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleRenameBase(nombreActual: string) {
    const nuevo = renameDraft.trim();
    if (!nuevo || nuevo === nombreActual) {
      setRenaming(null);
      return;
    }
    setError(""); setBusy(`Renombrando ${nombreActual} → ${nuevo}…`);
    try {
      const p = await apiEstudioRenameBase(nombreActual, nuevo);
      await onChanged(p);
      setRenaming(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDowngrade() {
    // Volver a carga simple: disponible con 0 o 1 bases.
    if (bases.length > 1) return;
    // Con 0 bases no hay nada que confirmar — solo apaga el modo.
    if (bases.length === 1 && !window.confirm(
      `¿Volver al modo de carga simple?\n\nEl estudio con varias bases se cierra. ` +
      `Los archivos (formulario + respuestas) quedan como carga simple y puedes ` +
      `seguir trabajando normalmente.`
    )) return;
    setError(""); setBusy("Volviendo a carga simple…");
    try {
      await apiEstudioDowngradeToSingle();
      await onDowngraded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleDiscardEstudio() {
    // Destruir el estudio cuando hay >1 bases — es irreversible, así
    // que pedimos confirmación fuerte con el nombre escrito.
    const confirm1 = window.confirm(
      `¿Descartar el estudio completo?\n\n` +
      `Se quitarán las ${bases.length} bases y sus datos. ` +
      `Esto NO se puede deshacer.\n\n¿Continuar?`
    );
    if (!confirm1) return;
    setError(""); setBusy("Descartando estudio…");
    try {
      // Quitar todas las bases una a una. El backend se encarga del
      // cleanup de estudio cuando la última base sale.
      for (const b of bases) {
        await apiEstudioRemoveBase(b.nombre);
      }
      await onDowngraded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleEstudioNombre() {
    const nuevo = estudioDraft.trim();
    if (!nuevo || nuevo === (typeof estudio.nombre === "string" ? estudio.nombre : null)) {
      setEditingEstudioNombre(false);
      return;
    }
    setError(""); setBusy(`Guardando nombre…`);
    try {
      const p = await apiEstudioSetNombre(nuevo);
      await onChanged(p);
      setEditingEstudioNombre(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function handleExportBase(nombre: string) {
    setError(""); setBusy(`Preparando base normalizada de ${nombre}…`);
    try {
      const out = await apiCargaExportNormalized("xlsx", nombre);
      window.location.href = downloadUrl(out.file_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="pulso-multibase-study-shell">
      <header className="pulso-multibase-study-head">
        <span className="pulso-multibase-study-icon" aria-hidden="true">
          <Layers size={18} />
        </span>
        <div className="pulso-multibase-study-copy">
          <div className="pulso-multibase-study-kicker">Varias bases</div>
          {editingEstudioNombre ? (
            <div className="pulso-multibase-study-edit">
              <input
                autoFocus
                type="text"
                value={estudioDraft}
                onChange={(e) => setEstudioDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleEstudioNombre();
                  if (e.key === "Escape") setEditingEstudioNombre(false);
                }}
                onBlur={() => void handleEstudioNombre()}
                placeholder="Nombre del estudio"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEstudioDraft(typeof estudio.nombre === "string" ? estudio.nombre : "");
                setEditingEstudioNombre(true);
              }}
              title="Renombrar estudio"
              className="pulso-multibase-study-title"
            >
              {(typeof estudio.nombre === "string" && estudio.nombre) || "Sin nombre"}
              <Pencil size={11} />
            </button>
          )}
          <div className="pulso-multibase-study-note">
            La estrategia se definió en Plan; aquí incorporas y mantienes sus fuentes.
          </div>
        </div>
        <span className="pulso-multibase-study-count">
          {estudio.n_bases} {estudio.n_bases === 1 ? "base" : "bases"}
        </span>

        {/* Acción de salida contextual:
            - 0 o 1 base: "Volver a carga simple" (no destructivo).
            - ≥2 bases: descartar el estudio multibase completo (confirmación). */}
        {bases.length <= 1 ? (
          <button
            type="button"
            onClick={handleDowngrade}
            disabled={!!busy}
            title="Volver a una sola base conservando los archivos cargados"
            className="pulso-multibase-study-action is-primary"
          >
            <ArrowLeft size={11} /> Volver a una base
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDiscardEstudio}
            disabled={!!busy}
            title="Descartar el estudio multibase y quitar todas sus bases"
            className="pulso-multibase-study-action is-danger"
          >
            <XIcon size={11} /> Descartar estudio
          </button>
        )}
      </header>

      <div
        className={`pulso-multi-strategy is-locked is-${strategy}`}
        aria-label="Forma de trabajar varias bases"
        role="status"
      >
        <span className="pulso-multi-strategy-lock" aria-hidden="true">
          {strategy === "integrated" ? <GitMerge size={15} /> : strategy === "independent" ? <Cloud size={15} /> : <Layers size={15} />}
        </span>
        <span className="pulso-multi-strategy-label">
          <small>Estrategia fijada en Plan</small>
          <strong>{MULTI_BASE_STRATEGY_COPY[strategy].label}</strong>
          <span>{MULTI_BASE_STRATEGY_COPY[strategy].detail}</span>
        </span>
      </div>

      {strategy === "integrated" && (
        integratedBases.length > 0 && !showNewIntegration ? (
          <IntegratedHistoryPanel
            bases={integratedBases}
            disabled={!!busy}
            onNewIntegration={() => setShowNewIntegration(true)}
          />
        ) : (
          <IntegratedInstrumentsWizard
            canonicalOptions={canonicalOptions}
            plannedInputCount={plannedInputCount}
            disabled={!!busy}
            onImported={async (payload) => {
              await onChanged(payload);
              setStrategy("integrated");
              setShowNewIntegration(false);
            }}
          />
        )
      )}

      {strategy === "independent" && (
        <IndependentSiblingsSurveyMonkeyWizard
          estudio={estudio}
          plannedInputCount={plannedInputCount}
          canonicalOptions={canonicalOptions}
          disabled={!!busy}
          onImported={async (payload) => {
            await onChanged(payload);
            window.dispatchEvent(new Event("pulso:session-changed"));
            window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
              detail: { active: payload.active_base, processing_mode: payload.processing_mode },
            }));
          }}
        />
      )}

      {strategy === "separate" && (
        <CargaManualBaseLanes
          plannedInputCount={plannedInputCount}
          bases={bases}
          disabled={!!busy || estudio.n_bases >= estudio.max_bases}
          onChanged={onChanged}
          renderMaterializedBase={(b) => (
            <div>
              <BaseRow
                base={b}
                isRenaming={renaming === b.nombre}
                renameDraft={renameDraft}
                onStartRename={() => { setRenameDraft(b.nombre); setRenaming(b.nombre); }}
                onRenameChange={setRenameDraft}
                onRenameCommit={() => handleRenameBase(b.nombre)}
                onRenameCancel={() => setRenaming(null)}
                onRemove={() => handleRemoveBase(b.nombre)}
                onStartReplace={() => setReplacingFiles(b.nombre)}
                onExport={() => void handleExportBase(b.nombre)}
                isReplacing={replacingFiles === b.nombre}
                busy={!!busy}
              />
              {replacingFiles === b.nombre ? (
                <ReplaceFilesForm
                  baseNombre={b.nombre}
                  onSubmit={async ({ xlsformFileId, dataFileId }) => {
                    setError(""); setBusy(`Reemplazando archivos de ${b.nombre}…`);
                    try {
                      const payload = await apiEstudioReplaceBaseFiles(b.nombre, {
                        xlsform_file_id: xlsformFileId || undefined,
                        data_file_id: dataFileId || undefined,
                      });
                      await onChanged(payload);
                      setReplacingFiles(null);
                    } catch (reason) {
                      setError((reason as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                  onCancel={() => setReplacingFiles(null)}
                />
              ) : null}
            </div>
          )}
        />
      )}

      {busy && (
        <div className="pulso-multibase-study-feedback" aria-live="polite">
          {busy}
        </div>
      )}
      {error && (
        <div className="pulso-multibase-study-error">
          <ErrorBlock label="No se pudo completar" detail={error} />
        </div>
      )}
    </section>
  );
}

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
          {nearCompleteTotal > 0 ? ` · ${nearCompleteTotal} casi completa${nearCompleteTotal === 1 ? "" : "s"}` : ""}
          {manualTotal > 0 ? ` · ${manualTotal} rescate${manualTotal === 1 ? "" : "s"}` : ""}
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
              {collector.label} · {collector.observed} obs. · {collector.total} casos
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
                  {row.nearComplete && <span className="pulso-sm-case-badge is-near">Casi completa</span>}
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
        <div className="pulso-sm-case-empty">
          <Search size={13} />
          <span>{emptyCopy}</span>
        </div>
      )}
      {smDecisionNumber(audit?.case_rows_omitted) > 0 && (
        <p>{smDecisionNumber(audit?.case_rows_omitted)} casos adicionales quedan fuera de esta vista rápida.</p>
      )}
    </details>
  );
}

function SmDecisionSuite({
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
        <div className="pulso-sm-decision-empty">
          <AlertTriangle size={14} />
          <span>Esta base no tiene respaldo de respuestas descargadas. Regenera desde SurveyMonkey para recalcular reglas.</span>
          {onRegenerateRaw && (
            <button
              type="button"
              className="pulso-sm-secondary"
              disabled={disabled || !!busy}
              onClick={() => void regenerateRawSnapshot()}
            >
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <RefreshCw size={12} />}
              Regenerar respaldo
            </button>
          )}
        </div>
      ) : (
        <div className="pulso-sm-decision-panel">
          <div className="pulso-sm-decision-context">
            <strong title={baseSurveyTitle}>{baseSurveyTitle || "Base SurveyMonkey"}</strong>
            <span>
              {sourceCount || 1} campaña{(sourceCount || 1) === 1 ? "" : "s"} · {selectedCollectorIds.length} recopilador{selectedCollectorIds.length === 1 ? "" : "es"} entra{selectedCollectorIds.length === 1 ? "" : "n"} · {hasPendingPolicyChanges ? "cambios pendientes" : "configuración guardada"}
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
                    {testCollectorCount > 0 ? ` · ${testCollectorCount} prueba bloqueada${testCollectorCount === 1 ? "" : "s"}` : ""}
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
                              : `${collector.count} respuestas descargadas${collector.source ? ` · ${collector.source}` : ""}${changedFromSaved ? " · cambio pendiente" : ""}`}
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
                  <span>Qué respuesta conservar</span>
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

function IndependentSiblingsSurveyMonkeyWizard({
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

function IntegratedHistoryPanel({
  bases,
  disabled,
  onNewIntegration,
}: {
  bases: EstudioBase[];
  disabled: boolean;
  onNewIntegration: () => void;
}) {
  return (
    <section className="pulso-integrated-panel pulso-integrated-history">
      <header className="pulso-integrated-head pulso-integrated-history-head">
        <span className="pulso-sm-multibase-icon" aria-hidden="true"><GitMerge size={18} /></span>
        <div>
          <div className="pulso-sm-multibase-kicker">Integración realizada</div>
          <h3>Instrumentos hermanos integrados</h3>
          <p>Qué archivos quedaron como canónicos y qué decisiones tomó la integración.</p>
        </div>
        <button type="button" className="pulso-sm-secondary" onClick={onNewIntegration} disabled={disabled}>
          <Plus size={13} /> Nueva integración
        </button>
      </header>

      {bases.map((base) => {
        const meta = base.multi_integrated;
        const origins = integratedHistoryArray<EstudioMultiIntegratedOrigin>(meta?.origins);
        const standardEntries = integratedStandardLabelEntries(meta);
        const labelGroups = integratedLabelOverrideGroups(meta);
        const labelsCount = labelGroups.reduce((sum, group) => sum + group.entries.length, 0);
        const wordingCount = labelsCount + standardEntries.length;
        const variantGroups = integratedVariantGroups(meta);
        const variantsCount = variantGroups.reduce((sum, group) => sum + group.rows.length, 0);
        const labelEntries = labelGroups.flatMap((group) => group.entries);
        const technicalLabelEntries = standardEntries.length ? standardEntries : labelEntries;
        const variantRows = variantGroups.flatMap((group) => group.rows);
        return (
          <div className="pulso-integrated-history-base" key={base.nombre}>
            <div className="pulso-integrated-history-summary">
              <div className="pulso-integrated-history-summary-main">
                <CheckCircle2 size={17} />
                <span>
                  <strong>{base.nombre}</strong>
                  <small>
                    Integrada con llave <code>{meta?.origin_key_name || "origen"}</code> el {importedAtLabel(meta?.imported_at)}
                  </small>
                </span>
              </div>
              <div className="pulso-integrated-history-metrics" aria-label={`Resumen de integración de ${base.nombre}`}>
                <HistoryMetric value={origins.length} label="orígenes" />
                <HistoryMetric value={wordingCount} label="fraseos" />
                <HistoryMetric value={variantsCount} label="variantes" />
              </div>
            </div>

            <div className="pulso-integrated-history-step">
              <span>1</span>
              <strong>Archivos canónicos</strong>
              <small>Estos son los insumos finales que usa el resto del flujo.</small>
            </div>
            <div className="pulso-integrated-history-files" aria-label={`Archivos canónicos de ${base.nombre}`}>
              <HistoryFile
                icon={<FileSpreadsheet size={14} />}
                label="Formulario guía"
                value={fileLabel(meta?.guide_xlsform_file_id, meta?.guide?.filename)}
              />
              <HistoryFile
                icon={<FileSpreadsheet size={14} />}
                label="Formulario integrado"
                value={fileLabel(base.xlsform_file_id, base.xlsform_file_name)}
              />
              <HistoryFile
                icon={<Database size={14} />}
                label="Respuestas integradas"
                value={fileLabel(base.data_file_id, base.data_file_name)}
              />
            </div>

            <div className="pulso-integrated-history-step">
              <span>2</span>
              <strong>Decisiones de integración</strong>
              <small>Cómo se reconocen los casos, fraseos y variables que cambiaban por origen.</small>
            </div>
            <div className="pulso-integrated-history-grid">
              <section className="pulso-integrated-history-block">
                <div className="pulso-integrated-history-block-head">
                  <span>
                    <strong>Orígenes importados</strong>
                    <small>Base de procedencia de cada caso</small>
                  </span>
                  <em>{origins.length}</em>
                </div>
                <div className="pulso-integrated-history-origin-list">
                  {origins.map((origin, index) => (
                    <div className="pulso-integrated-origin-card" key={`${origin.key_value ?? index}-${origin.survey_id ?? index}`}>
                      <code>{origin.key_value || `origen_${index + 1}`}</code>
                      <span title={origin.label || ""}>{origin.label || origin.survey_id || "Sin etiqueta"}</span>
                      <small>
                        {origin.source_kind === "surveymonkey"
                          ? `SurveyMonkey ${origin.survey_id || ""}`.trim()
                          : `${fileLabel(origin.xlsform_file_id, origin.xlsform_file_name)} + ${fileLabel(origin.data_file_id, origin.data_file_name)}`}
                      </small>
                    </div>
                  ))}
                  {!origins.length && <div className="pulso-sm-empty">Sin orígenes registrados.</div>}
                </div>
              </section>

              <section className="pulso-integrated-history-block pulso-integrated-history-block-wide">
                <div className="pulso-integrated-history-block-head">
                  <span>
                    <strong>Fraseos finales y por origen</strong>
                    <small>Texto común para Global y textos preservados por llave</small>
                  </span>
                  <em>{wordingCount}</em>
                </div>
                <div className="pulso-integrated-wording-groups">
                  {standardEntries.length > 0 && (
                    <div className="pulso-integrated-wording-group is-standard" key="standard-labels">
                      <div className="pulso-integrated-wording-group-head">
                        <strong>Final común</strong>
                        <small>{standardEntries.length} fraseo{standardEntries.length === 1 ? "" : "s"}</small>
                      </div>
                      <p title={standardEntries[0].value}>
                        <code>{standardEntries[0].variable}</code>
                        <span>{standardEntries[0].value}</span>
                      </p>
                      <div className="pulso-integrated-chip-row" aria-label="Variables con fraseo final común">
                        {standardEntries.slice(0, 5).map((entry) => (
                          <code key={entry.key}>{entry.variable}</code>
                        ))}
                        {standardEntries.length > 5 && <small>+{standardEntries.length - 5}</small>}
                      </div>
                    </div>
                  )}
                  {labelGroups.slice(0, 4).map((group) => {
                    const preview = group.entries[0];
                    return (
                      <div className="pulso-integrated-wording-group" key={group.origin}>
                        <div className="pulso-integrated-wording-group-head">
                          <strong>{group.origin}</strong>
                          <small>{group.entries.length} fraseo{group.entries.length === 1 ? "" : "s"}</small>
                        </div>
                        {preview && (
                          <p title={preview.value}>
                            <code>{preview.variable}</code>
                            <span>{preview.value}</span>
                          </p>
                        )}
                        <div className="pulso-integrated-chip-row" aria-label={`Variables con fraseo adaptado para ${group.origin}`}>
                          {group.entries.slice(0, 5).map((entry) => (
                            <code key={entry.key}>{entry.variable}</code>
                          ))}
                          {group.entries.length > 5 && <small>+{group.entries.length - 5}</small>}
                        </div>
                      </div>
                    );
                  })}
                  {labelGroups.length > 4 && (
                    <small className="pulso-integrated-history-more">+{labelGroups.length - 4} origen(es) con fraseos adicionales</small>
                  )}
                  {!wordingCount && <div className="pulso-sm-empty">Sin cambios de fraseo.</div>}
                </div>
              </section>

              <section className="pulso-integrated-history-block">
                <div className="pulso-integrated-history-block-head">
                  <span>
                    <strong>Variables por origen</strong>
                    <small>Columnas preservadas para no perder diferencias</small>
                  </span>
                  <em>{variantsCount}</em>
                </div>
                <div className="pulso-integrated-variant-groups">
                  {variantGroups.slice(0, 5).map((group) => (
                    <div className="pulso-integrated-variant-group" key={group.from}>
                      <div className="pulso-integrated-variant-source">
                        <code>{group.from}</code>
                        <ArrowRight size={13} aria-hidden="true" />
                      </div>
                      <div className="pulso-integrated-variant-targets">
                        {group.rows.map((variant, index) => (
                          <span key={`${variant.to}-${variant.origin}-${index}`} title={variant.origin || variant.ref}>
                            <code>{variant.to || "sin variante"}</code>
                            {(variant.origin || variant.ref) && <small>{variant.origin || variant.ref}</small>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {variantGroups.length > 5 && (
                    <small className="pulso-integrated-history-more">+{variantGroups.length - 5} variable(s) preservadas</small>
                  )}
                  {!variantGroups.length && <div className="pulso-sm-empty">Sin variantes estructurales.</div>}
                </div>
              </section>
            </div>

            <details className="pulso-integrated-history-raw">
              <summary>Ver bitácora técnica completa</summary>
              <div className="pulso-integrated-history-grid">
                <section className="pulso-integrated-history-block">
                  <div className="pulso-integrated-history-block-head">
                    <span>
                      <strong>Orígenes</strong>
                      <small>Detalle técnico</small>
                    </span>
                    <em>{origins.length}</em>
                  </div>
                  <div className="pulso-integrated-history-list">
                    {origins.map((origin, index) => (
                      <div className="pulso-integrated-history-row" key={`${origin.key_value ?? index}-${origin.survey_id ?? index}`}>
                        <code>{origin.key_value || `origen_${index + 1}`}</code>
                        <span title={origin.label || ""}>{origin.label || origin.survey_id || "Sin etiqueta"}</span>
                        <small>
                          {origin.source_kind === "surveymonkey"
                            ? `SurveyMonkey ${origin.survey_id || ""}`.trim()
                            : `${fileLabel(origin.xlsform_file_id, origin.xlsform_file_name)} + ${fileLabel(origin.data_file_id, origin.data_file_name)}`}
                        </small>
                      </div>
                    ))}
                    {!origins.length && <div className="pulso-sm-empty">Sin orígenes registrados.</div>}
                  </div>
                </section>

                <section className="pulso-integrated-history-block">
                  <div className="pulso-integrated-history-block-head">
                    <span>
                      <strong>Fraseo estándar</strong>
                      <small>Detalle técnico</small>
                    </span>
                    <em>{technicalLabelEntries.length}</em>
                  </div>
                  <div className="pulso-integrated-history-list">
                    {technicalLabelEntries.slice(0, 12).map((entry) => (
                      <div className="pulso-integrated-history-row" key={entry.key}>
                        <code>{entry.key}</code>
                        <span title={entry.value}>{entry.value}</span>
                      </div>
                    ))}
                    {technicalLabelEntries.length > 12 && <small className="pulso-integrated-history-more">+{technicalLabelEntries.length - 12} fraseo(s)</small>}
                    {!technicalLabelEntries.length && <div className="pulso-sm-empty">Sin cambios de fraseo.</div>}
                  </div>
                </section>

                <section className="pulso-integrated-history-block">
                  <div className="pulso-integrated-history-block-head">
                    <span>
                      <strong>Variables preservadas</strong>
                      <small>Detalle técnico</small>
                    </span>
                    <em>{variantsCount}</em>
                  </div>
                  <div className="pulso-integrated-history-list">
                    {variantRows.slice(0, 12).map((variant, index) => (
                      <div className="pulso-integrated-history-row" key={`${variant.from}-${variant.to}-${index}`}>
                        <code>{variant.from || "variable"}</code>
                        <span>{variant.to || "sin variante"}</span>
                        {(variant.origin || variant.ref) && <small>{variant.origin || variant.ref}</small>}
                      </div>
                    ))}
                    {variantsCount > 12 && <small className="pulso-integrated-history-more">+{variantsCount - 12} variante(s)</small>}
                    {!variantsCount && <div className="pulso-sm-empty">Sin variantes estructurales.</div>}
                  </div>
                </section>
              </div>
            </details>
          </div>
        );
      })}
    </section>
  );
}

function HistoryMetric({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function HistoryFile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="pulso-integrated-history-file">
      {icon}
      <span>
        <small>{label}</small>
        <strong title={value}>{value}</strong>
      </span>
    </div>
  );
}

// =====================================================================
// BaseRow — una base dentro del estudio
// =====================================================================
function BaseRow({
  base, isRenaming, renameDraft,
  onStartRename, onRenameChange, onRenameCommit, onRenameCancel,
  onRemove, onStartReplace, onExport, isReplacing, busy,
}: {
  base: EstudioBase;
  isRenaming: boolean;
  renameDraft: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRemove: () => void;
  onStartReplace: () => void;
  onExport: () => void;
  isReplacing: boolean;
  busy: boolean;
}) {
  const filterLabel = responseFilterLabel(base.response_filter);
  const sourceAlias = String(base.source_alias ?? "").trim();
  const sourceTitle = String(base.source_title ?? "").trim();
  const showSourceAlias = !!sourceAlias && sourceAlias !== "NA";
  const showSourceTitle = !!sourceTitle && sourceTitle !== "NA" && sourceTitle !== sourceAlias;
  // ADR 0030 Fase 5: identidad naranja de la base hija repeat.
  const isRepeatChild = isRepeatChildBase(base);
  const repeatGroup = String(base.repeat_group ?? "").trim();
  const repeatParent = String(base.parent_base ?? "").trim();
  return (
    <div className="pulso-base-row">
      <span className="pulso-base-row-icon" aria-hidden="true">
        <Check size={18} />
      </span>

      <div className="pulso-base-row-main">
        {isRenaming ? (
          <div className="pulso-base-row-rename">
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameCommit();
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={onRenameCommit}
              placeholder="nombre (sin $, sin espacios)"
            />
          </div>
        ) : (
          <div className="pulso-base-row-title-line">
            <div className="pulso-base-row-title">
              <code>{base.nombre}</code>
              <button
                type="button"
                onClick={onStartRename}
                disabled={busy}
                title="Renombrar base"
                aria-label={`Renombrar base ${base.nombre}`}
                className="pulso-icon"
              >
                <Pencil size={10} />
              </button>
            </div>
            {isRepeatChild && (
              <RepeatBadge
                repeatGroup={repeatGroup}
                compact
                title={repeatParent
                  ? `Respuestas repetidas de «${repeatParent}» (una fila por opción marcada)`
                  : "Base de respuestas repetidas"}
              />
            )}
            <span className="pulso-base-row-status">
              <CheckCircle2 size={12} />
              Lista
            </span>
          </div>
        )}
        <div className="pulso-base-row-meta">
          <span>
            <FileSpreadsheet size={12} /> Formulario cargado
          </span>
          {isRepeatChild && repeatParent && (
            <span title={`Enlaza con la base madre ${repeatParent}`}>
              <Layers size={12} /> Roster de {repeatParent}
            </span>
          )}
          {showSourceAlias && (
            <span title={sourceAlias}>
              <Cloud size={12} /> {sourceAlias}
            </span>
          )}
          {showSourceTitle && (
            <span title={sourceTitle}>
              <Cloud size={12} /> SurveyMonkey: {sourceTitle}
            </span>
          )}
          {filterLabel && (
            <span title={filterLabel}>
              <Filter size={12} /> {filterLabel}
            </span>
          )}
          <span>
            <Database size={12} />
            {base.n_filas != null && base.n_columnas != null
              ? `${base.n_filas} registros · ${base.n_columnas} columnas`
              : "Respuestas cargadas"}
            {base.data_ext && ` · .${base.data_ext}`}
          </span>
        </div>
      </div>

      <div className="pulso-base-row-actions">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          title={`Descargar la base lista para análisis de ${base.nombre}`}
          aria-label={`Descargar base lista para análisis de ${base.nombre}`}
          className="pulso-base-row-button is-primary"
        >
          <Download size={11} /> Descargar base
        </button>

        <button
          type="button"
          onClick={onStartReplace}
          disabled={busy || isReplacing}
          title={`Actualizar el formulario o las respuestas de ${base.nombre}`}
          aria-label={`Actualizar archivos de ${base.nombre}`}
          className={`pulso-base-row-button${isReplacing ? " is-active" : ""}`}
        >
          <RefreshCw size={11} /> Actualizar archivos
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={`Retirar base ${base.nombre} del estudio`}
          aria-label={`Retirar base ${base.nombre} del estudio`}
          className="pulso-base-row-button is-danger"
        >
          <Trash2 size={11} /> Retirar
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// AddBaseForm — formulario inline para agregar base
// =====================================================================
function AddBaseForm({
  existingNombres, onSubmit, onCancel,
}: {
  existingNombres: string[];
  /** `nombre` viaja vacío al backend → auto-nombra `base_N`. */
  onSubmit: (args: { nombre: string; xlsformFileId: string; dataFileId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [xlsformFile, setXlsformFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Sugerencia de auto-name que el backend asignará si se deja vacío.
  const autoName = (() => {
    let i = 1;
    while (existingNombres.includes(`base_${i}`)) i += 1;
    return `base_${i}`;
  })();

  // Validaciones solo si el usuario escribió algo. Nombre vacío = ok
  // (auto-name del backend).
  const nombreTocado = nombre.length > 0;
  const nombreValido = !nombreTocado || (!nombre.includes("$") && !/\s/.test(nombre));
  const nombreDuplicado = nombreTocado && existingNombres.includes(nombre.trim());
  const puedeAgregar = nombreValido && !nombreDuplicado && !!xlsformFile && !!dataFile && !uploading;

  async function handleSubmit() {
    if (!puedeAgregar || !xlsformFile || !dataFile) return;
    setError(""); setUploading(true);
    try {
      // Subir los dos archivos al file store.
      const upXls = await apiUpload(xlsformFile, "xlsform");
      const upData = await apiUpload(dataFile, uploadKindForDataFile(dataFile));
      // Nombre vacío = backend auto-genera.
      await onSubmit({
        nombre: nombre.trim(),
        xlsformFileId: upXls.file_id,
        dataFileId: upData.file_id,
      });
      setNombre("");
      setXlsformFile(null);
      setDataFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="pulso-base-editor">
      <div className="pulso-base-editor-head">
        <span className="pulso-base-editor-icon" aria-hidden="true">
          <Plus size={16} />
        </span>
        <div className="pulso-base-editor-copy">
          <strong>Agregar otra base al estudio</strong>
          <span>
            Sube el formulario y las respuestas. El nombre es opcional — si lo
            dejas vacío se llamará <code>{autoName}</code>{" "}
            y podrás renombrarla después.
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cancelar"
          title="Cancelar"
          disabled={uploading}
        >
          <XIcon size={13} />
        </button>
      </div>

      {/* Nombre (opcional — si vacío, backend auto-nombra). */}
      <label className="pulso-base-form-field">
        <span>
          Nombre de la base <em>(opcional)</em>
        </span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={autoName}
          className={
            nombreDuplicado
              ? "is-invalid"
              : nombreTocado && !nombreValido
              ? "is-warning"
              : ""
          }
        />
        {nombreDuplicado && (
          <small className="is-danger">
            Ya existe una base con ese nombre.
          </small>
        )}
        {nombreTocado && !nombreValido && !nombreDuplicado && (
          <small className="is-warning">
            Usa letras, números y guiones. Sin espacios ni el símbolo $.
          </small>
        )}
      </label>

      {/* Uploaders */}
      <div className="pulso-base-file-grid">
        <FilePicker
          icon={FileSpreadsheet}
          title="Formulario"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx)"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Respuestas"
          accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
          acceptLabel=".xlsx · .csv · .sav"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al agregar base" detail={error} />}

      <div className="pulso-base-form-actions">
        {/* Hint explícito sobre qué falta — el botón deshabilitado
            solo no es affordance suficiente. */}
        <div className="pulso-base-form-hint">
          {!puedeAgregar && !uploading && (
            <>
              {!xlsformFile && !dataFile
                ? "Falta subir el formulario y las respuestas."
                : !xlsformFile
                ? "Falta subir el formulario."
                : !dataFile
                ? "Falta subir las respuestas."
                : nombreDuplicado
                ? "Cambia el nombre — ya existe una base así."
                : !nombreValido
                ? "El nombre tiene caracteres no permitidos."
                : ""}
            </>
          )}
        </div>
        <div className="pulso-base-form-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeAgregar}
          >
            <Plus size={12} />
            {uploading ? "Subiendo…" : "Agregar base"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ReplaceFilesForm — editor inline para cambiar XLSForm y/o data de una
// base existente. Al menos uno de los dos archivos debe ser provisto.
// =====================================================================
function ReplaceFilesForm({
  baseNombre, onSubmit, onCancel,
}: {
  baseNombre: string;
  onSubmit: (args: { xlsformFileId: string; dataFileId: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [xlsformFile, setXlsformFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const puedeReemplazar = (!!xlsformFile || !!dataFile) && !uploading;

  async function handleSubmit() {
    if (!puedeReemplazar) return;
    setError(""); setUploading(true);
    try {
      let xlsformFileId = "";
      let dataFileId = "";
      if (xlsformFile) {
        const up = await apiUpload(xlsformFile, "xlsform");
        xlsformFileId = up.file_id;
      }
      if (dataFile) {
        const up = await apiUpload(dataFile, uploadKindForDataFile(dataFile));
        dataFileId = up.file_id;
      }
      await onSubmit({ xlsformFileId, dataFileId });
      setXlsformFile(null);
      setDataFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="pulso-base-editor is-replace">
      <div className="pulso-base-editor-head">
        <span className="pulso-base-editor-icon" aria-hidden="true">
          <RefreshCw size={14} />
        </span>
        <div className="pulso-base-editor-copy">
          <strong>
            Reemplazar archivos de <code>{baseNombre}</code>
          </strong>
          <span>
            Sube el formulario, las respuestas, o ambos. Lo que no toques se
            queda igual. La validación y el plan de analítica se invalidan.
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="pulso-icon"
          aria-label="Cancelar"
          title="Cancelar"
          disabled={uploading}
        >
          <XIcon size={13} />
        </button>
      </div>

      <div className="pulso-base-file-grid">
        <FilePicker
          icon={FileSpreadsheet}
          title="Nuevo formulario"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx) · opcional"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Nuevas respuestas"
          accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
          acceptLabel=".xlsx · .csv · .sav · opcional"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al reemplazar archivos" detail={error} />}

      <div className="pulso-base-form-actions">
        <div className="pulso-base-form-hint">
          {!puedeReemplazar && !uploading && "Sube al menos uno de los dos archivos para reemplazar."}
        </div>
        <div className="pulso-base-form-buttons">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeReemplazar}
          >
            <RefreshCw size={12} />
            {uploading ? "Reemplazando…" : "Reemplazar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilePicker({
  icon: Icon, title, accept, acceptLabel, file, onPick,
}: {
  icon: IconCmp;
  title: string;
  accept: string;
  acceptLabel: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      className={`pulso-base-file-picker${file ? " is-ready" : ""}${dragOver ? " is-dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      {file ? (
        <Check size={18} />
      ) : (
        <Upload size={18} />
      )}
      <span className="pulso-base-file-picker-title">
        <Icon size={13} />
        {file ? file.name : title}
      </span>
      <span className="pulso-base-file-picker-accept">{acceptLabel}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </label>
  );
}
