import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Cloud, Database, Download, FileSpreadsheet, Filter, GitMerge, Layers, Loader2, Mail,
  MessageCircle, PhoneCall, Plus, QrCode, RefreshCw, Route, Search, SlidersHorizontal,
  Trash2, Upload, Pencil, X as XIcon,
} from "lucide-react";
import {
  apiCargaExportNormalized,
  apiCargaImportKoboIndependent,
  apiCargaRefreshKoboIndependent,
  apiConnectionProfileSetDefault,
  apiConnectionTokenLoad,
  apiEstudioAddBase,
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
  apiSurveyMonkeyMultibaseImportIndependent,
  apiSurveyMonkeyMultibaseListSurveys,
  apiSurveyMonkeyMultibaseRefresh,
  apiSurveyMonkeyMultibaseRefreshPlan,
  apiSurveyMonkeyMultibaseSavBundleImport,
  apiSurveyMonkeyMultibaseSavBundleInspect,
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
  EstudioMultiIntegrated,
  EstudioMultiIntegratedOrigin,
  EstudioPayload,
  EstudioProcessingSuggestionGroup,
  EstudioProcessingSuggestionSource,
  EstudioProcessingSuggestions,
  KoboIndependentRefreshResult,
  KoboIndependentAssetInput,
  SurveyMonkeyMultibaseSurveyInput,
  SurveyMonkeyMultibaseAudit,
  SurveyMonkeyMultibaseCollector,
  SurveyMonkeyDecisionAudit,
  SurveyMonkeyDecisionPolicy,
  SurveyMonkeyDecisionSourceAudit,
  SurveyMonkeyMultibaseDiff,
  SurveyMonkeyMultibaseListItem,
  SurveyMonkeyRefreshBasePlan,
  SurveyMonkeyRefreshPlan,
  SurveyMonkeyRefreshResult,
  SurveyMonkeySavBundleFileInspection,
  SurveyMonkeySavBundleImportResult,
  SurveyMonkeySavBundleInspection,
  SurveyMonkeyWorkbookImportResult,
  SurveyMonkeyWorkbookInspection,
  RuleInterpretation,
} from "../../api/client";
import { ErrorBlock } from "../../components/States";
import { IntegratedInstrumentsWizard } from "./IntegratedInstrumentsWizard";

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
  initialStrategy?: "separate" | "integrated" | "independent";
};

type SmCanonicalOption = {
  fileId: string;
  label: string;
};

