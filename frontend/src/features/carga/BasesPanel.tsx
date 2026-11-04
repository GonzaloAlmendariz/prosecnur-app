import { useEffect, useState, type ReactNode } from "react";
import {
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
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  X as XIcon,
} from "lucide-react";
import {
  apiCargaExportNormalized,
  apiEstudioDowngradeToSingle,
  apiEstudioGet,
  apiEstudioRemoveBase,
  apiEstudioRenameBase,
  apiEstudioReplaceBaseFiles,
  apiEstudioSetNombre,
  apiUpload,
  downloadUrl,
  uploadKindForDataFile,
} from "../../api/client";
import type { EstudioBase, EstudioMultiIntegratedOrigin, EstudioPayload } from "../../api/client";
import { ErrorBlock } from "../../components/States";
import { RepeatBadge } from "../../components/RepeatBadge";
import { isRepeatChildBase } from "../../lib/repeatIdentity";
import { IntegratedInstrumentsWizard } from "./IntegratedInstrumentsWizard";
import { CargaManualBaseLanes } from "./CargaManualBaseLanes";
import { useCargaStore } from "./store";
import type { MultiBaseStrategy } from "./store";
import {
  fileLabel,
  importedAtLabel,
  independentSiblingsCapacity,
  independentSiblingsCapacityLabel,
  integratedHistoryArray,
  integratedLabelOverrideGroups,
  integratedStandardLabelEntries,
  integratedVariantGroups,
  responseFilterLabel,
  smBaseChannel,
  smBaseChannelDetail,
  smBestExistingBaseTarget,
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
  smSurveyResponseLabel,
  smSurveySpecificLogicRulesBySurvey,
  smWorkbookInspectionCanImport,
  smWorkbookInspectionCellErrorCount,
  smWorkbookInspectionWarningCount,
} from "./surveymonkey/smBasesModel";
import { IndependentSiblingsSurveyMonkeyWizard } from "./independiente/IndependentSiblingsWizard";
import { FilePicker } from "./BasesFilePicker";
import { EstadoVacio } from "../../components/EstadoVacio";
import { Inbox } from "../../vendor/lucide-react";
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
    ...bases.map((base) => ({ fileId: base.xlsform_file_id, label: `${base.nombre}, formulario` })),
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
                  {!origins.length && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin orígenes registrados" />}
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
                  {!wordingCount && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin cambios de fraseo" />}
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
                  {!variantGroups.length && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin variantes estructurales" />}
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
                    {!origins.length && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin orígenes registrados" />}
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
                    {!technicalLabelEntries.length && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin cambios de fraseo" />}
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
                    {!variantsCount && <EstadoVacio icono={<Inbox size={16} />} titulo="Sin variantes estructurales" />}
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
              ? `${base.n_filas} registros y ${base.n_columnas} columnas`
              : "Respuestas cargadas"}
            {base.data_ext && `, .${base.data_ext}`}
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
          acceptLabel=".xlsx, .csv o .sav"
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
          acceptLabel="Excel (.xlsx), opcional"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Nuevas respuestas"
          accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
          acceptLabel=".xlsx, .csv o .sav, opcional"
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