export function BasesPanel({
  estudio, onChanged, autoOpenAdd, hasSessionXlsform, onAutoOpenConsumed, onDowngraded, initialStrategy,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [replacingFiles, setReplacingFiles] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editingEstudioNombre, setEditingEstudioNombre] = useState(false);
  const [estudioDraft, setEstudioDraft] = useState("");
  const [strategy, setStrategy] = useState<"separate" | "integrated" | "independent">(initialStrategy ?? "separate");
  const [showNewIntegration, setShowNewIntegration] = useState(false);

  // Consumir la señal de auto-open una sola vez al montar/recibir true.
  useEffect(() => {
    if (autoOpenAdd) {
      setStrategy("separate");
      setAdding(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpenAdd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialStrategy) return;
    setStrategy(initialStrategy);
    setAdding(false);
    setShowNewIntegration(false);
  }, [initialStrategy]);

  const bases = Object.values(estudio.bases);
  const integratedBases = bases.filter((base) => !!base.multi_integrated);
  const integratedSignature = integratedBases
    .map((base) => `${base.nombre}:${base.multi_integrated?.imported_at ?? ""}:${base.multi_integrated?.origin_key_name ?? ""}`)
    .join("|");
  const maxReached = estudio.n_bases >= estudio.max_bases;
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
    if (estudio.n_bases === 0 && !autoOpenAdd) {
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
            Elige cómo se organiza este estudio.
          </div>
        </div>
        <span className="pulso-multibase-study-count">
          {estudio.n_bases} {estudio.n_bases === 1 ? "base" : "bases"}
        </span>

        {/* Acción de salida contextual:
            - 0 o 1 base: "Volver a carga simple" (no destructivo).
            - ≥2 bases: "Cerrar estudio" (destructivo, confirmación). */}
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
            title="Cerrar el estudio y descartar todas las bases"
            className="pulso-multibase-study-action is-danger"
          >
            <XIcon size={11} /> Cerrar estudio
          </button>
        )}
      </header>

      <div className="pulso-multi-strategy" role="tablist" aria-label="Forma de trabajar varias bases">
        <button
          type="button"
          className={strategy === "separate" ? "is-active" : ""}
          role="tab"
          aria-selected={strategy === "separate"}
          onClick={() => setStrategy("separate")}
          title="Mantener bases separadas - formulario y respuestas por base"
        >
          <Layers size={15} />
          <span className="pulso-multi-strategy-label">
            <strong>Mantener bases separadas</strong>
            <small>Formulario y respuestas por base.</small>
          </span>
        </button>
        <button
          type="button"
          className={strategy === "integrated" ? "is-active" : ""}
          role="tab"
          aria-selected={strategy === "integrated"}
          onClick={() => setStrategy("integrated")}
          title="Unificar bases compatibles - formulario comun y base final"
        >
          <GitMerge size={15} />
          <span className="pulso-multi-strategy-label">
            <strong>Unificar bases compatibles</strong>
            <small>Formulario común y base final.</small>
          </span>
        </button>
        <button
          type="button"
          className={strategy === "independent" ? "is-active" : ""}
          role="tab"
          aria-selected={strategy === "independent"}
          onClick={() => setStrategy("independent")}
          title="Fuentes independientes - entregables por encuesta"
        >
          <Cloud size={15} />
          <span className="pulso-multi-strategy-label">
            <strong>Fuentes independientes</strong>
            <small>Entregables por encuesta.</small>
          </span>
        </button>
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
        <>
      {/* Lista de bases */}
      <div className="pulso-base-list">
        {bases.map((b) => (
          <div key={b.nombre}>
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
            {replacingFiles === b.nombre && (
              <ReplaceFilesForm
                baseNombre={b.nombre}
                onSubmit={async ({ xlsformFileId, dataFileId }) => {
                  setError(""); setBusy(`Reemplazando archivos de ${b.nombre}…`);
                  try {
                    const p = await apiEstudioReplaceBaseFiles(b.nombre, {
                      xlsform_file_id: xlsformFileId || undefined,
                      data_file_id:    dataFileId    || undefined,
                    });
                    await onChanged(p);
                    setReplacingFiles(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
                onCancel={() => setReplacingFiles(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Agregar base */}
      {adding ? (
        <AddBaseForm
          existingNombres={bases.map((b) => b.nombre)}
          onSubmit={async ({ nombre, xlsformFileId, dataFileId }) => {
            setError(""); setBusy(`Agregando ${nombre}…`);
            try {
              await apiEstudioAddBase({
                nombre,
                xlsform_file_id: xlsformFileId,
                data_file_id: dataFileId,
              });
              const p = await apiEstudioGet();
              await onChanged(p);
              setAdding(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={maxReached || !!busy}
          className={`pulso-base-add-button${maxReached ? " is-limited" : ""}`}
        >
          <Plus size={13} />
          {maxReached
            ? `Límite de ${estudio.max_bases} bases alcanzado`
            : "Agregar otra base"}
        </button>
      )}
        </>
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

function smNormalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function smSurveyTitle(item: SurveyMonkeyMultibaseListItem) {
  return item.nickname || item.title || item.id;
}

function smSurveyMatchesQuery(item: SurveyMonkeyMultibaseListItem, query: string) {
  const q = smNormalizeSearch(query);
  if (!q) return true;
  const haystack = smNormalizeSearch([
    item.id,
    item.title,
    item.nickname ?? "",
    item.pais_guess ?? "",
  ].join(" "));
  return q.split(" ").filter(Boolean).every((token) => haystack.includes(token));
}

function smSurveyIdsFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null): string[] {
  if (!spec) return [];
  const sources = spec.sources ?? spec.campaigns ?? [];
  return [
    String(spec.survey_id || "").trim(),
    ...sources.flatMap((source) => smSurveyIdsFromSpec(source)),
  ].filter(Boolean);
}

function smSurveyIdsFromFilter(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const direct = String(record.survey_id ?? record.id ?? "").trim();
  const sources = Array.isArray(record.sources) ? record.sources : [];
  return [
    direct,
    ...sources.flatMap((source) => smSurveyIdsFromFilter(source)),
  ].filter(Boolean);
}

function smSurveyIdsFromBase(base: EstudioBase) {
  return Array.from(new Set([
    String(base.survey_id || "").trim(),
    ...smSurveyIdsFromSpec(base.surveymonkey_source_spec),
    ...smSurveyIdsFromFilter(base.response_filter),
  ].filter(Boolean)));
}

export function smSurveyCatalogAvailability(
  surveys: SurveyMonkeyMultibaseListItem[] | null | undefined,
  query: string,
  existingSurveyIds: Iterable<string>,
  selectedSurveyIds: Iterable<string>,
) {
  const existing = new Set(Array.from(existingSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const selected = new Set(Array.from(selectedSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const matched = (surveys ?? []).filter((item) => smSurveyMatchesQuery(item, query));
  const duplicates = matched.filter((item) => existing.has(item.id) || selected.has(item.id));
  const available = matched.filter((item) => !existing.has(item.id) && !selected.has(item.id));
  return { matched, available, duplicates };
}

function smDuplicateSurveyAlert(
  duplicates: SurveyMonkeyMultibaseListItem[],
  existingSurveyIds: Set<string>,
  selectedSurveyIds: Set<string>,
) {
  if (!duplicates.length) return "";
  const loaded = duplicates.filter((item) => existingSurveyIds.has(item.id)).length;
  const selected = duplicates.filter((item) => selectedSurveyIds.has(item.id)).length;
  const parts = [
    loaded ? `${loaded} ya ${loaded === 1 ? "está cargada" : "están cargadas"}` : "",
    selected ? `${selected} ya ${selected === 1 ? "está seleccionada" : "están seleccionadas"}` : "",
  ].filter(Boolean);
  const examples = duplicates.slice(0, 3).map((item) => smSurveyTitle(item)).join(" · ");
  return `Se ocultaron ${duplicates.length} coincidencia${duplicates.length === 1 ? "" : "s"} repetida${duplicates.length === 1 ? "" : "s"} (${parts.join("; ")}). ${examples}`;
}

function smBaseSlug(value: string) {
  const slug = smNormalizeSearch(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "base_1";
}

function smIndependentBaseTitle(base: EstudioBase | null | undefined, estudio: EstudioPayload) {
  const raw = [
    base?.source_alias,
    base?.source_title,
    estudio.nombre,
    base?.xlsform_file_name,
    base?.data_file_name,
    base?.nombre,
  ].find((item) => String(item ?? "").trim() && String(item ?? "").trim() !== "NA");
  const value = String(raw ?? "").replace(/\.(xlsx|xls|sav|csv)$/i, "");
  const upper = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const careers: Array<[string, string]> = [
    ["CIVIL", "Ingeniería Civil"],
    ["INDUSTRIAL", "Ingeniería Industrial"],
    ["GEOLOGICA", "Ingeniería Geológica"],
    ["MINAS", "Ingeniería de Minas"],
    ["ELECTRONICA", "Ingeniería Electrónica"],
    ["MECANICA", "Ingeniería Mecánica"],
    ["MECATRONICA", "Ingeniería Mecatrónica"],
    ["INFORMATICA", "Ingeniería Informática"],
    ["TELECOM", "Ingeniería de Telecomunicaciones"],
  ];
  const match = careers.find(([token]) => upper.includes(token));
  if (match) return match[1];
  return value
    .replace(/_/g, " ")
    .replace(/\b(instrumento|adaptado|data|base|codificacion|encuesta|egresados)\b/gi, " ")
    .replace(/\b\d{1,2} \d{1,2} \d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Base existente";
}

function smExistingBaseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

function smCompactSurveyLikeLabel(value: string) {
  const cleaned = String(value || "")
    .replace(/_/g, " ")
    .replace(/\bAcreditaci[oó]n\b/gi, " ")
    .replace(/\bEncuesta\s+a\s+(?:E|A)gresados?\b/gi, " ")
    .replace(/\bEncuesta\b/gi, " ")
    .replace(/\b(?:E|A)gresados?\b/gi, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+\ba\b\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || String(value || "").trim();
}

function smExistingBaseTargetLabel(base: EstudioBase) {
  return smCompactSurveyLikeLabel(smExistingBaseLabel(base));
}

function smMeaningfulTokens(value: string) {
  const stop = new Set([
    "acreditacion",
    "encuesta",
    "encuestas",
    "egresado",
    "egresados",
    "agresado",
    "agresados",
    "ingenieria",
    "ingenierias",
    "base",
    "data",
    "de",
    "del",
    "la",
    "las",
    "los",
    "a",
    "y",
    "pucp",
  ]);
  return smNormalizeSearch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token));
}

function smExistingBaseTargetScore(item: SurveyMonkeyMultibaseListItem, base: EstudioBase) {
  const surveyAlias = smNormalizeSearch(smSurveyDefaultAlias(item));
  const surveyTitle = smNormalizeSearch(smSurveyTitle(item));
  const baseLabel = smNormalizeSearch(smExistingBaseLabel(base));
  const baseTitle = smNormalizeSearch(String(base.source_title || base.xlsform_file_name || base.data_file_name || base.nombre || ""));
  const candidates = [baseLabel, baseTitle, smNormalizeSearch(base.nombre)].filter(Boolean);
  if (!surveyAlias || !candidates.length) return 0;
  if (candidates.some((candidate) => candidate === surveyAlias)) return 1.5;
  if (candidates.some((candidate) => candidate.includes(surveyAlias) || surveyAlias.includes(candidate))) return 1.2;
  if (candidates.some((candidate) => surveyTitle.includes(candidate))) return 1.05;

  const surveyTokens = new Set(smMeaningfulTokens(`${surveyAlias} ${surveyTitle}`));
  const baseTokens = new Set(smMeaningfulTokens(candidates.join(" ")));
  if (!surveyTokens.size || !baseTokens.size) return 0;
  const overlap = Array.from(surveyTokens).filter((token) => baseTokens.has(token)).length;
  return overlap / Math.max(1, Math.min(surveyTokens.size, baseTokens.size));
}

export function smBestExistingBaseTarget(item: SurveyMonkeyMultibaseListItem, bases: EstudioBase[]) {
  let best = { baseName: "", score: 0 };
  for (const base of bases) {
    const score = smExistingBaseTargetScore(item, base);
    if (score > best.score) best = { baseName: base.nombre, score };
  }
  return best.score >= 0.58 ? best.baseName : "";
}

export function smWorkbookInspectionWarningCount(inspection?: SurveyMonkeyWorkbookInspection | null) {
  if (!inspection) return 0;
  const sheetWarnings = inspection.sheets.reduce((sum, sheet) => sum + sheet.warnings.length, 0);
  return inspection.warnings.length + sheetWarnings;
}

export function smWorkbookInspectionCellErrorCount(inspection?: SurveyMonkeyWorkbookInspection | null) {
  if (!inspection) return 0;
  return inspection.sheets.reduce((sum, sheet) => sum + (sheet.n_cell_errors ?? 0), 0);
}

export function smWorkbookInspectionCanImport(inspection?: SurveyMonkeyWorkbookInspection | null) {
  return !!inspection && inspection.ok && inspection.n_matched > 0 && inspection.n_blocking === 0;
}

export function smSavBundleInspectionWarningCount(inspection?: SurveyMonkeySavBundleInspection | null) {
  if (!inspection) return 0;
  const fileWarnings = inspection.files.reduce((sum, file) => sum + file.warnings.length, 0);
  return inspection.warnings.length + fileWarnings;
}

export function smSavBundleInspectionCanImport(inspection?: SurveyMonkeySavBundleInspection | null) {
  return !!inspection && inspection.ok && inspection.n_matched > 0 && inspection.n_blocking === 0;
}

export type SmSavBundleIssueGroup = {
  key: string;
  label: string;
  reason: string;
  variables: string[];
  notes: string[];
  tone: "warning" | "danger" | "neutral";
};

function smWorkbookMissingLabel(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const count = sheet.missing_variables.length;
  if (!count) return "Sin variables faltantes";
  const sample = sheet.missing_variables.slice(0, 4).join(", ");
  return `${count} faltante${count === 1 ? "" : "s"}${sample ? `: ${sample}${count > 4 ? ", ..." : ""}` : ""}`;
}

function smWorkbookSheetIssueLabel(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const nCellErrors = sheet.n_cell_errors ?? 0;
  if (nCellErrors > 0) return `${nCellErrors} celdas con error Excel`;
  return sheet.warnings[0] || "Lista para aplicar";
}

function smWorkbookSheetIssueTitle(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const notes = [...sheet.warnings];
  if ((sheet.n_cell_errors ?? 0) > 0) {
    const sample = (sheet.cell_errors ?? [])
      .slice(0, 3)
      .map((err) => `${err.source}${err.variable ? ` → ${err.variable}` : ""}: ${err.n_errors}`)
      .join(" · ");
    notes.push(`Errores Excel detectados${sample ? `: ${sample}` : ""}`);
  }
  return notes.join(" · ");
}

export function smSavBundleIssueGroups(file: SurveyMonkeySavBundleFileInspection): SmSavBundleIssueGroup[] {
  const groups: SmSavBundleIssueGroup[] = [];
  if (file.blocking || file.warnings.length) {
    groups.push({
      key: "warnings",
      label: file.blocking ? "Bloqueo de inspección" : "Advertencias de inspección",
      reason: file.blocking
        ? "El archivo no se puede aplicar hasta resolver esta condición."
        : "La importación puede continuar, pero conviene revisar estos avisos antes de reemplazar las respuestas.",
      variables: [],
      notes: file.warnings,
      tone: file.blocking ? "danger" : "warning",
    });
  }
  if (file.missing_variables.length) {
    groups.push({
      key: "missing",
      label: "Faltantes en SAV",
      reason: "El formulario vigente espera estas variables, pero no se encontró una columna equivalente en el SAV. Se crearán vacías para conservar la estructura.",
      variables: file.missing_variables,
      notes: [],
      tone: "warning",
    });
  }
  if (file.blank_filled_variables.length) {
    groups.push({
      key: "blank-filled",
      label: "Rellenadas en blanco",
      reason: "La política de actualización permite completar estas variables como columnas vacías sin bloquear la importación.",
      variables: file.blank_filled_variables,
      notes: [],
      tone: "neutral",
    });
  }
  if (file.all_empty_variables.length) {
    groups.push({
      key: "all-empty",
      label: "Sin datos observados",
      reason: "La variable existe o fue reconocida en la normalización, pero todas sus filas llegan vacías en este SAV.",
      variables: file.all_empty_variables,
      notes: [],
      tone: "warning",
    });
  }
  return groups;
}

export function smSavBundleVariableLabel(variable: string, lookup?: Map<string, string>) {
  return String(lookup?.get(variable) || "").replace(/\s+/g, " ").trim();
}

function smSavBundleVariableSummary(file: SurveyMonkeySavBundleFileInspection) {
  if (file.missing_variables.length) {
    const sample = file.missing_variables.slice(0, 4).join(", ");
    return `${file.missing_variables.length} faltante${file.missing_variables.length === 1 ? "" : "s"}${sample ? `: ${sample}${file.missing_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.blank_filled_variables.length) {
    const sample = file.blank_filled_variables.slice(0, 4).join(", ");
    return `${file.blank_filled_variables.length} rellenada${file.blank_filled_variables.length === 1 ? "" : "s"} en blanco${sample ? `: ${sample}${file.blank_filled_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.all_empty_variables.length) {
    const sample = file.all_empty_variables.slice(0, 4).join(", ");
    return `${file.all_empty_variables.length} sin datos observados${sample ? `: ${sample}${file.all_empty_variables.length > 4 ? ", ..." : ""}` : ""}`;
  }
  if (file.warnings.length) return `Revisar detalle: ${file.warnings[0]}`;
  return "Variables esperadas disponibles";
}

function smSavBundleImpactLabel(file: SurveyMonkeySavBundleFileInspection) {
  const delta = file.change_plan?.impact?.rows_delta;
  const prefix = delta == null ? "" : delta > 0 ? `+${delta} filas · ` : `${delta} filas · `;
  return `${prefix}${file.n_output_columns} columnas finales`;
}

function smSavBundleIssueLabel(file: SurveyMonkeySavBundleFileInspection) {
  if (file.blocking) return file.warnings[0] || "Archivo bloqueado";
  if (file.warnings.length) return file.warnings[0];
  return "Lista para actualizar";
}

type SmImportScopeFields = {
  collectorIds: string;
  dateModifiedGte: string;
  dateModifiedLte: string;
  includeCompleted: boolean;
  includePartial: boolean;
  keepMissingStatus: boolean;
  collectionStrategy: "campo" | "whatsapp_link" | "web_link" | "email" | "otro";
  channel: string;
};

type SmExtraSourceDraft = SmImportScopeFields & {
  key: string;
  surveyId: string;
  label: string;
  query?: string;
};

type SmImportScopeDraft = SmImportScopeFields & {
  alias: string;
  logicRules: string;
  targetBaseName?: string;
  extraSources: SmExtraSourceDraft[];
};

export const INDEPENDENT_SIBLINGS_MAX_BASES = 10;
const SM_CHANNEL_OPTIONS = ["Correo", "Telefónico", "WhatsApp", "Ficha QR", "SMS", "Mixto"] as const;

export function independentSiblingsCapacity(estudio: Pick<EstudioPayload, "max_bases" | "n_bases">) {
  const maxBases = Math.min(estudio.max_bases || INDEPENDENT_SIBLINGS_MAX_BASES, INDEPENDENT_SIBLINGS_MAX_BASES);
  return {
    maxBases,
    capacityLeft: Math.max(0, maxBases - estudio.n_bases),
  };
}

function smDefaultScopeFields(): SmImportScopeFields {
  return {
    collectorIds: "",
    dateModifiedGte: "",
    dateModifiedLte: "",
    includeCompleted: true,
    includePartial: false,
    keepMissingStatus: false,
    collectionStrategy: "campo",
    channel: "",
  };
}

function smDefaultScopeDraft(): SmImportScopeDraft {
  return {
    ...smDefaultScopeFields(),
    alias: "",
    logicRules: "",
    extraSources: [],
  };
}

function smMonitoringSuggestionPrimarySource(group: EstudioProcessingSuggestionGroup) {
  return group.sources.find((source) => source.kind === "surveymonkey" && source.survey_id)
    ?? group.sources.find((source) => source.survey_id)
    ?? null;
}

function smMonitoringSuggestionCanImport(
  group: EstudioProcessingSuggestionGroup,
  existingSurveyIds: Iterable<string>,
  selectedSurveyIds: Iterable<string> = [],
) {
  const primary = smMonitoringSuggestionPrimarySource(group);
  if (!group.importable || group.platform !== "surveymonkey" || !primary?.survey_id) return false;
  const existing = new Set(Array.from(existingSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const selected = new Set(Array.from(selectedSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  return !existing.has(primary.survey_id) && !selected.has(primary.survey_id);
}

function koboAssetIdsFromBase(base: EstudioBase) {
  return Array.from(new Set([
    base.kobo_source_spec?.asset_uid,
    base.survey_id,
  ].map((id) => String(id || "").trim()).filter(Boolean)));
}

function koboMonitoringSuggestionPrimarySource(group: EstudioProcessingSuggestionGroup) {
  return group.sources.find((source) => source.kind === "kobo" && source.asset_uid)
    ?? group.sources.find((source) => source.asset_uid)
    ?? null;
}

function koboMonitoringSuggestionCanImport(
  group: EstudioProcessingSuggestionGroup,
  existingAssetIds: Iterable<string>,
) {
  const primary = koboMonitoringSuggestionPrimarySource(group);
  if (!group.importable || group.platform !== "kobo" || !primary?.asset_uid) return false;
  const existing = new Set(Array.from(existingAssetIds).map((id) => String(id).trim()).filter(Boolean));
  return !existing.has(primary.asset_uid);
}

function koboMonitoringSuggestionInput(group: EstudioProcessingSuggestionGroup): KoboIndependentAssetInput | null {
  const primary = koboMonitoringSuggestionPrimarySource(group);
  if (!primary?.asset_uid) return null;
  return {
    ...(group.kobo_input ?? {}),
    asset_uid: primary.asset_uid,
    title: group.kobo_input?.title || primary.title || primary.label || group.actor,
    label: group.kobo_input?.label || group.actor,
    source_alias: group.kobo_input?.source_alias || group.actor,
    source_title: group.kobo_input?.source_title || primary.title || primary.label || group.actor,
    source_channel: group.kobo_input?.source_channel || primary.channel || "",
    channel: group.kobo_input?.channel || primary.channel || "",
    collection_strategy: group.kobo_input?.collection_strategy || primary.collection_strategy || "",
    base_url: group.kobo_input?.base_url || primary.base_url || "",
    connection_profile_id: group.kobo_input?.connection_profile_id || primary.connection_profile_id || "",
  };
}

function smSuggestionCatalogItem(source: EstudioProcessingSuggestionSource): SurveyMonkeyMultibaseListItem {
  return {
    id: source.survey_id,
    title: source.title || source.label || source.survey_id,
    nickname: source.label || source.actor || null,
    date_modified: source.last_sync_at || null,
    pais_guess: null,
    response_count: source.response_count ?? null,
  };
}

function smMergeSuggestionCatalog(
  current: SurveyMonkeyMultibaseListItem[] | null,
  groups: EstudioProcessingSuggestionGroup[],
) {
  const byId = new Map<string, SurveyMonkeyMultibaseListItem>();
  for (const item of current ?? []) byId.set(item.id, item);
  for (const group of groups) {
    for (const source of group.sources) {
      if (source.kind !== "surveymonkey" || !source.survey_id) continue;
      if (!byId.has(source.survey_id)) byId.set(source.survey_id, smSuggestionCatalogItem(source));
    }
  }
  return Array.from(byId.values());
}

function smMonitoringSuggestionScope(
  group: EstudioProcessingSuggestionGroup,
  current?: SmImportScopeDraft,
): SmImportScopeDraft {
  const smSources = group.sources.filter((source) => source.kind === "surveymonkey" && source.survey_id);
  const primary = smSources[0];
  const alias = group.actor || group.label || primary?.label || primary?.title || "";
  const primaryChannel = primary?.channel || group.survey_input?.channel || "";
  const primaryStrategy = (primary?.collection_strategy || group.survey_input?.collection_strategy || "campo") as SmImportScopeFields["collectionStrategy"];
  return {
    ...smDefaultScopeDraft(),
    ...(current ?? {}),
    alias,
    channel: smChannelLabel(primaryChannel) || primaryChannel,
    collectionStrategy: primaryStrategy,
    collectorIds: (primary?.collector_ids ?? []).join(", "),
    extraSources: smSources.slice(1).map((source) => ({
      ...smDefaultScopeFields(),
      key: smNewScopeKey(),
      surveyId: source.survey_id,
      label: [group.actor, smChannelLabel(source.channel) || source.channel]
        .filter(Boolean)
        .join(" · ") || group.actor || source.label || source.title,
      query: "",
      channel: smChannelLabel(source.channel) || source.channel,
      collectionStrategy: (source.collection_strategy || "campo") as SmImportScopeFields["collectionStrategy"],
      collectorIds: (source.collector_ids ?? []).join(", "),
    })),
  };
}

function smSuggestionUsesPersonalizedLink(source: EstudioProcessingSuggestionSource) {
  const haystack = [
    source.collection_strategy,
    source.channel,
    source.label,
    source.title,
  ].join(" ").toLowerCase();
  return haystack.includes("whatsapp")
    || haystack.includes("sms")
    || haystack.includes("personalizado")
    || haystack.includes("custom link")
    || haystack.includes("web link")
    || haystack.includes("weblink")
    || haystack.includes("enlace");
}

export function smSuggestedSurveyMonkeyLogicRulesFromMonitoring(
  suggestions: EstudioProcessingSuggestions | null | undefined,
) {
  if (!suggestions) return "";
  const isAccreditation = suggestions.project_kind === "acreditacion" || suggestions.profile_family === "acreditacion";
  if (!isAccreditation) return "";
  const personalizedSources = suggestions.groups
    .filter((group) => group.platform === "surveymonkey")
    .flatMap((group) => group.sources)
    .filter((source) => source.kind === "surveymonkey" && smSuggestionUsesPersonalizedLink(source));
  if (!personalizedSources.length) return "";
  return "Q1 = C1 => Ocultar P2.";
}

export function smSurveyMonkeyLogicRuleLines(text: string) {
  return text
    .split(/\r?\n|;/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

type SmLogicPreviewRow = {
  rule: string;
  ok: boolean;
  summary: string;
  detail: string;
  warnings: string[];
  origin?: string;
};

type SmLogicPreviewEntry = {
  rule: string;
  origin?: string;
};

export function smSurveyMonkeyLogicPreviewNeedsReview(
  ruleLines: string[],
  preview: Array<{ rule: string; ok: boolean }> | null | undefined,
) {
  if (!ruleLines.length) return false;
  if (!preview || preview.length !== ruleLines.length) return true;
  return ruleLines.some((rule, index) => preview[index]?.rule !== rule || !preview[index]?.ok);
}

export function smSurveySpecificLogicRulesBySurvey(
  items: Array<{ id: string }>,
  drafts: Record<string, { logicRules?: string } | undefined>,
) {
  const out: Record<string, string> = {};
  for (const item of items) {
    const rules = String(drafts[item.id]?.logicRules ?? "").trim();
    if (item.id && rules) out[item.id] = rules;
  }
  return out;
}

export function smSurveyMonkeyLogicPreviewEntries(
  commonRules: string,
  specificRulesBySurvey: Record<string, string>,
  surveyLabels: Record<string, string> = {},
) {
  const entries: SmLogicPreviewEntry[] = smSurveyMonkeyLogicRuleLines(commonRules)
    .map((rule) => ({ rule, origin: "Regla común" }));
  for (const [surveyId, rulesText] of Object.entries(specificRulesBySurvey)) {
    const label = surveyLabels[surveyId] || surveyId;
    entries.push(...smSurveyMonkeyLogicRuleLines(rulesText).map((rule) => ({
      rule,
      origin: `Actor ${label}`,
    })));
  }
  return entries;
}

function smLogicPreviewRow(entry: SmLogicPreviewEntry, interpretation: RuleInterpretation): SmLogicPreviewRow {
  const rule = entry.rule;
  if (interpretation.ok !== true) {
    return {
      rule,
      ok: false,
      summary: "No se pudo interpretar",
      detail: interpretation.error,
      warnings: [],
      origin: entry.origin,
    };
  }
  const actionCount = interpretation.regla_parseada.n_actions || interpretation.regla_parseada.actions.length;
  const expr = interpretation.resolucion.kobo_expr;
  return {
    rule,
    ok: true,
    summary: `${actionCount} acción${actionCount === 1 ? "" : "es"} · ${interpretation.regla_parseada.when_var}`,
    detail: interpretation.texto_humano || expr || "Regla interpretada.",
    warnings: interpretation.warnings ?? [],
    origin: entry.origin,
  };
}

function smSuggestionResponseLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "sin conteo";
  return `${value.toLocaleString("es-PE")} respuesta${value === 1 ? "" : "s"}`;
}

function smChannelKey(value: string) {
  const normalized = smNormalizeSearch(value);
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("presencial") || normalized.includes("qr") || normalized.includes("ficha")) return "presencial";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("web") || normalized.includes("online") || normalized.includes("link") || normalized.includes("enlace")) return "correo";
  if (normalized.includes("mixto") || normalized.includes("multicanal")) return "mixto";
  return normalized ? "mixto" : "";
}

function smChannelLabel(value: string) {
  const key = smChannelKey(value);
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "whatsapp") return "WhatsApp";
  if (key === "presencial") return "Ficha QR";
  if (key === "sms") return "SMS";
  if (key === "mixto") return "Mixto";
  return "";
}

function smChannelOptions(value?: string | null) {
  const label = smChannelLabel(String(value ?? ""));
  const options = [...SM_CHANNEL_OPTIONS];
  return label && !options.includes(label as (typeof SM_CHANNEL_OPTIONS)[number])
    ? [label, ...options]
    : options;
}

function smInferChannelFromText(value: string) {
  const normalized = smNormalizeSearch(value);
  if (normalized.includes("telefon")) return "Telefónico";
  if (normalized.includes("whatsapp")) return "WhatsApp";
  if (normalized.includes("sms")) return "SMS";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "Ficha QR";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "Correo";
  if (normalized.includes("web") || normalized.includes("online") || normalized.includes("link")) return "Correo";
  return "";
}

function smSurveyDefaultChannel(item: SurveyMonkeyMultibaseListItem) {
  return smInferChannelFromText(`${item.title} ${item.nickname ?? ""}`);
}

function smChannelFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return "";
  const labels: string[] = [];
  const direct = smChannelLabel(String(spec.channel || spec.source_channel || spec.canal || ""));
  if (direct) labels.push(direct);
  const sources = spec.sources ?? spec.campaigns ?? [];
  for (const source of sources) {
    const label = smChannelLabel(String(source.channel || source.source_channel || source.canal || ""));
    if (label) labels.push(label);
  }
  const unique = labels.filter((label, index, arr) => label && arr.indexOf(label) === index);
  if (unique.length > 1) return "Mixto";
  return unique[0] || "";
}

function smBaseChannels(base: EstudioBase) {
  const summaryChannels = Array.isArray(base.surveymonkey_source_summary?.channels)
    ? base.surveymonkey_source_summary.channels.map((item) => smChannelLabel(String(item || ""))).filter(Boolean)
    : [];
  const sourceChannels = (base.surveymonkey_sources ?? [])
    .map((source) => smChannelLabel(String(source.channel || source.channel_key || "")))
    .filter(Boolean);
  const inferredSourceChannels = [
    ...smSourceSummariesFromSpec(base.surveymonkey_source_spec),
    ...smSourceSummariesFromFilter(base.response_filter),
  ].map((source) => source.channel).filter(Boolean);
  const fallback = [
    ...summaryChannels,
    ...sourceChannels,
    ...inferredSourceChannels,
    smChannelLabel(String(base.source_channel || "")),
    smChannelFromSpec(base.surveymonkey_source_spec),
  ].filter(Boolean);
  const unique = fallback.filter((label, index, arr) => arr.indexOf(label) === index);
  return unique.length > 1 ? unique.filter((label) => label !== "Mixto") : unique;
}

export function smBaseChannel(base: EstudioBase) {
  const summaryLabel = smChannelLabel(String(base.surveymonkey_source_summary?.channel_label || ""));
  if (summaryLabel) return summaryLabel;
  const channels = smBaseChannels(base);
  if (channels.length > 1) return "Mixto";
  return channels[0] || "";
}

export function smBaseChannelDetail(base: EstudioBase) {
  const channels = smBaseChannels(base);
  return channels.length > 1 ? channels.join(" + ") : channels[0] || "";
}

function smBaseHasMixedChannels(base: EstudioBase) {
  return smBaseChannels(base).length > 1 || smChannelLabel(String(base.surveymonkey_source_summary?.channel_label || "")) === "Mixto";
}

type SmSourceSummary = {
  sourceIndex: number | null;
  surveyId: string;
  title: string;
  channel: string;
  channelKey: string;
  consentVar: string;
  collectionStrategy: string;
  collectorIds: string[];
  collectorCount: number | null;
  validRecords: number | null;
  rawRecords: number | null;
  effectiveRecords: number | null;
  includedRecords: number | null;
  originalRecords: number | null;
  excludedRecords: number | null;
  entersData: boolean;
};

function smSpecConsentVar(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return "";
  return String(spec.consent_var || spec.consentimiento_var || "").trim();
}

function smNumberFromRecord(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function smStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  return raw ? smSplitScopeList(raw) : [];
}

function smChannelFromStrategy(value: string) {
  const key = smNormalizeSearch(value);
  if (key === "email" || key.includes("correo")) return "Correo";
  if (key.includes("web") || key.includes("link") || key.includes("online")) return "Correo";
  if (key.includes("whatsapp")) return "WhatsApp";
  if (key.includes("sms")) return "SMS";
  if (key.includes("campo") || key.includes("telefon")) return "Telefónico";
  return "";
}

function smSourceSummaryFromRecord(record: Record<string, unknown>, fallback: Partial<SmSourceSummary> = {}): SmSourceSummary {
  const surveyId = String(record.survey_id ?? record.id ?? fallback.surveyId ?? "").trim();
  const title = String(
    record.source_title ?? record.source_alias ?? record.label ?? record.title ?? fallback.title ?? surveyId,
  ).trim();
  const collectionStrategy = String(record.collection_strategy ?? fallback.collectionStrategy ?? "").trim();
  const explicitChannel = smChannelLabel(String(
    record.source_channel ?? record.channel ?? record.canal ?? record.channel_key ?? fallback.channel ?? fallback.channelKey ?? "",
  ));
  const channel = explicitChannel || smChannelFromStrategy(collectionStrategy);
  const rawRecords = smNumberFromRecord(record.raw_records ?? record.raw_total ?? record.original_rows ?? fallback.rawRecords ?? fallback.originalRecords);
  const effectiveRecords = smNumberFromRecord(record.effective_records ?? record.completed_with_consent ?? fallback.effectiveRecords);
  const includedRecords = smNumberFromRecord(record.included_records ?? record.included ?? record.kept_rows ?? fallback.includedRecords ?? fallback.validRecords);
  const validRecords = smNumberFromRecord(record.valid_records ?? includedRecords ?? effectiveRecords ?? record.kept_rows ?? fallback.validRecords);
  const excludedRecords = smNumberFromRecord(record.excluded_records ?? record.excluded ?? record.excluded_rows ?? fallback.excludedRecords);
  const collectorIds = [
    ...smStringList(record.collector_ids),
    ...smStringList(record.collector_id),
    ...(fallback.collectorIds ?? []),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
  const collectorCount = smNumberFromRecord(record.collector_count ?? fallback.collectorCount) ?? (collectorIds.length ? collectorIds.length : null);
  const consentVar = String(
    record.consent_var ?? record.consentimiento_var ?? record.consent_question ?? fallback.consentVar ?? "",
  ).trim();
  return {
    sourceIndex: smNumberFromRecord(record.index ?? fallback.sourceIndex),
    surveyId,
    title: title || surveyId || "Fuente SurveyMonkey",
    channel,
    channelKey: smChannelKey(channel),
    consentVar,
    collectionStrategy,
    collectorIds,
    collectorCount,
    validRecords,
    rawRecords,
    effectiveRecords,
    includedRecords,
    originalRecords: rawRecords,
    excludedRecords,
    entersData: Boolean(record.enters_data ?? fallback.entersData ?? ((validRecords ?? includedRecords ?? effectiveRecords ?? 0) > 0)),
  };
}

function smSourceSummariesFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null): SmSourceSummary[] {
  if (!spec) return [];
  const fallback = smSourceSummaryFromRecord(spec as unknown as Record<string, unknown>);
  const sources = spec.sources ?? spec.campaigns ?? [];
  const rows = sources.length
    ? sources.map((source) => smSourceSummaryFromRecord(source as unknown as Record<string, unknown>, fallback))
    : [fallback];
  return rows.filter((row) => row.surveyId || row.title);
}

function smSourceSummariesFromFilter(value: unknown): SmSourceSummary[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const sources = Array.isArray(record.sources) ? record.sources : [];
  if (sources.length) {
    return sources.map((source) => smSourceSummaryFromRecord(source as Record<string, unknown>));
  }
  return [smSourceSummaryFromRecord(record)];
}

export function smSourceSummariesFromBase(base: EstudioBase): SmSourceSummary[] {
  const fromPayload = Array.isArray(base.surveymonkey_sources)
    ? base.surveymonkey_sources.map((source) => smSourceSummaryFromRecord(source as unknown as Record<string, unknown>))
    : [];
  if (fromPayload.length) return fromPayload;
  const fromSpec = smSourceSummariesFromSpec(base.surveymonkey_source_spec);
  const fromFilter = smSourceSummariesFromFilter(base.response_filter);
  if (fromSpec.length) {
    const filterById = new Map(fromFilter.map((source) => [source.surveyId, source]));
    return fromSpec.map((source) => {
      const filter = filterById.get(source.surveyId);
      if (!filter) return source;
      return {
        ...source,
        channel: source.channel || filter.channel,
        consentVar: source.consentVar || filter.consentVar,
        collectionStrategy: source.collectionStrategy || filter.collectionStrategy,
        validRecords: source.validRecords ?? filter.validRecords,
        originalRecords: source.originalRecords ?? filter.originalRecords,
        excludedRecords: source.excludedRecords ?? filter.excludedRecords,
      };
    });
  }
  if (fromFilter.length) return fromFilter;
  return [smSourceSummaryFromRecord({
    survey_id: base.survey_id,
    source_title: base.source_title,
    source_alias: base.source_alias,
    source_channel: base.source_channel,
    consent_var: base.consent_var,
  })];
}

function smSpecWithPrimaryChannel(spec: SurveyMonkeyMultibaseSurveyInput | null | undefined, channel: string) {
  if (!spec) return null;
  const next: SurveyMonkeyMultibaseSurveyInput = {
    ...spec,
    channel,
    source_channel: channel,
  };
  const sourceItems = spec.sources ?? spec.campaigns;
  if (sourceItems?.length) {
    next.sources = sourceItems.map((source, index) => (
      index === 0 ? { ...source, channel, source_channel: channel } : { ...source }
    ));
    delete next.campaigns;
  }
  return next;
}

export function smSpecWithConsentVar(spec: SurveyMonkeyMultibaseSurveyInput | null | undefined, consentVar: string) {
  if (!spec) return null;
  const nextValue = consentVar.trim();
  const next: SurveyMonkeyMultibaseSurveyInput = { ...spec };
  if (nextValue) next.consent_var = nextValue;
  else delete next.consent_var;
  const sourceItems = spec.sources ?? spec.campaigns;
  if (sourceItems?.length) {
    next.sources = sourceItems.map((source) => {
      const copy: SurveyMonkeyMultibaseSurveyInput = { ...source };
      if (nextValue) copy.consent_var = nextValue;
      else delete copy.consent_var;
      return copy;
    });
    delete next.campaigns;
  }
  return next;
}

function smSpecSources(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return [];
  const sources = spec.sources ?? spec.campaigns ?? [];
  return sources.length ? sources : [spec];
}

function smScopeValueFromCollectorIds(value: unknown) {
  return smStringList(value).join(", ");
}

function smWithCollectorIds<T extends SurveyMonkeyMultibaseSurveyInput>(source: T, collectorIds: string[]) {
  const next: T = { ...source };
  if (collectorIds.length) next.collector_ids = collectorIds;
  else delete next.collector_ids;
  delete next.collector_id;
  return next;
}

export function smSpecWithSourceCollectors(
  spec: SurveyMonkeyMultibaseSurveyInput | null | undefined,
  sourceIndex: number,
  collectorIdsValue: string,
) {
  if (!spec) return null;
  const collectorIds = smSplitScopeList(collectorIdsValue);
  const sources = spec.sources ?? spec.campaigns ?? [];
  if (sources.length) {
    const nextSources = sources.map((source, index) => (
      index === sourceIndex ? smWithCollectorIds(source, collectorIds) : { ...source }
    ));
    const next: SurveyMonkeyMultibaseSurveyInput = {
      ...spec,
      sources: nextSources,
    };
    delete next.campaigns;
    if (sourceIndex === 0) {
      return smWithCollectorIds(next, collectorIds);
    }
    return next;
  }
  return sourceIndex === 0 ? smWithCollectorIds(spec, collectorIds) : { ...spec };
}

function smSpecFromFilterRecord(
  record: Record<string, unknown>,
  fallback: SurveyMonkeyMultibaseSurveyInput,
): SurveyMonkeyMultibaseSurveyInput {
  const surveyId = String(record.survey_id ?? record.id ?? fallback.survey_id ?? "").trim();
  const label = String(
    record.source_alias ?? record.label ?? record.source_title ?? fallback.source_alias ?? fallback.label ?? surveyId,
  ).trim();
  const channel = smChannelLabel(String(record.source_channel ?? record.channel ?? fallback.source_channel ?? fallback.channel ?? ""));
  const spec: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: surveyId,
    label: label || surveyId,
    source_alias: label || surveyId,
    source_title: String(record.source_title ?? fallback.source_title ?? label ?? surveyId).trim(),
    response_statuses: smStringList(record.statuses ?? record.response_statuses ?? fallback.response_statuses),
    keep_missing_status: Boolean(record.keep_missing_status ?? fallback.keep_missing_status ?? false),
    collector_ids: smStringList(record.collector_ids ?? record.collector_id),
    date_modified_gte: String(record.date_modified_gte ?? fallback.date_modified_gte ?? "").trim(),
    date_modified_lte: String(record.date_modified_lte ?? fallback.date_modified_lte ?? "").trim(),
    collection_strategy: String(record.collection_strategy ?? fallback.collection_strategy ?? "").trim(),
    channel,
    source_channel: channel,
    consent_var: String(record.consent_var ?? record.consentimiento_var ?? fallback.consent_var ?? fallback.consentimiento_var ?? "").trim(),
  };
  if (!spec.response_statuses?.length) delete spec.response_statuses;
  if (!spec.collector_ids?.length) delete spec.collector_ids;
  if (!spec.date_modified_gte) delete spec.date_modified_gte;
  if (!spec.date_modified_lte) delete spec.date_modified_lte;
  if (!spec.collection_strategy) delete spec.collection_strategy;
  if (!spec.channel) delete spec.channel;
  if (!spec.source_channel) delete spec.source_channel;
  if (!spec.consent_var) delete spec.consent_var;
  return spec;
}

function smSpecDraftFromBase(base: EstudioBase): SurveyMonkeyMultibaseSurveyInput | null {
  if (base.surveymonkey_source_spec) return base.surveymonkey_source_spec;
  const surveyId = String(base.survey_id || "").trim();
  if (!surveyId && !base.response_filter) return null;
  const label = String(base.source_alias || base.source_title || base.nombre || surveyId).trim();
  const channel = smChannelLabel(String(base.source_channel || ""));
  const fallback: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: surveyId,
    label,
    source_alias: label,
    source_title: String(base.source_title || label).trim(),
    channel,
    source_channel: channel,
    consent_var: String(base.consent_var || "").trim(),
    response_statuses: ["completed"],
    keep_missing_status: false,
  };
  const filter = base.response_filter;
  if (filter && typeof filter === "object") {
    const record = filter as Record<string, unknown>;
    const sourceRows = Array.isArray(record.sources) ? record.sources as Record<string, unknown>[] : [];
    if (sourceRows.length) {
      return {
        ...fallback,
        sources: sourceRows.map((source) => smSpecFromFilterRecord(source, fallback)),
      };
    }
    return {
      ...fallback,
      sources: [smSpecFromFilterRecord(record, fallback)],
    };
  }
  return surveyId ? fallback : null;
}

function smBaseConsentVar(base: EstudioBase) {
  const direct = String(base.consent_var || "").trim();
  if (direct) return direct;
  const specDirect = smSpecConsentVar(base.surveymonkey_source_spec);
  if (specDirect) return specDirect;
  return smSourceSummariesFromBase(base).find((source) => source.consentVar)?.consentVar || "";
}

type SmConsentOption = {
  name: string;
  label: string;
  type: string;
  positiveChoices: Array<{ name: string; label: string }>;
};

function smShortQuestionLabel(label: string, max = 62) {
  const clean = label.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function smXlsformVariableLabelLookup(base?: Pick<EstudioBase, "xlsform_variables"> | null) {
  const lookup = new Map<string, string>();
  for (const item of base?.xlsform_variables ?? []) {
    const name = String(item.name || "").trim();
    if (!name || lookup.has(name)) continue;
    lookup.set(name, String(item.label || "").replace(/\s+/g, " ").trim());
  }
  return lookup;
}

function smConsentOptions(base: EstudioBase) {
  const variables = base.xlsform_variables ?? [];
  const byName = new Map<string, SmConsentOption>();
  for (const item of variables) {
    const name = String(item.name || "").trim();
    if (!name) continue;
    const type = String(item.type || "").trim();
    if (type && type !== "select_one") continue;
    byName.set(name, {
      name,
      label: String(item.label || "").trim(),
      type,
      positiveChoices: (item.positive_choices ?? []).map((choice) => ({
        name: String(choice.name || "").trim(),
        label: String(choice.label || "").trim(),
      })).filter((choice) => choice.name || choice.label),
    });
  }
  for (const name of base.consent_candidates ?? []) {
    const key = String(name || "").trim();
    if (key && !byName.has(key)) byName.set(key, { name: key, label: "", type: "", positiveChoices: [] });
  }
  const current = smBaseConsentVar(base);
  if (current && !byName.has(current)) byName.set(current, { name: current, label: "", type: "", positiveChoices: [] });
  const candidateSet = new Set((base.consent_candidates ?? []).map((name) => String(name || "").trim()).filter(Boolean));
  return Array.from(byName.values()).sort((a, b) => {
    const aCandidate = candidateSet.has(a.name) || a.name === current;
    const bCandidate = candidateSet.has(b.name) || b.name === current;
    if (aCandidate !== bCandidate) return aCandidate ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });
}

function smDecisionVariableOptions(base: EstudioBase) {
  const rows = (base.xlsform_variables ?? [])
    .map((item) => ({
      name: String(item.name || "").trim(),
      label: String(item.label || "").trim(),
      type: String(item.type || "").trim(),
    }))
    .filter((item) => item.name);
  const seen = new Set<string>();
  return rows.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

function smConsentFilterInfo(base: EstudioBase) {
  const value = smBaseConsentVar(base);
  const option = smConsentOptions(base).find((item) => item.name === value);
  const approved = option?.positiveChoices?.length ? option.positiveChoices : [{ name: "1", label: "Sí" }];
  return {
    value,
    label: option?.label || "",
    approved,
  };
}

function smIndependentTemplateBase(estudio: EstudioPayload, bases: EstudioBase[]) {
  const available = new Set(bases.map((base) => base.nombre));
  const candidates = [
    String(estudio.independent_siblings?.template_base || ""),
    String(estudio.active_base || ""),
    bases[0]?.nombre || "",
  ];
  return candidates.find((candidate) => candidate && available.has(candidate)) || "";
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

function smSourceMetricLabel(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "S/D" : value.toLocaleString("es-PE");
}

function smSourceCollectorLabel(source: SmSourceSummary) {
  if (source.collectorIds.length) {
    return `${source.collectorIds.length} filtro${source.collectorIds.length === 1 ? "" : "s"}`;
  }
  if (source.collectorCount != null && source.collectorCount > 0) {
    return `${source.collectorCount} recopilador${source.collectorCount === 1 ? "" : "es"}`;
  }
  return "Todos";
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

function smDecisionNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function smDecisionOptionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function smDecisionRowsImpactText(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) {
    return "Cuando termine el recálculo se mostrará si el total sube, baja o queda igual.";
  }
  const currentLabel = currentRows.toLocaleString("es-PE");
  const previewLabel = previewRows.toLocaleString("es-PE");
  const delta = previewRows - currentRows;
  if (delta > 0) {
    return `Si aplicas ahora, la base activa pasará de ${currentLabel} a ${previewLabel} casos: entrarán ${delta.toLocaleString("es-PE")} casos adicionales.`;
  }
  if (delta < 0) {
    return `Si aplicas ahora, la base activa pasará de ${currentLabel} a ${previewLabel} casos: saldrán ${Math.abs(delta).toLocaleString("es-PE")} casos que ya no cumplen estas reglas.`;
  }
  return `Si aplicas ahora, la base activa quedará con ${currentLabel} casos; no cambia el total, pero sí se reescribe con estas reglas.`;
}

function smDecisionRowsLabel(value: number | null) {
  return value == null ? "pendiente" : value.toLocaleString("es-PE");
}

function smDecisionRowsDeltaLabel(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) return "por calcular";
  const delta = previewRows - currentRows;
  if (delta > 0) return `+${delta.toLocaleString("es-PE")}`;
  if (delta < 0) return `-${Math.abs(delta).toLocaleString("es-PE")}`;
  return "0";
}

function smDecisionRowsDeltaTone(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) return "is-pending";
  const delta = previewRows - currentRows;
  if (delta > 0) return "is-up";
  if (delta < 0) return "is-down";
  return "is-even";
}

function smDecisionInitialPolicy(base: EstudioBase): SurveyMonkeyDecisionPolicy {
  const saved = base.surveymonkey_decision_policy ?? {};
  const consentVar = String(saved.consent_var || smBaseConsentVar(base) || "").trim();
  return {
    version: 1,
    statuses: saved.statuses?.length ? saved.statuses : ["completed"],
    collector_ids: saved.collector_ids ?? [],
    consent_var: consentVar,
    consent_yes_values: saved.consent_yes_values?.length ? saved.consent_yes_values : ["1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted"],
    rejection_var: String(saved.rejection_var || consentVar || "").trim(),
    rejection_values: saved.rejection_values?.length ? saved.rejection_values : ["0", "no", "no acepta", "no acepto", "rechaza", "rechazo"],
    include_partials: saved.include_partials === true,
    partial_min_answers: Math.max(10, Number(saved.partial_min_answers ?? 15) || 15),
    include_rejections: saved.include_rejections === true,
    duplicate_key_vars: saved.duplicate_key_vars?.length ? saved.duplicate_key_vars : ["cv_id", "custom_value", "recipient_id"],
    include_duplicates: saved.include_duplicates !== false,
    duplicate_keep: saved.duplicate_keep || "first",
    manual_include_case_uids: saved.manual_include_case_uids ?? [],
    edited: saved.edited === true,
    saved_at: saved.saved_at,
  };
}

function smDecisionStringList(values: unknown) {
  return Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean).sort()
    : [];
}

export function smDecisionPolicyFingerprint(policy: SurveyMonkeyDecisionPolicy | null | undefined) {
  const p = policy ?? {};
  return JSON.stringify({
    statuses: smDecisionStringList(p.statuses),
    collector_ids: smDecisionStringList(p.collector_ids),
    consent_var: String(p.consent_var || ""),
    consent_yes_values: smDecisionStringList(p.consent_yes_values),
    rejection_var: String(p.rejection_var || ""),
    rejection_values: smDecisionStringList(p.rejection_values),
    include_partials: p.include_partials === true,
    partial_min_answers: Math.max(10, Number(p.partial_min_answers ?? 15) || 15),
    include_rejections: p.include_rejections === true,
    duplicate_key_vars: smDecisionStringList(p.duplicate_key_vars),
    include_duplicates: p.include_duplicates !== false,
    duplicate_keep: String(p.duplicate_keep || "first"),
    manual_include_case_uids: smDecisionStringList(p.manual_include_case_uids),
  });
}

function smDecisionValuesToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function smDecisionTextToValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function smDecisionAuditReady(audit: SurveyMonkeyDecisionAudit | null) {
  return !!audit && typeof audit.raw_total !== "undefined" && Array.isArray(audit.sources);
}

function smDecisionDownstreamLabels(base: EstudioBase) {
  const status = base.status ?? {};
  const labels: string[] = [];
  if (status.validacion) labels.push("Validación");
  if (status.codificacion || status.codificacion_adaptada) labels.push("Codificación");
  if (status.analitica) labels.push("Analítica");
  if (status.graficos) labels.push("Gráficos");
  return labels;
}

function smDecisionDuplicateOptions(base: EstudioBase, variableOptions: ReturnType<typeof smDecisionVariableOptions>) {
  const metadata = [
    { name: "cv_id", label: "ID personalizado SurveyMonkey" },
    { name: "custom_value", label: "Custom value" },
    { name: "recipient_id", label: "Recipient ID" },
    { name: "response_id", label: "Response ID" },
    { name: "case_uid", label: "Survey + response" },
  ];
  const byName = new Map<string, { name: string; label?: string | null }>();
  for (const item of metadata) byName.set(item.name, item);
  for (const item of variableOptions) byName.set(item.name, item);
  if (!byName.has("p4")) byName.set("p4", { name: "p4", label: "Código PUCP disponible" });
  return Array.from(byName.values());
}

type SmDecisionCollectorOption = { id: string; label: string; count: number; source: string };

function smDecisionCollectorOptions(audit: SurveyMonkeyDecisionAudit | null) {
  const byId = new Map<string, SmDecisionCollectorOption>();
  for (const source of audit?.sources ?? []) {
    const sourceLabel = smDecisionSourceName(source);
    const names = new Map<string, string>();
    for (const collector of source.collectors ?? []) {
      const id = String(collector.id || "").trim();
      if (!id) continue;
      const name = String(collector.name || "").trim();
      if (name) names.set(id, name);
    }
    const ids = new Set<string>([
      ...Object.keys(source.collector_counts ?? {}),
      ...Array.from(names.keys()),
    ]);
    for (const rawId of ids) {
      const id = String(rawId || "").trim();
      if (!id || id === "(vacio)") continue;
      const name = names.get(id) || id;
      const count = Number(source.collector_counts?.[id] ?? 0) || 0;
      const existing = byId.get(id);
      if (existing) {
        existing.count += count;
        if (sourceLabel && !existing.source.includes(sourceLabel)) existing.source = [existing.source, sourceLabel].filter(Boolean).join(", ");
      } else {
        byId.set(id, {
          id,
          label: name === id ? id : `${name} · ${id}`,
          count,
          source: sourceLabel,
        });
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function smDecisionCollectorIsTest(collector: Pick<SmDecisionCollectorOption, "label" | "source">) {
  const text = smNormalizeSearch(`${collector.label || ""} ${collector.source || ""}`);
  return text.split(" ").includes("prueba");
}

export function smDecisionValidCollectorIds(collectorOptions: Array<Pick<SmDecisionCollectorOption, "id" | "label" | "source">>) {
  return collectorOptions
    .filter((collector) => String(collector.id || "").trim() && !smDecisionCollectorIsTest(collector))
    .map((collector) => String(collector.id).trim());
}

export function smDecisionPolicyForSurveyMonkeyCommit(
  policy: SurveyMonkeyDecisionPolicy,
  collectorOptions: Array<Pick<SmDecisionCollectorOption, "id" | "label" | "source">>,
) {
  const validIds = smDecisionValidCollectorIds(collectorOptions);
  if (!validIds.length) return { ...policy, edited: true };
  const validSet = new Set(validIds);
  const current = (policy.collector_ids?.length ? policy.collector_ids : validIds)
    .map(String)
    .filter((id) => validSet.has(id));
  return {
    ...policy,
    collector_ids: current.length ? Array.from(new Set(current)) : validIds,
    edited: true,
  };
}

function smDecisionSourceName(source: SurveyMonkeyDecisionSourceAudit | null | undefined) {
  return String(source?.source_title || source?.source_label || source?.source_alias || source?.survey_id || "Fuente").trim();
}

function smDecisionDuplicateOptionLabel(option: { name: string; label?: string | null }) {
  const friendly: Record<string, string> = {
    cv_id: "ID del enlace personalizado",
    custom_value: "Valor personalizado del enlace",
    recipient_id: "Destinatario SurveyMonkey",
    response_id: "Respuesta SurveyMonkey",
    case_uid: "Encuesta + respuesta",
    p4: "Código PUCP",
  };
  return friendly[option.name] || (option.label ? `${smShortQuestionLabel(option.label, 52)} (${option.name})` : option.name);
}

function smDecisionQuestionOptionLabel(option: { name: string; label?: string | null }, max = 62) {
  const label = String(option.label || "").trim();
  if (!label) return option.name;
  return `${smShortQuestionLabel(label, max)} (${option.name})`;
}

function smCollectorFriendlyName(label: string, id: string) {
  const cleanLabel = String(label || "").trim();
  const cleanId = String(id || "").trim();
  if (!cleanLabel) return "Recopilador sin nombre";
  const idSuffix = cleanId ? ` · ${cleanId}` : "";
  const out = cleanLabel.endsWith(idSuffix) ? cleanLabel.slice(0, -idSuffix.length) : cleanLabel;
  return out && out !== cleanId ? out : "Recopilador sin nombre";
}

function smDecisionCollectorStateLabel(collector: SmDecisionCollectorOption, isSelected: boolean) {
  if (smDecisionCollectorIsTest(collector)) return "Prueba";
  if (smDecisionNumber(collector.count) <= 0) return "Sin respuestas";
  if (isSelected) return "Entra";
  return "Desmarcado";
}

function smDecisionCollectorStateClass(label: string) {
  if (label === "Entra") return "is-state-in";
  if (label === "Prueba") return "is-state-test";
  if (label === "Sin respuestas") return "is-state-empty";
  return "is-state-out";
}

function smDecisionCollectorNameMap(audit: SurveyMonkeyDecisionAudit | null) {
  const out = new Map<string, string>();
  for (const source of audit?.sources ?? []) {
    for (const collector of source.collectors ?? []) {
      const id = String(collector.id || "").trim();
      const name = String(collector.name || "").trim();
      if (!id || !name || name === id) continue;
      out.set(id, name);
    }
  }
  return out;
}

function smDecisionCaseDecisionLabel(value: string) {
  const key = value.replace(/_/g, " ");
  const labels: Record<string, string> = {
    efectiva: "Incluida",
    excluida: "Fuera",
    parcial_excluida: "Parcial fuera",
    parcial_incluida: "Parcial incluida",
    rechazo_excluido: "Rechazo fuera",
    rechazo_incluido: "Rechazo incluido",
    duplicado_excluido: "Duplicado fuera",
    manual_incluida: "Rescate manual",
  };
  return labels[value] || key || "-";
}

type SmDecisionCaseRow = {
  campania: string;
  collector_id: string;
  collector_label: string;
  case_uid: string;
  survey_id: string;
  response_id: string;
  custom_id: string;
  estado: string;
  respondidas: string;
  answeredRequired: string;
  answerableRequired: string;
  completionLabel: string;
  completionRatio: number | null;
  nearComplete: boolean;
  decision: string;
  incluido: string;
  manual: boolean;
  duplicado: string;
  duplicateGroupSize: string;
  duplicateRank: string;
  duplicateKeptResponseId: string;
  duplicateCodeMatch: string;
  duplicateCareerMatch: string;
  duplicateEvidence: string;
  dateModified: string;
  observado: boolean;
  motivo: string;
};

function smDecisionRatio(value: unknown) {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export function smDecisionCaseRows(audit: SurveyMonkeyDecisionAudit | null) {
  const rows: SmDecisionCaseRow[] = [];
  const collectorNames = smDecisionCollectorNameMap(audit);
  for (const source of audit?.sources ?? []) {
    const sourceName = smDecisionSourceName(source);
    for (const item of source.cases ?? []) {
      const collectorId = String(item.collector_id || "");
      const collectorLabel = collectorNames.get(collectorId) || "Recopilador sin nombre";
      if (smDecisionCollectorIsTest({ label: collectorLabel, source: sourceName })) continue;
      rows.push({
        campania: sourceName,
        collector_id: collectorId,
        collector_label: collectorLabel,
        case_uid: String(item.case_uid || ""),
        survey_id: String(item.survey_id || source.survey_id || ""),
        response_id: String(item.response_id || ""),
        custom_id: String(item.cv_id || item.custom_value || item.recipient_id || item.p4 || ""),
        estado: String(item.response_status || ""),
        respondidas: String(item.answered_questions_count || ""),
        answeredRequired: String(item.answered_required_count || item.answered_questions_count || ""),
        answerableRequired: String(item.answerable_required_count || ""),
        completionLabel: String(item.answer_completion_label || item.answered_questions_count || ""),
        completionRatio: smDecisionRatio(item.answer_completion_ratio),
        nearComplete: item.near_complete === "1" || String(item.near_complete || "") === "true",
        decision: String(item.decision_class || ""),
        incluido: String(item.decision_included || ""),
        manual: item.decision_manual_include === "1" || String(item.decision_manual_include || "") === "true",
        duplicado: String(item.duplicate_status || ""),
        duplicateGroupSize: String(item.duplicate_group_size || ""),
        duplicateRank: String(item.duplicate_rank || ""),
        duplicateKeptResponseId: String(item.duplicate_kept_response_id || ""),
        duplicateCodeMatch: String(item.duplicate_code_match || ""),
        duplicateCareerMatch: String(item.duplicate_career_match || ""),
        duplicateEvidence: String(item.duplicate_evidence || ""),
        dateModified: String(item.date_modified || item.date_created || ""),
        observado: item.observed === true || String(item.observed || "") === "true",
        motivo: String(item.observation_reason || ""),
      });
    }
  }
  return rows.sort((a, b) => {
    const aObserved = a.observado === true ? 1 : 0;
    const bObserved = b.observado === true ? 1 : 0;
    if (aObserved !== bObserved) return bObserved - aObserved;
    const aPartial = /partial|parcial/i.test(`${a.estado} ${a.decision}`) ? 1 : 0;
    const bPartial = /partial|parcial/i.test(`${b.estado} ${b.decision}`) ? 1 : 0;
    if (aPartial !== bPartial) return bPartial - aPartial;
    const aRatio = a.completionRatio ?? -1;
    const bRatio = b.completionRatio ?? -1;
    if (aRatio !== bRatio) return bRatio - aRatio;
    return smDecisionNumber(b.answeredRequired) - smDecisionNumber(a.answeredRequired);
  });
}

function SmDecisionMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return (
    <span className={`pulso-sm-decision-metric is-${tone}`}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

function smDecisionCompareLabel(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "coincide") return "coincide";
  if (key === "difiere") return "difiere";
  return "sin dato";
}

function smDecisionCompareTone(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "coincide") return "is-match";
  if (key === "difiere") return "is-diff";
  return "is-empty";
}

function smDecisionShortDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function smDecisionPercentLabel(value: number | null) {
  if (value === null) return "";
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return `${percent}%`;
}

function smDecisionProgressWidth(value: number | null) {
  if (value === null) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

export function smDecisionDuplicateEvidenceLine(row: SmDecisionCaseRow) {
  if (!row.duplicateEvidence && !row.duplicateGroupSize) return "";
  const groupSize = Number(row.duplicateGroupSize);
  const groupCopy = Number.isFinite(groupSize) && groupSize > 1
    ? `${groupSize} respuestas con el mismo ID enlace`
    : row.duplicateEvidence
      .replace(/\bcv_id\b/g, "ID enlace")
      .replace(/\brecipient_cv_id\b/g, "ID enlace")
      .replace(/custom_variables\.ID/gi, "ID enlace");
  const parts = [
    groupCopy,
    row.duplicateKeptResponseId ? `Se conserva: ${row.duplicateKeptResponseId}` : "",
    row.dateModified ? `Este caso: ${smDecisionShortDate(row.dateModified)}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
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
        <label className={`pulso-sm-filter-toggle${observedOnly ? " is-active" : ""}`}>
          <input
            type="checkbox"
            checked={observedOnly}
            onChange={(event) => setObservedOnly(event.target.checked)}
          />
          <span>Solo observados</span>
          <small>{observedTotal}</small>
        </label>
        <label className={`pulso-sm-filter-toggle${nearCompleteOnly ? " is-active" : ""}`}>
          <input
            type="checkbox"
            checked={nearCompleteOnly}
            onChange={(event) => setNearCompleteOnly(event.target.checked)}
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
                  <input
                    type="checkbox"
                    checked={policy.include_partials === true}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ include_partials: event.target.checked })}
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
                  <input
                    type="checkbox"
                    checked={policy.include_duplicates !== false}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ include_duplicates: event.target.checked })}
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
                  <input
                    type="checkbox"
                    checked={policy.include_rejections === true}
                    disabled={disabled || !!busy}
                    onChange={(event) => updatePolicy({ include_rejections: event.target.checked })}
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

function smChannelIcon(key: string) {
  if (key === "correo") return Mail;
  if (key === "telefono") return PhoneCall;
  if (key === "whatsapp" || key === "sms") return MessageCircle;
  if (key === "presencial") return QrCode;
  return Route;
}

function smNewScopeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `source_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function smTextShortcutGuard(event: KeyboardEvent<HTMLInputElement>) {
  if (event.metaKey || event.ctrlKey) event.stopPropagation();
}

function smClipboardGuard(event: ClipboardEvent<HTMLInputElement>) {
  event.stopPropagation();
}

const SM_DEFAULT_BASE_URL = "https://api.surveymonkey.com/v3";
const smCollectorCatalogCache = new Map<string, SurveyMonkeyMultibaseCollector[]>();

function smCollectorCacheKey(surveyId: string, baseUrl = SM_DEFAULT_BASE_URL) {
  return `${baseUrl}::${surveyId.trim()}`;
}

function smCollectorDisplayName(item: SurveyMonkeyMultibaseCollector) {
  const name = String(item.name || item.id || "Recopilador").trim();
  return name || item.id || "Recopilador";
}

function smCollectorTypeLabel(value: string) {
  const key = smNormalizeSearch(value);
  if (key.includes("email")) return "correo";
  if (key.includes("weblink") || key.includes("web_link") || key.includes("web link")) return "enlace";
  if (key.includes("sms")) return "SMS";
  if (key.includes("kiosk")) return "kiosko";
  return value || "tipo S/D";
}

function smCollectorResponseLabel(count: number | null) {
  if (count == null || !Number.isFinite(count)) return "conteo S/D";
  return `${count.toLocaleString("es-PE")} respuesta${count === 1 ? "" : "s"}`;
}

function smToggleCollectorId(current: string, collectorId: string, checked: boolean, orderedIds: string[]) {
  const set = new Set(smSplitScopeList(current));
  if (checked) set.add(collectorId);
  else set.delete(collectorId);
  const ordered = orderedIds.filter((id) => set.has(id));
  const trailing = Array.from(set).filter((id) => !orderedIds.includes(id));
  return [...ordered, ...trailing].join(", ");
}

function SmCollectorPicker({
  surveyId,
  value,
  disabled,
  onChange,
  label = "Recopiladores incluidos",
}: {
  surveyId: string;
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
    const cacheKey = smCollectorCacheKey(cleanSurveyId);
    const cached = smCollectorCatalogCache.get(cacheKey);
    if (cached) {
      setCollectors(cached);
      setError("");
      return;
    }
    setError("");
    setCollectors(null);
  }, [cleanSurveyId]);

  function loadCollectors() {
    if (!cleanSurveyId || loading) return;
    const cacheKey = smCollectorCacheKey(cleanSurveyId);
    const cached = smCollectorCatalogCache.get(cacheKey);
    if (cached) {
      setCollectors(cached);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    void apiSurveyMonkeyMultibaseCollectors(cleanSurveyId)
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
            Leer lista
          </button>
        </div>
      </div>
      <div className="pulso-sm-collector-options">
        {!cleanSurveyId && <small>Elige una encuesta para listar sus recopiladores.</small>}
        {!collectors && !loading && cleanSurveyId && !error && (
          <small>Se muestran los filtros guardados. Pulsa Leer lista solo si necesitas cambiar recopiladores.</small>
        )}
        {loading && <small><Loader2 size={12} className="pulso-spin" /> Leyendo recopiladores...</small>}
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

function smScopeStatuses(_scope?: SmImportScopeFields) {
  return ["completed"];
}

function smSplitScopeList(value: string) {
  return value
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function smScopeDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00+00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return `${raw}+00:00`;
  return raw;
}

function smValidationProfileForStrategy(strategy: SmImportScopeFields["collectionStrategy"]) {
  return strategy === "whatsapp_link" ? "admin_autoadministrado" : "";
}

function smHasScopeFilters(_scope: SmImportScopeFields) {
  return smSplitScopeList(_scope.collectorIds).length > 0
    || smScopeDate(_scope.dateModifiedGte).length > 0
    || smScopeDate(_scope.dateModifiedLte).length > 0;
}

function smDateLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Sin fecha";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "2-digit" });
}

export function smSurveyResponseCount(item: Pick<SurveyMonkeyMultibaseListItem, "response_count">) {
  if (item.response_count == null) return null;
  const value = Number(item.response_count);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function smSurveyResponseLabel(item: Pick<SurveyMonkeyMultibaseListItem, "response_count">) {
  const count = smSurveyResponseCount(item);
  if (count == null) return "Conteo no disponible";
  return `${count.toLocaleString("es-PE")} respuesta${count === 1 ? "" : "s"}`;
}

function smCatalogDateLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "sin refresco registrado";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function smScopeSummary(scope: SmImportScopeFields, nSources: number) {
  const parts: string[] = [];
  parts.push("Completas");
  const channel = smChannelLabel(scope.channel);
  if (channel) parts.push(channel);
  const collectors = smSplitScopeList(scope.collectorIds);
  if (collectors.length) parts.push(`${collectors.length} recopilador${collectors.length === 1 ? "" : "es"}`);
  if (nSources > 1) parts.push(`${nSources} campañas`);
  return parts.join(" · ");
}

function smSpecCollectorSummary(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  const sources = smSpecSources(spec);
  if (!sources.length) return "";
  const filtered = sources
    .map((source, index) => {
      const collectors = smStringList(source.collector_ids ?? source.collector_id);
      if (!collectors.length) return "";
      const label = String(source.source_alias || source.source_title || source.label || source.survey_id || `Fuente ${index + 1}`).trim();
      return `${label}: ${collectors.join(", ")}`;
    })
    .filter(Boolean);
  if (!filtered.length) return "Recopiladores: todos incluidos";
  return `Recopiladores filtrados · ${filtered.join(" · ")}`;
}

function smSurveyById(surveys: SurveyMonkeyMultibaseListItem[] | null | undefined, id: string) {
  const clean = id.trim();
  if (!clean) return null;
  return (surveys ?? []).find((item) => item.id === clean) ?? null;
}

function smKnownSourceCount(
  main: SurveyMonkeyMultibaseListItem,
  scope: SmImportScopeDraft,
  surveys: SurveyMonkeyMultibaseListItem[] | null,
) {
  const counts = [
    smSurveyResponseCount(main),
    ...scope.extraSources
      .filter((source) => source.surveyId.trim())
      .map((source) => smSurveyResponseCount(smSurveyById(surveys, source.surveyId) ?? { response_count: null })),
  ];
  if (counts.some((count) => count == null)) return null;
  return counts.reduce<number>((sum, count) => sum + Number(count), 0);
}

function smSourceCountLabel(count: number | null) {
  if (count == null) return "conteo parcial/no disponible";
  return `${count.toLocaleString("es-PE")} respuesta${count === 1 ? "" : "s"}`;
}

function smExtraSourceCandidates(
  surveys: SurveyMonkeyMultibaseListItem[] | null,
  query: string,
  excludeIds: Set<string>,
  context?: SurveyMonkeyMultibaseListItem,
) {
  const q = query.trim() || smExtraSourceDefaultQuery(context);
  return (surveys ?? [])
    .filter((item) => !excludeIds.has(item.id))
    .filter((item) => smSurveyMatchesQuery(item, q))
    .sort((a, b) => {
      const countDelta = (smSurveyResponseCount(b) ?? -1) - (smSurveyResponseCount(a) ?? -1);
      if (countDelta !== 0) return countDelta;
      return smSurveyTitle(a).localeCompare(smSurveyTitle(b), "es");
    })
    .slice(0, 6);
}

function smExtraSourceDefaultQuery(item?: SurveyMonkeyMultibaseListItem) {
  if (!item) return "";
  const alias = smSurveyDefaultAlias(item);
  const normalized = smNormalizeSearch(alias || smSurveyTitle(item));
  const stop = new Set([
    "acreditacion",
    "encuesta",
    "egresado",
    "egresados",
    "ingenieria",
    "de",
    "del",
    "la",
    "las",
    "los",
    "a",
    "pucp",
  ]);
  const tokens = normalized.split(" ").filter((token) => token.length > 2 && !stop.has(token));
  return tokens.slice(0, 3).join(" ");
}

function smNumberRangeLabel(values: number[], singular: string, plural = `${singular}s`) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return `Sin ${plural}`;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const noun = max === 1 ? singular : plural;
  return min === max ? `${max} ${noun}` : `${min}-${max} ${plural}`;
}

function smDiffKindLabel(kind: string) {
  const labels: Record<string, string> = {
    missing_or_extra: "Variables propias",
    structure: "Estructura distinta",
    options: "Opciones distintas",
    wording: "Fraseo distinto",
    company_list: "Lista de empresas",
    company_logic: "Lógica de empresas",
    metadata_optional: "Metadata opcional",
  };
  return labels[kind] ?? kind.replace(/_/g, " ");
}

function smRefreshAction(row: SurveyMonkeyRefreshBasePlan): string {
  if (row.refresh_action) return row.refresh_action;
  return row.updateable ? "update" : "blocked";
}

function smRefreshIsNoop(row: SurveyMonkeyRefreshBasePlan): boolean {
  const action = smRefreshAction(row);
  return action === "noop" || action === "noop_structure_warning";
}

function smRefreshStructureDetail(row: SurveyMonkeyRefreshBasePlan): { label: string; title: string } | null {
  const diffs = row.structure?.diffs ?? [];
  const blocking = diffs.filter((diff) => diff.severity === "blocking");
  const warningOnly = smRefreshAction(row) === "noop_structure_warning" || row.structure_warning_only === true;
  if (blocking.length) {
    const vars = blocking
      .map((diff) => diff.variable || `pos. ${diff.pos}`)
      .filter(Boolean);
    const visible = vars.slice(0, 4).join(", ");
    return {
      label: warningOnly
        ? `Revisar si llegan nuevas: ${visible}${vars.length > 4 ? ` +${vars.length - 4}` : ""}`
        : `Bloqueos en ${visible}${vars.length > 4 ? ` +${vars.length - 4}` : ""}`,
      title: blocking
        .map((diff) => `${diff.variable || `pos. ${diff.pos}`}: ${smDiffKindLabel(diff.kind)} - ${diff.message}`)
        .join(" · "),
    };
  }
  if (row.issues?.length) {
    return {
      label: row.issues.join(" · "),
      title: row.issues.join(" · "),
    };
  }
  const review = diffs.filter((diff) => diff.severity === "review");
  if (review.length) {
    const metadataReview = review.filter((diff) => diff.kind === "metadata_optional");
    const substantiveReview = review.filter((diff) => diff.kind !== "metadata_optional");
    const vars = (substantiveReview.length ? substantiveReview : metadataReview)
      .map((diff) => diff.variable || `pos. ${diff.pos}`)
      .filter(Boolean);
    const metadataVars = metadataReview
      .map((diff) => diff.variable || `pos. ${diff.pos}`)
      .filter(Boolean);
    const optionalMetadata = !substantiveReview.length && metadataReview.length > 0;
    const metadataSuffix = metadataReview.length && substantiveReview.length
      ? ` · metadata opcional ${metadataVars.slice(0, 3).join(", ")}${metadataVars.length > 3 ? ` +${metadataVars.length - 3}` : ""}`
      : "";
    return {
      label: `${optionalMetadata ? "Metadata opcional" : "Revisar"} ${vars.slice(0, 3).join(", ")}${vars.length > 3 ? ` +${vars.length - 3}` : ""}${metadataSuffix}`,
      title: review
        .map((diff) => `${diff.variable || `pos. ${diff.pos}`}: ${smDiffKindLabel(diff.kind)} - ${diff.message}`)
        .join(" · "),
    };
  }
  return null;
}

function smRefreshRowStatusText(row: SurveyMonkeyRefreshBasePlan): string {
  const action = smRefreshAction(row);
  if (action === "noop_structure_warning") return "Sin nuevas; se conserva la base actual";
  if (action === "noop") return "Sin nuevas; ya está al día";
  if (row.updateable) return "Se actualizará la base completa con sus fuentes guardadas";
  return "No se actualizará esta base";
}

function smRefreshSourcesText(sources: SmSourceSummary[]) {
  if (!sources.length) return "";
  return sources
    .map((source) => `${source.title}${source.channel ? ` (${source.channel})` : ""}`)
    .join(" · ");
}

function smRefreshResultSourcesText(row: SurveyMonkeyRefreshResult["results"][number]) {
  const sources = row.sources ?? [];
  if (!sources.length) return "";
  return sources
    .map((source) => {
      const title = String(source.source_title || source.source_alias || source.survey_id || "Fuente").trim();
      const channel = smChannelLabel(String(source.channel || ""));
      const status = String(source.status || "").replace(/_/g, " ");
      return `${title}${channel ? ` (${channel})` : ""}: ${status || (source.refreshed ? "actualizada" : "no actualizada")}`;
    })
    .join(" · ");
}

function smDiffSeverityLabel(severity: SurveyMonkeyMultibaseDiff["severity"]) {
  if (severity === "blocking") return "Estructura";
  if (severity === "special") return "Especial";
  return "Revisión";
}

function smSurveyAuditLabel(
  surveyId: string,
  audit: SurveyMonkeyMultibaseAudit,
  selectedInputs: SurveyMonkeyMultibaseSurveyInput[],
) {
  const input = selectedInputs.find((item) => item.survey_id === surveyId);
  const summary = audit.surveys.find((item) => item.survey_id === surveyId);
  return input?.source_alias || input?.label || summary?.label || summary?.title || surveyId;
}

function smSurveyDefaultAlias(item: SurveyMonkeyMultibaseListItem) {
  return smCompactSurveyLikeLabel(smSurveyTitle(item));
}

function smSurveyAlias(item: SurveyMonkeyMultibaseListItem, draft?: SmImportScopeDraft) {
  const alias = (draft?.alias ?? smSurveyDefaultAlias(item)).trim();
  return alias || smSurveyDefaultAlias(item);
}

function smAliasDraftValue(item: SurveyMonkeyMultibaseListItem, draft?: SmImportScopeDraft) {
  return draft?.alias ?? smSurveyDefaultAlias(item);
}

function smSourceInputFromScope(
  surveyId: string,
  label: string,
  scope: SmImportScopeFields,
  meta?: { sourceAlias?: string; sourceTitle?: string },
): SurveyMonkeyMultibaseSurveyInput {
  const input: SurveyMonkeyMultibaseSurveyInput = { survey_id: surveyId };
  if (label.trim()) input.label = label.trim();
  if (meta?.sourceAlias?.trim()) input.source_alias = meta.sourceAlias.trim();
  if (meta?.sourceTitle?.trim()) input.source_title = meta.sourceTitle.trim();
  input.response_statuses = smScopeStatuses(scope);
  input.keep_missing_status = false;
  const collectorIds = smSplitScopeList(scope.collectorIds);
  if (collectorIds.length) input.collector_ids = collectorIds;
  const dateModifiedGte = smScopeDate(scope.dateModifiedGte);
  const dateModifiedLte = smScopeDate(scope.dateModifiedLte);
  if (dateModifiedGte) input.date_modified_gte = dateModifiedGte;
  if (dateModifiedLte) input.date_modified_lte = dateModifiedLte;
  input.collection_strategy = scope.collectionStrategy;
  const channel = smChannelLabel(scope.channel);
  if (channel) {
    input.channel = channel;
    input.source_channel = channel;
  }
  const validationProfile = smValidationProfileForStrategy(scope.collectionStrategy);
  if (validationProfile) input.validation_exclusion_profile = validationProfile;
  return input;
}

export function smIndependentSurveyInput(
  item: SurveyMonkeyMultibaseListItem,
  draft?: SmImportScopeDraft,
): SurveyMonkeyMultibaseSurveyInput {
  const label = smSurveyAlias(item, draft);
  const sourceTitle = smSurveyTitle(item);
  const input: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: item.id,
    label,
    source_alias: label,
    source_title: sourceTitle,
    pais: item.pais_guess ?? "",
    response_statuses: ["completed"],
    keep_missing_status: false,
  };
  const baseScope = draft ?? smDefaultScopeDraft();
  input.collection_strategy = baseScope.collectionStrategy;
  const baseChannel = smChannelLabel(baseScope.channel);
  if (baseChannel) {
    input.channel = baseChannel;
    input.source_channel = baseChannel;
  }
  const validationProfile = smValidationProfileForStrategy(baseScope.collectionStrategy);
  if (validationProfile) input.validation_exclusion_profile = validationProfile;
  if (!draft) return input;

  const extraSources = draft.extraSources
    .filter((source) => source.surveyId.trim())
    .map((source) => smSourceInputFromScope(
      source.surveyId.trim(),
      source.label.trim() || label,
      source,
      { sourceAlias: source.label.trim() || label },
    ));
  if (smHasScopeFilters(draft) || extraSources.length) {
    input.sources = [
      smSourceInputFromScope(item.id, label, draft, { sourceAlias: label, sourceTitle }),
      ...extraSources,
    ];
  }
  return input;
}

export function smCampaignInputFromSurvey(
  item: SurveyMonkeyMultibaseListItem,
  draft?: SmImportScopeFields & { alias?: string },
): SurveyMonkeyMultibaseSurveyInput {
  const scope = draft ?? smDefaultScopeDraft();
  const label = (draft?.alias ?? smSurveyDefaultAlias(item)).trim() || smSurveyDefaultAlias(item);
  return smSourceInputFromScope(
    item.id,
    label,
    scope,
    { sourceAlias: label, sourceTitle: smSurveyTitle(item) },
  );
}

function smSelectedCampaignInputs(
  item: SurveyMonkeyMultibaseListItem,
  draft: SmImportScopeDraft,
  surveys: SurveyMonkeyMultibaseListItem[] | null,
) {
  const inputs = [smCampaignInputFromSurvey(item, draft)];
  for (const source of draft.extraSources) {
    const sourceId = source.surveyId.trim();
    if (!sourceId) continue;
    const picked = smSurveyById(surveys, sourceId);
    const fallbackItem: SurveyMonkeyMultibaseListItem = {
      id: sourceId,
      title: source.label || sourceId,
      nickname: "",
      date_modified: "",
      pais_guess: "",
      response_count: null,
    };
    const sourceItem = picked ?? fallbackItem;
    inputs.push(smCampaignInputFromSurvey(sourceItem, {
      ...source,
      alias: source.label.trim() || smSurveyDefaultAlias(sourceItem),
    }));
  }
  return inputs;
}

function IndependentSiblingsSurveyMonkeyWizard({
  estudio,
  canonicalOptions,
  disabled,
  onImported,
}: {
  estudio: EstudioPayload;
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
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, SmImportScopeDraft>>({});
  const [audit, setAudit] = useState<SurveyMonkeyMultibaseAudit | null>(null);
  const [logicSync, setLogicSync] = useState<EstudioLogicSyncResult | null>(null);
  const [canonicalRepairResult, setCanonicalRepairResult] = useState<EstudioLogicSyncResult | null>(null);
  const [canonicalFileId, setCanonicalFileId] = useState(canonicalOptions[0]?.fileId ?? "");
  const [surveyMonkeyLogicRules, setSurveyMonkeyLogicRules] = useState("");
  const [surveyMonkeyLogicPreview, setSurveyMonkeyLogicPreview] = useState<SmLogicPreviewRow[] | null>(null);
  const [smConnection, setSmConnection] = useState<ConnectionTokenState | null>(null);
  const [showSurveyCatalog, setShowSurveyCatalog] = useState(estudio.n_bases === 0);
  const [refreshPlan, setRefreshPlan] = useState<SurveyMonkeyRefreshPlan | null>(null);
  const [refreshResult, setRefreshResult] = useState<SurveyMonkeyRefreshResult | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookFileId, setWorkbookFileId] = useState("");
  const [workbookInspection, setWorkbookInspection] = useState<SurveyMonkeyWorkbookInspection | null>(null);
  const [workbookImportResult, setWorkbookImportResult] = useState<SurveyMonkeyWorkbookImportResult | null>(null);
  const [koboRefreshResult, setKoboRefreshResult] = useState<KoboIndependentRefreshResult | null>(null);
  const [savBundleFile, setSavBundleFile] = useState<File | null>(null);
  const [savBundleFileId, setSavBundleFileId] = useState("");
  const [savBundleInspection, setSavBundleInspection] = useState<SurveyMonkeySavBundleInspection | null>(null);
  const [savBundleImportResult, setSavBundleImportResult] = useState<SurveyMonkeySavBundleImportResult | null>(null);
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
  const { maxBases: independentMaxBases, capacityLeft } = independentSiblingsCapacity(estudio);
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
  const canImportSavBundle = smSavBundleInspectionCanImport(savBundleInspection) && !busy && !disabled;
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
    void loadProcessingSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSmConnection(await apiConnectionTokenLoad("surveymonkey"));
    } catch {
      setSmConnection(null);
    }
  }

  async function switchSurveyMonkeyProfile(profileId: string) {
    if (!profileId) return;
    setError("");
    setBusy("Cambiando perfil SurveyMonkey...");
    try {
      const next = await apiConnectionProfileSetDefault("surveymonkey", profileId);
      setSmConnection(next);
      setSurveys(null);
      setSurveyMeta(null);
      setAudit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function loadSurveys(forceRefresh = false) {
    setError("");
    setBusy(forceRefresh ? "Actualizando catálogo SurveyMonkey..." : "Leyendo catálogo local SurveyMonkey...");
    try {
      await refreshSurveyMonkeyConnection();
      const result = await apiSurveyMonkeyMultibaseListSurveys("", 500, 6, { forceRefresh });
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
    setBusy(assets.length === 1 ? "Importando Kobo como fuente independiente..." : "Importando Kobo como fuentes independientes...");
    try {
      const result = await apiCargaImportKoboIndependent({ assets });
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
    setBusy(targets.length === 1 ? "Actualizando base Kobo..." : "Actualizando bases Kobo...");
    try {
      const result = await apiCargaRefreshKoboIndependent({ base_names: targets });
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
        const result = await apiSurveyMonkeyMultibaseImportIndependent({
          surveys: selectedInputs,
          response_statuses: ["completed"],
          keep_missing_status: false,
          canonical_xlsform_file_id: canonicalFileId,
          use_canonical_xlsform_logic: hasCanonicalReference,
          surveymonkey_logic_rules: surveyMonkeyLogicRules.trim() || undefined,
          surveymonkey_logic_rules_by_survey: Object.keys(surveySpecificLogicRulesBySurvey).length
            ? surveySpecificLogicRulesBySurvey
            : undefined,
        });
        setAudit(result.audit);
        if (result.xlsform_logic_sync) setLogicSync(result.xlsform_logic_sync);
        latestEstudio = result.estudio;
      }
      if (hasMergeCampaigns) {
        const result = await apiSurveyMonkeyMultibaseRefresh({
          bases: mergePayload,
          months: 12,
          reapply_codificacion: true,
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

  function pickSavBundleFile(file: File | null) {
    setSavBundleFile(file);
    setSavBundleFileId("");
    setSavBundleInspection(null);
    setSavBundleImportResult(null);
    setError("");
  }

  async function inspectSavBundle() {
    if (!savBundleFile && !savBundleFileId) return;
    setError("");
    setSavBundleInspection(null);
    setSavBundleImportResult(null);
    setBusy("Inspeccionando ZIP SAV...");
    try {
      let fileId = savBundleFileId;
      if (!fileId) {
        if (!savBundleFile) throw new Error("Selecciona un ZIP con archivos .sav.");
        const upload = await apiUpload(savBundleFile, "sav_bundle");
        fileId = upload.file_id;
        setSavBundleFileId(fileId);
      }
      const result = await apiSurveyMonkeyMultibaseSavBundleInspect({
        file_id: fileId,
        missing_required_policy: "fill_blank_warn",
      });
      setSavBundleInspection(result);
      if (!result.ok) {
        setError("Hay archivos SAV sin base asignada o asignaciones duplicadas. Revisa los nombres antes de aplicar.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function importSavBundle() {
    if (!savBundleFileId || !savBundleInspection) return;
    setError("");
    setSavBundleImportResult(null);
    setBusy("Aplicando actualización ZIP SAV...");
    try {
      const result = await apiSurveyMonkeyMultibaseSavBundleImport({
        file_id: savBundleFileId,
        missing_required_policy: "fill_blank_warn",
      });
      setSavBundleImportResult(result);
      setSavBundleInspection(result.inspection);
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
      const result = await apiSurveyMonkeyMultibaseRefresh({
        bases: (refreshPlan.bases ?? []).map((row) => ({ base_name: row.base_name })),
        months: 12,
        reapply_codificacion: true,
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
    setBusy(`Regenerando respaldo de ${base.source_alias || base.source_title || baseName}...`);
    try {
      const result = await apiSurveyMonkeyMultibaseRefresh({
        bases: [{ base_name: baseName }],
        months: 12,
        force_refresh: true,
        reapply_codificacion: false,
        regenerate_raw_snapshot: true,
        raw_snapshot_only: true,
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
          <p>Importa cada fuente con su propio formulario, respuestas y estado de procesamiento.</p>
          <p>
            Usa los perfiles activos en Ajustes. Si una clave llega al límite,
            cambia manualmente al perfil secundario y actualiza el catálogo correspondiente.
            Si ya tenías una base trabajada, esa base puede actuar como referencia para sincronizar reglas compatibles.
          </p>
          <div className="pulso-sm-family-meter pulso-sm-independent-meter" aria-label="Resumen de familia independiente">
            <span><b>{selectedTotal}</b>/{independentMaxBases} bases</span>
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
            <label htmlFor="pulso-sm-logic-rules">Reglas SurveyMonkey</label>
            <div className="pulso-sm-logic-reference-rules-actions">
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || surveyMonkeyLogicRuleLines.length === 0}
                onClick={() => void runSurveyMonkeyLogicPreview()}
                title="Validar sintaxis e interpretación básica antes de importar"
              >
                {busy === "Validando reglas SurveyMonkey..." ? <Loader2 size={12} className="pulso-spin" /> : <CheckCircle2 size={12} />}
                Validar reglas
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
            placeholder={monitoringLogicSuggestion || "Q1 = C1 => Ocultar P2."}
            onChange={(event) => {
              setSurveyMonkeyLogicRules(event.target.value);
              setSurveyMonkeyLogicPreview(null);
              setAudit(null);
            }}
          />
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
              Sugerida por Monitoreo para fuentes SurveyMonkey con enlaces personalizados; revisa Q/P antes de importar.
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
            <span>{estudio.n_bases}/{independentMaxBases} bases · listas para procesar por base activa</span>
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
          <div className="pulso-sm-workbook-import is-sav" aria-label="Importar ZIP SAV SurveyMonkey">
            <div className="pulso-sm-family-config-head">
              <div>
                <strong>Importar ZIP SAV</strong>
                <span>
                  Reemplaza de forma controlada las respuestas activas de bases existentes. El formulario de cada carrera se conserva.
                </span>
              </div>
              <div className="pulso-sm-family-actions">
                <button
                  type="button"
                  className="pulso-sm-secondary"
                  disabled={disabled || !!busy || !savBundleFile}
                  onClick={inspectSavBundle}
                >
                  {busy ? <Loader2 size={13} className="pulso-spin" /> : <Database size={13} />}
                  Inspeccionar
                </button>
                <button
                  type="button"
                  disabled={!canImportSavBundle}
                  onClick={importSavBundle}
                >
                  {busy ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                  Aplicar actualización
                </button>
              </div>
            </div>
            <div className="pulso-sm-workbook-toolbar">
              <FilePicker
                icon={Database}
                title="ZIP con SAV"
                accept=".zip,application/zip,application/x-zip-compressed"
                acceptLabel="ZIP"
                file={savBundleFile}
                onPick={pickSavBundleFile}
              />
              <div className="pulso-sm-workbook-summary">
                {savBundleInspection ? (
                  <>
                    <span className={`pulso-sm-family-status${savBundleInspection.ok ? "" : " is-warning"}`}>
                      {savBundleInspection.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {savBundleInspection.n_matched}/{savBundleInspection.n_files} archivos listos
                    </span>
                    <small>
                      {smSavBundleInspectionWarningCount(savBundleInspection)} advertencias · {savBundleInspection.filename}
                    </small>
                    <small>Se reemplazarán solo las respuestas. El formulario no cambiará.</small>
                  </>
                ) : (
                  <>
                    <span className="pulso-sm-family-status is-neutral">
                      <Database size={12} />
                      Sin inspección
                    </span>
                    <small>Los archivos .sav se emparejan por carrera y se preparan contra el formulario vigente.</small>
                  </>
                )}
              </div>
            </div>
            {savBundleInspection && !savBundleImportResult && (
              <div className="pulso-sm-multibase-warning">
                <AlertTriangle size={15} />
                <span>
                  Plan inspeccionado pendiente de aplicar. Todavía no se reemplazó ninguna base ni se guardó el ZIP en el proyecto:
                  pulsa <strong>Aplicar actualización</strong> para cambiar las respuestas activas.
                </span>
              </div>
            )}
            {savBundleInspection && (
              <div className="pulso-sm-family-table is-sav-bundle" role="table" aria-label="Plan de actualización ZIP SAV">
                <div className="pulso-sm-family-row is-head is-sav-row" role="row">
                  <span>Archivo</span>
                  <span>Base</span>
                  <span>Actualmente</span>
                  <span>Después de aplicar</span>
                  <span>Impacto</span>
                </div>
                {savBundleInspection.files.map((file) => {
                  const issueGroups = smSavBundleIssueGroups(file);
                  const hasIssues = issueGroups.length > 0;
                  const issueVariableCount = issueGroups.reduce((sum, group) => sum + group.variables.length + group.notes.length, 0);
                  const fileBase = file.base_name ? existingBaseByName.get(file.base_name) : undefined;
                  const fileLabelLookup = smXlsformVariableLabelLookup(fileBase);
                  const currentRows = file.change_plan?.current?.n_rows;
                  const currentColumns = file.change_plan?.current?.n_columns;
                  const incoming = file.change_plan?.incoming;
                  return (
                    <div className={`pulso-sm-family-row is-sav-row${file.blocking ? " is-invalid" : hasIssues ? " is-warning" : ""}`} role="row" key={file.entry_name || file.file_name}>
                      <div className="pulso-sm-family-origin-cell">
                        <strong>{file.file_name || file.entry_name}</strong>
                        <small>{file.n_rows} filas · {file.n_columns} columnas SAV</small>
                      </div>
                      <div className="pulso-sm-family-origin-cell">
                        <strong>{file.base_name || "Sin match"}</strong>
                        <small>{file.matched ? "Match automático" : "Bloqueada"}</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className="pulso-sm-family-status is-neutral">
                          <Database size={12} />
                          {currentRows ?? "?"} filas
                        </span>
                        <small>{currentColumns ?? "?"} columnas actuales · formulario preservado</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className={`pulso-sm-family-status${file.blocking ? " is-warning" : " is-neutral"}`}>
                          {file.blocking ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {incoming?.normalized_rows ?? file.n_rows} filas
                        </span>
                        <small>{smSavBundleImpactLabel(file)}</small>
                      </div>
                      <div className="pulso-sm-family-data-cell">
                        <span className={`pulso-sm-family-status${hasIssues ? " is-warning" : " is-neutral"}`}>
                          {hasIssues ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {file.matched_variables}/{file.expected_variables} variables
                        </span>
                        <small title={[...file.warnings, ...file.all_empty_variables, ...file.missing_variables].join("\n")}>
                          {file.blocking ? smSavBundleIssueLabel(file) : smSavBundleVariableSummary(file)}
                        </small>
                      </div>
                      {issueGroups.length > 0 ? (
                        <div className="pulso-sm-sav-detail-tray" aria-label={`Detalle de advertencias para ${file.file_name || file.entry_name}`}>
                          <div className="pulso-sm-family-detail-head">
                            <span>
                              <AlertTriangle size={13} />
                              Motivos de revisión
                            </span>
                            <em>
                              {issueVariableCount} detalle{issueVariableCount === 1 ? "" : "s"} · {file.action === "replace_data" ? "reemplazo controlado" : file.action}
                            </em>
                          </div>
                          <div className="pulso-sm-sav-issue-grid">
                            {issueGroups.map((group) => (
                              <div className={`pulso-sm-sav-issue-card is-${group.tone}`} key={group.key}>
                                <strong>
                                  {group.label}
                                  <span>{group.variables.length || group.notes.length}</span>
                                </strong>
                                <p>{group.reason}</p>
                                {group.variables.length > 0 ? (
                                  <div className="pulso-sm-sav-variable-list" aria-label={`${group.label}: variables`}>
                                    {group.variables.map((variable) => {
                                      const variableLabel = smSavBundleVariableLabel(variable, fileLabelLookup);
                                      return (
                                        <span className="pulso-sm-sav-variable-item" key={variable} title={variableLabel ? `${variable} · ${variableLabel}` : variable}>
                                          <code>{variable}</code>
                                          <span>{variableLabel || "Sin etiqueta de formulario"}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {group.notes.length > 0 ? (
                                  <div className="pulso-sm-sav-note-list" aria-label={`${group.label}: notas`}>
                                    {group.notes.map((note) => (
                                      <span key={note}>{note}</span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {savBundleImportResult && (
              <div className="pulso-sm-multibase-warning">
                <CheckCircle2 size={15} />
                <span>
                  Actualizadas {savBundleImportResult.imported_bases} bases desde {savBundleImportResult.filename}. Se reemplazaron las respuestas activas y se conservó cada formulario.
                </span>
              </div>
            )}
          </div>
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
                ? `Perfil activo: ${smConnection.active_profile_alias || smConnection.active_profile_id || "Principal"}`
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
                  className={profile.is_default ? "is-active" : ""}
                  disabled={disabled || !!busy || profile.is_default || !profile.has_token}
                  onClick={() => void switchSurveyMonkeyProfile(profile.id)}
                  title={profile.has_token ? `Usar ${profile.alias}` : `${profile.alias} no tiene token guardado`}
                >
                  {profile.alias}
                </button>
              ))}
            </div>
          )}
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
              {visibleSurveys.length} disponibles de {surveyMeta?.totalRecent ?? surveys.length} encuestas modificadas en los últimos {surveyMeta?.months ?? 6} meses · {selectedInputs.length} bases nuevas · {selectedMergeCampaignCount} campañas/canales · {capacityLeft} cupos para bases nuevas
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
	                            placeholder="Opcional: Q1 != C1 => Ocultar P2."
	                            onChange={(event) => {
	                              updateScope(item.id, { logicRules: event.target.value });
	                              setSurveyMonkeyLogicPreview(null);
	                            }}
	                          />
	                          <small>Úsalo si SurveyMonkey movió Q1/Q2/Q3 por una pregunta adicional como Código Pulso.</small>
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
          Seleccionaste {selectedInputs.length} encuestas y quedan {capacityLeft} cupos. Este modo admite máximo {independentMaxBases} bases.
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
                      <em>{smDiffSeverityLabel(diff.severity)}</em>
                    </strong>
                    <span>{diff.message}</span>
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
function fileLabel(fileId?: string, fileName?: string) {
  const name = String(fileName ?? "").trim();
  if (name && name !== "NA") return name;
  const id = String(fileId ?? "").trim();
  return id || "Sin archivo";
}

function importedAtLabel(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "NA") return "Fecha no registrada";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function responseFilterLabel(filter?: Record<string, unknown> | null) {
  if (!filter || typeof filter !== "object") return "";
  const kind = String(filter.kind ?? "");
  const kept = filter.kept_rows == null || Number.isNaN(Number(filter.kept_rows))
    ? null
    : Number(filter.kept_rows);
  const sourceCount = filter.source_count == null || Number.isNaN(Number(filter.source_count))
    ? null
    : Number(filter.source_count);
  if (kind === "uploaded_data") return kept == null ? "Respuestas subidas" : `Respuestas subidas · ${kept} registros`;
  const parts: string[] = [];
  if (sourceCount && sourceCount > 1) parts.push(`${sourceCount} fuentes`);
  if (kept != null) parts.push(`${kept} filtradas`);
  const statuses = Array.isArray(filter.statuses) ? filter.statuses.map(String).filter(Boolean) : [];
  if (statuses.length) parts.push(statuses.join("/"));
  const collectors = Array.isArray(filter.collector_ids) ? filter.collector_ids.map(String).filter(Boolean) : [];
  if (collectors.length) parts.push(`recopilador ${collectors.join(", ")}`);
  const until = String(filter.date_modified_lte ?? "").trim();
  if (until && until !== "NA") parts.push(`hasta ${until.slice(0, 16).replace("T", " ")}`);
  return parts.join(" · ");
}

type HistoryRecord = Record<string, unknown>;
type LabelOverrideEntry = {
  key: string;
  value: string;
  origin: string;
  variable: string;
};
type LabelOverrideGroup = {
  origin: string;
  entries: LabelOverrideEntry[];
};
type VariantRow = {
  from: string;
  to: string;
  origin: string;
  ref: string;
};
type VariantGroup = {
  from: string;
  rows: VariantRow[];
};

function asHistoryRecord(value: unknown): HistoryRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as HistoryRecord : {};
}

export function integratedHistoryArray<T = HistoryRecord>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

export function integratedLabelOverrideEntries(meta?: EstudioMultiIntegrated | null) {
  const raw = asHistoryRecord(meta?.label_overrides_by_key);
  const out: LabelOverrideEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as HistoryRecord)) {
        out.push({
          key: `${key} · ${nestedKey}`,
          value: String(nestedValue ?? ""),
          origin: key,
          variable: nestedKey,
        });
      }
    } else {
      out.push({
        key,
        value: String(value ?? ""),
        origin: "Común",
        variable: key,
      });
    }
  }
  return out.filter((entry) => entry.key && entry.value && entry.value !== "[object Object]");
}

export function integratedStandardLabelEntries(meta?: EstudioMultiIntegrated | null) {
  const raw = asHistoryRecord(meta?.label_overrides_standard);
  return Object.entries(raw)
    .map(([key, value]) => ({
      key,
      value: String(value ?? ""),
      origin: "Final común",
      variable: key,
    }))
    .filter((entry) => entry.key && entry.value && entry.value !== "[object Object]");
}

export function integratedLabelOverrideGroups(meta?: EstudioMultiIntegrated | null): LabelOverrideGroup[] {
  const byOrigin = new Map<string, LabelOverrideEntry[]>();
  for (const entry of integratedLabelOverrideEntries(meta)) {
    const origin = entry.origin || "Común";
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), entry]);
  }
  return Array.from(byOrigin.entries())
    .map(([origin, entries]) => ({ origin, entries }))
    .sort((a, b) => b.entries.length - a.entries.length || a.origin.localeCompare(b.origin));
}

export function integratedVariantRows(meta?: EstudioMultiIntegrated | null): VariantRow[] {
  return integratedHistoryArray<HistoryRecord>(meta?.variant_map)
    .map((item) => ({
      from: String(item.from ?? ""),
      to: String(item.to ?? ""),
      origin: String(item.origin_key ?? ""),
      ref: String(item.ref_origin_key ?? ""),
    }))
    .filter((item) => item.from || item.to || item.origin);
}

export function integratedVariantGroups(meta?: EstudioMultiIntegrated | null): VariantGroup[] {
  const bySource = new Map<string, VariantRow[]>();
  for (const row of integratedVariantRows(meta)) {
    const source = row.from || "Variable";
    bySource.set(source, [...(bySource.get(source) ?? []), row]);
  }
  return Array.from(bySource.entries())
    .map(([from, rows]) => ({ from, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.from.localeCompare(b.from));
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
              ? `${base.n_filas} registros · ${base.n_columnas} cols`
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
          title={`Descargar base normalizada de ${base.nombre}`}
          aria-label={`Descargar base normalizada de ${base.nombre}`}
          className="pulso-base-row-button is-primary"
        >
          <Download size={11} /> Normalizada
        </button>

        <button
          type="button"
          onClick={onStartReplace}
          disabled={busy || isReplacing}
          title={`Reemplazar el formulario o las respuestas de ${base.nombre}`}
          aria-label={`Reemplazar archivos de ${base.nombre}`}
          className={`pulso-base-row-button${isReplacing ? " is-active" : ""}`}
        >
          <RefreshCw size={11} /> Reemplazar
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={`Quitar base ${base.nombre}`}
          aria-label={`Quitar base ${base.nombre}`}
          className="pulso-base-row-button is-danger"
        >
          <Trash2 size={11} /> Quitar
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

type IconCmp = typeof Database;

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
