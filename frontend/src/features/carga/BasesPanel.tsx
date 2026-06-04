import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Cloud, Database, Download, FileSpreadsheet, Filter, GitMerge, Layers, Loader2, Plus, RefreshCw,
  Search, SlidersHorizontal,
  Trash2, Upload, Pencil, X as XIcon,
} from "lucide-react";
import {
  apiCargaExportNormalized,
  apiConnectionProfileSetDefault,
  apiConnectionTokenLoad,
  apiEstudioAddBase,
  apiEstudioApplyIndependentTemplateLogic,
  apiEstudioDowngradeToSingle,
  apiEstudioGet,
  apiEstudioPromoteIndependentSiblings,
  apiEstudioRemoveBase,
  apiEstudioRenameBase,
  apiEstudioReplaceBaseFiles,
  apiEstudioSetNombre,
  apiEstudioUpdateBaseMetadata,
  apiSurveyMonkeyMultibaseAudit,
  apiSurveyMonkeyMultibaseImportIndependent,
  apiSurveyMonkeyMultibaseListSurveys,
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
  SurveyMonkeyMultibaseSurveyInput,
  SurveyMonkeyMultibaseAudit,
  SurveyMonkeyMultibaseDiff,
  SurveyMonkeyMultibaseListItem,
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
  const canonicalOptions = [
    ...(hasSessionXlsform ? [{ fileId: "", label: "XLSForm cargado en Carga" }] : []),
    ...bases.map((base) => ({ fileId: base.xlsform_file_id, label: `${base.nombre} · XLSForm` })),
  ];

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
      `Los archivos (XLSForm + data) quedan como carga simple y puedes ` +
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
    <section style={{ marginBottom: 28 }}>
      {/* Header del estudio — nombre editable + chip de bases */}
      <header
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderRadius: 10,
          background: "var(--pulso-primary-soft)",
          border: "1px solid var(--pulso-primary-border)",
          marginBottom: 16, flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: "white", color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Layers size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-primary)" }}>
            Modo multi
          </div>
          {editingEstudioNombre ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
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
                style={{
                  fontSize: 16, fontWeight: 700,
                  padding: "4px 8px", borderRadius: 6,
                  border: "1px solid var(--pulso-primary-border)",
                  background: "white", outline: "none",
                  minWidth: 220,
                }}
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
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 16, fontWeight: 700, color: "var(--pulso-text)",
                padding: "2px 6px", borderRadius: 4,
                border: "1px solid transparent", background: "transparent",
                cursor: "pointer",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              {(typeof estudio.nombre === "string" && estudio.nombre) || "Sin nombre"}
              <Pencil size={11} style={{ opacity: 0.6 }} />
            </button>
          )}
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>
            Selecciona la estrategia de carga.
          </div>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            padding: "4px 10px", borderRadius: 999,
            background: "white",
            border: "1px solid var(--pulso-primary-border)",
            color: "var(--pulso-primary)",
            flexShrink: 0,
            fontFamily: "ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
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
            title="Cerrar el modo multi-base — los archivos de esta base quedan en carga simple"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: "6px 10px", borderRadius: 7,
              border: "1px solid var(--pulso-primary-border)",
              background: "white",
              color: "var(--pulso-primary)",
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.background = "var(--pulso-primary)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "var(--pulso-primary)";
            }}
          >
            <ArrowLeft size={11} /> Volver a carga simple
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDiscardEstudio}
            disabled={!!busy}
            title="Cerrar el estudio y descartar todas las bases"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: "6px 10px", borderRadius: 7,
              border: "1px solid var(--pulso-border)",
              background: "white",
              color: "var(--pulso-text-soft)",
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
              e.currentTarget.style.background = "var(--pulso-danger-bg)";
              e.currentTarget.style.color = "var(--pulso-danger-fg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--pulso-border)";
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "var(--pulso-text-soft)";
            }}
          >
            <XIcon size={11} /> Cerrar estudio
          </button>
        )}
      </header>

      <div className="pulso-multi-strategy" role="tablist" aria-label="Estrategia del flujo multi">
        <button
          type="button"
          className={strategy === "separate" ? "is-active" : ""}
          onClick={() => setStrategy("separate")}
        >
          <Layers size={15} />
          <span>
            <strong>Mantener bases separadas</strong>
            <small>Instrumento y data por base.</small>
          </span>
        </button>
        <button
          type="button"
          className={strategy === "integrated" ? "is-active" : ""}
          onClick={() => setStrategy("integrated")}
        >
          <GitMerge size={15} />
          <span>
            <strong>Integrar instrumentos hermanos</strong>
            <small>Un XLSForm común y una data final.</small>
          </span>
        </button>
        <button
          type="button"
          className={strategy === "independent" ? "is-active" : ""}
          onClick={() => setStrategy("independent")}
        >
          <Cloud size={15} />
          <span>
            <strong>Bases hermanas independientes</strong>
            <small>Un XLSForm, data y entregables por encuesta.</small>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          style={{
            marginTop: 12,
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
            padding: "8px 14px", borderRadius: 8,
            border: "1px dashed var(--pulso-primary-border)",
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            cursor: maxReached ? "not-allowed" : "pointer",
            opacity: maxReached ? 0.55 : 1,
            transition: "background 120ms ease, border-color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (maxReached || busy) return;
            e.currentTarget.style.borderStyle = "solid";
            e.currentTarget.style.background = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderStyle = "dashed";
            e.currentTarget.style.background = "var(--pulso-primary-soft)";
          }}
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
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          {busy}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10 }}>
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

type SmImportScopeFields = {
  collectorIds: string;
  dateModifiedGte: string;
  dateModifiedLte: string;
  includeCompleted: boolean;
  includePartial: boolean;
  keepMissingStatus: boolean;
  collectionStrategy: "campo" | "whatsapp_link" | "web_link" | "email" | "otro";
};

type SmExtraSourceDraft = SmImportScopeFields & {
  key: string;
  surveyId: string;
  label: string;
  query?: string;
};

type SmImportScopeDraft = SmImportScopeFields & {
  alias: string;
  extraSources: SmExtraSourceDraft[];
};

export const INDEPENDENT_SIBLINGS_MAX_BASES = 10;

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
  };
}

function smDefaultScopeDraft(): SmImportScopeDraft {
  return {
    ...smDefaultScopeFields(),
    alias: "",
    extraSources: [],
  };
}

function smNewScopeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `source_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function smScopeStatuses(scope: SmImportScopeFields) {
  const statuses: string[] = [];
  if (scope.includeCompleted) statuses.push("completed");
  if (scope.includePartial) statuses.push("partial");
  return statuses.length ? statuses : ["completed"];
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

function smHasScopeFilters(scope: SmImportScopeFields) {
  return (
    smSplitScopeList(scope.collectorIds).length > 0 ||
    !!smScopeDate(scope.dateModifiedGte) ||
    !!smScopeDate(scope.dateModifiedLte) ||
    scope.keepMissingStatus ||
    scope.includePartial ||
    !scope.includeCompleted
  );
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
  if (scope.includeCompleted && scope.includePartial) parts.push("Completas y parciales");
  else if (scope.includePartial) parts.push("Solo parciales");
  else parts.push("Completas");
  if (smSplitScopeList(scope.collectorIds).length) parts.push("con collectors");
  if (smScopeDate(scope.dateModifiedGte) || smScopeDate(scope.dateModifiedLte)) parts.push("con fechas");
  if (nSources > 1) parts.push(`${nSources} campañas`);
  return parts.join(" · ");
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
  };
  return labels[kind] ?? kind.replace(/_/g, " ");
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
  const title = smSurveyTitle(item);
  const cleaned = title
    .replace(/\bAcreditaci[oó]n\b/gi, " ")
    .replace(/\bEncuesta\b/gi, " ")
    .replace(/\bEgresados?\b/gi, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || title;
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
  const statuses = smScopeStatuses(scope);
  if (smHasScopeFilters(scope)) input.response_statuses = statuses;
  const collectors = smSplitScopeList(scope.collectorIds);
  if (collectors.length) input.collector_ids = collectors;
  const gte = smScopeDate(scope.dateModifiedGte);
  const lte = smScopeDate(scope.dateModifiedLte);
  if (gte) input.date_modified_gte = gte;
  if (lte) input.date_modified_lte = lte;
  if (scope.keepMissingStatus) input.keep_missing_status = true;
  input.collection_strategy = scope.collectionStrategy;
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
  };
  const baseScope = draft ?? smDefaultScopeDraft();
  input.collection_strategy = baseScope.collectionStrategy;
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

function IndependentSiblingsSurveyMonkeyWizard({
  estudio,
  disabled,
  onImported,
}: {
  estudio: EstudioPayload;
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
  const [smConnection, setSmConnection] = useState<ConnectionTokenState | null>(null);
  const [showSurveyCatalog, setShowSurveyCatalog] = useState(estudio.n_bases === 0);
  const [editingAliasBase, setEditingAliasBase] = useState<string | null>(null);
  const [editingAliasDraft, setEditingAliasDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const modeConflict = estudio.n_bases > 0 && estudio.processing_mode !== "independent_siblings";
  const existingBases = Object.values(estudio.bases ?? {});
  const hasExistingIndependentBases = existingBases.length > 0 && estudio.processing_mode === "independent_siblings";
  const promotedBase = existingBases.find((base) => base.nombre === estudio.active_base) ?? existingBases[0] ?? null;
  const promotedTitle = smIndependentBaseTitle(promotedBase, estudio);
  const promotedName = promotedBase?.nombre === "default" ? smBaseSlug(promotedTitle) : promotedBase?.nombre;
  const { maxBases: independentMaxBases, capacityLeft } = independentSiblingsCapacity(estudio);
  const visibleSurveys = (surveys ?? []).filter((item) => smSurveyMatchesQuery(item, query));
  const selectedSurveys = (surveys ?? []).filter((item) => selectedIds.has(item.id));
  const selectedInputs = selectedSurveys.map((item) => smIndependentSurveyInput(item, scopeDrafts[item.id]));
  const selectedTotal = estudio.n_bases + selectedInputs.length;
  const selectedAliasRows = selectedSurveys.map((item) => {
    const alias = smAliasDraftValue(item, scopeDrafts[item.id]).trim();
    return { surveyId: item.id, alias, slug: smBaseSlug(alias) };
  });
  const duplicateAliasSlugs = new Set(
    selectedAliasRows
      .map((row) => row.slug)
      .filter((slug, index, slugs) => slugs.indexOf(slug) !== index),
  );
  const hasAliasIssues = selectedAliasRows.some((row) => !row.alias) || duplicateAliasSlugs.size > 0;
  const canImport = selectedInputs.length > 0 && selectedInputs.length <= capacityLeft && !hasAliasIssues && !modeConflict && !busy && !disabled;
  const overIndependentLimit = selectedInputs.length > capacityLeft;

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
    if (!wasSelected && selectedIds.size >= capacityLeft) {
      setError(`Este modo permite máximo ${independentMaxBases} bases hermanas independientes por estudio.`);
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
          key: smNewScopeKey(),
          surveyId: "",
          label: "",
          query: "",
        },
      ],
    });
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
    updateExtraSource(id, key, {
      surveyId: survey.id,
      label: smSurveyDefaultAlias(survey),
      query: "",
    });
  }

  function removeExtraSource(id: string, key: string) {
    const current = scopeDrafts[id] ?? smDefaultScopeDraft();
    updateScope(id, {
      extraSources: current.extraSources.filter((source) => source.key !== key),
    });
  }

  async function runAudit() {
    if (!selectedInputs.length) return;
    setError("");
    setBusy("Auditando familia SurveyMonkey...");
    try {
      const result = await apiSurveyMonkeyMultibaseAudit(selectedInputs);
      setAudit(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runImport() {
    setError("");
    setLogicSync(null);
    setBusy("Importando bases hermanas independientes...");
    try {
      const result = await apiSurveyMonkeyMultibaseImportIndependent({ surveys: selectedInputs });
      setAudit(result.audit);
      if (result.xlsform_logic_sync) setLogicSync(result.xlsform_logic_sync);
      await onImported(result.estudio);
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
    setBusy("Convirtiendo el estudio actual a bases hermanas independientes...");
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
    const templateBase = String(estudio.independent_siblings?.template_base || estudio.active_base || "").trim();
    setError("");
    setLogicSync(null);
    setBusy("Aplicando lógica XLSForm de la base plantilla...");
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
      setError((e as Error).message);
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

  useEffect(() => {
    if (showSurveyCatalog && !surveys) void loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSurveyCatalog]);

  useEffect(() => {
    if (!showSurveyCatalog) return;
    void refreshSurveyMonkeyConnection();
  }, [showSurveyCatalog]);

  return (
    <section className="pulso-integrated-panel">
      <header className="pulso-integrated-head">
        <span className="pulso-sm-multibase-icon" aria-hidden="true"><Cloud size={18} /></span>
        <div>
          <div className="pulso-sm-multibase-kicker">SurveyMonkey</div>
          <h3>Bases hermanas independientes</h3>
          <p>Importa cada encuesta con su propio XLSForm, data y estado de procesamiento.</p>
          <p>
            Usa el perfil SurveyMonkey activo en Ajustes. Si la clave principal llega al límite,
            cambia manualmente al perfil secundario y actualiza el catálogo.
            Si ya tenías una base trabajada, esa base puede actuar como plantilla para heredar reglas XLSForm compatibles.
          </p>
          <div className="pulso-sm-family-meter" aria-label="Resumen de familia independiente">
            <span><b>{selectedTotal}</b>/{independentMaxBases} bases</span>
            <span>Lógica compartida</span>
            <span>Procesamiento por base</span>
          </div>
        </div>
      </header>

      {modeConflict && (
        <div className="pulso-sm-multibase-warning">
          <AlertTriangle size={15} />
          <span>
            Este estudio ya tiene una base normalizada o en proceso. Puedes convertirla en plantilla,
            conservar lo trabajado y sumar hermanas independientes después.
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

      {hasExistingIndependentBases && (
        <div className="pulso-sm-family-config">
          <div className="pulso-sm-family-config-head">
            <strong>Familia cargada</strong>
            <span>{estudio.n_bases}/{independentMaxBases} bases · listas para procesar por base activa</span>
          </div>
          <div className="pulso-sm-family-table" role="table" aria-label="Bases hermanas independientes cargadas">
            <div className="pulso-sm-family-row is-head" role="row">
              <span>#</span>
              <span>Base visible</span>
              <span>Fuente original</span>
              <span>Data</span>
              <span>Estado</span>
              <span aria-hidden="true" />
            </div>
            {existingBases.map((base, index) => {
              const alias = String(base.source_alias || base.source_title || base.nombre || "").trim();
              const title = String(base.source_title || base.xlsform_file_name || base.nombre || "").trim();
              const sourceKind = String(base.source_kind || "base cargada").replace(/_/g, " ");
              const importedAt = smCatalogDateLabel(base.imported_at);
              const isActive = base.nombre === estudio.active_base;
              return (
                <div className={`pulso-sm-family-row${isActive ? " is-active" : ""}`} role="row" key={base.nombre}>
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
                  </div>
                  <div className="pulso-sm-family-data-cell">
                    <span className="pulso-sm-family-status">
                      <Database size={12} />
                      {base.n_filas ?? 0} filas
                    </span>
                    <small>{base.n_columnas ?? 0} columnas · XLSForm y data propios</small>
                  </div>
                  <div className="pulso-sm-family-data-cell">
                    <span className="pulso-sm-family-status is-neutral">
                      <Layers size={12} />
                      Independiente
                    </span>
                    <small>Validación, codificación, analítica y gráficos por base</small>
                  </div>
                  <span aria-hidden="true" />
                </div>
              );
            })}
          </div>
          <div className="pulso-sm-family-config-head">
            <span>Para trabajar usa el selector de base activa del lateral. La base plantilla comparte reglas con hermanas compatibles.</span>
            <div className="pulso-sm-family-actions">
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || estudio.n_bases < 2}
                onClick={runTemplateLogicSync}
              >
                <GitMerge size={13} />
                Aplicar lógica de plantilla
              </button>
              <button
                type="button"
                className="pulso-sm-secondary"
                disabled={disabled || !!busy || capacityLeft <= 0}
                onClick={() => {
                  setError("");
                  setShowSurveyCatalog(true);
                }}
              >
                <Plus size={13} />
                {capacityLeft <= 0 ? "Límite alcanzado" : "Agregar desde SurveyMonkey"}
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
              {visibleSurveys.length} de {surveyMeta?.totalRecent ?? surveys.length} encuestas modificadas en los últimos {surveyMeta?.months ?? 6} meses · {selectedInputs.length} por importar · {capacityLeft} cupos disponibles
              {surveyMeta && (
                <> · {surveyMeta.cacheStatus === "stale_fallback" ? "refresco falló; usando catálogo local" : surveyMeta.fromCache ? "catálogo local" : "catálogo actualizado"} {smCatalogDateLabel(surveyMeta.fetchedAt)}</>
              )}
            </div>
            <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
              {visibleSurveys.map((item) => {
                const selected = selectedIds.has(item.id);
                const title = smSurveyTitle(item);
                const scopeDraft = scopeDrafts[item.id];
                const aliasPreview = smSurveyAlias(item, scopeDraft);
                const cannotAdd = !selected && selectedIds.size >= capacityLeft;
                const responses = smSurveyResponseLabel(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}`}
                    onClick={() => toggleSurvey(item)}
                    disabled={disabled || !!busy || cannotAdd}
                    title={title}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{title}</strong>
                      <small>{aliasPreview}</small>
                      <span className="pulso-sm-survey-card-meta">
                        <b><Database size={11} /> {responses}</b>
                        <i>{smDateLabel(item.date_modified)}</i>
                        <i>ID {item.id}</i>
                      </span>
                    </span>
                    <em>{selected ? "En familia" : "Agregar"}</em>
                  </button>
                );
              })}
              {!visibleSurveys.length && <div className="pulso-sm-empty">No hay coincidencias con el filtro actual.</div>}
            </div>
          </>
        )}

        {selectedSurveys.length > 0 && (
          <div className="pulso-sm-family-config">
            <div className="pulso-sm-family-config-head">
              <strong>Familia por importar</strong>
              <span>{selectedTotal}/{independentMaxBases} bases configuradas</span>
            </div>
            <div className="pulso-sm-family-table" role="table" aria-label="Bases hermanas independientes seleccionadas">
              <div className="pulso-sm-family-row is-head" role="row">
                <span>#</span>
                <span>Base visible</span>
                <span>Encuesta original</span>
                <span>Data</span>
                <span>Filtros y campañas</span>
                <span aria-hidden="true" />
              </div>
              {selectedSurveys.map((item, index) => {
                const scopeDraft = scopeDrafts[item.id];
                const scope = scopeDraft ?? smDefaultScopeDraft();
                const scopedInput = selectedInputs.find((input) => input.survey_id === item.id);
                const nSources = scopedInput?.sources?.length ?? 1;
                const totalSourceResponses = smKnownSourceCount(item, scope, surveys);
                const aliasValue = smAliasDraftValue(item, scopeDraft);
                const aliasSlug = smBaseSlug(aliasValue);
                const aliasInvalid = !aliasValue.trim() || duplicateAliasSlugs.has(aliasSlug);
                return (
                  <div className={`pulso-sm-family-row${aliasInvalid ? " is-invalid" : ""}`} role="row" key={item.id}>
                    <span className="pulso-sm-survey-index">{index + 1}</span>
                    <div className="pulso-sm-family-base-cell">
                      <label className={`pulso-sm-alias-field is-main${aliasInvalid ? " is-invalid" : ""}`}>
                        <span>Alias visible</span>
                        <input
                          value={aliasValue}
                          disabled={disabled || !!busy}
                          aria-label={`Alias visible ${item.id}`}
                          onChange={(event) => updateAlias(item.id, event.target.value)}
                        />
                      </label>
                      <small>ID técnico <code>{aliasSlug}</code></small>
                      {aliasInvalid && (
                        <em>
                          <AlertTriangle size={12} />
                          {!aliasValue.trim()
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
                    </div>
                    <details className="pulso-sm-scope-popover">
                      <summary>
                        <SlidersHorizontal size={13} />
                        Alcance
                      </summary>
                      <div className="pulso-sm-scope-popover-panel" aria-label={`Alcance de importación de ${smSurveyTitle(item)}`}>
                        <div className="pulso-sm-scope-head">
                          <span><Filter size={13} /> Alcance de data</span>
                          <em>response_filter por base</em>
                        </div>
                        <div className="pulso-sm-scope-fields">
                          <label className="pulso-sm-scope-field">
                            <span>Estados</span>
                            <div className="pulso-sm-scope-checks">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={scope.includeCompleted}
                                  disabled={disabled || !!busy}
                                  onChange={(event) => updateScope(item.id, {
                                    includeCompleted: event.target.checked || !scope.includePartial,
                                  })}
                                />
                                Completas
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={scope.includePartial}
                                  disabled={disabled || !!busy}
                                  onChange={(event) => updateScope(item.id, {
                                    includePartial: event.target.checked,
                                    includeCompleted: scope.includeCompleted || !event.target.checked,
                                  })}
                                />
                                Parciales
                              </label>
                            </div>
                          </label>
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
                          <label className="pulso-sm-scope-field">
                            <span>Collector IDs</span>
                            <input
                              value={scope.collectorIds}
                              disabled={disabled || !!busy}
                              placeholder="campo, recordatorio"
                              onChange={(event) => updateScope(item.id, { collectorIds: event.target.value })}
                            />
                          </label>
                          <label className="pulso-sm-scope-field">
                            <span>Desde</span>
                            <input
                              value={scope.dateModifiedGte}
                              disabled={disabled || !!busy}
                              placeholder="2026-05-01T00:00:00+00:00"
                              onChange={(event) => updateScope(item.id, { dateModifiedGte: event.target.value })}
                            />
                          </label>
                          <label className="pulso-sm-scope-field">
                            <span>Hasta</span>
                            <input
                              value={scope.dateModifiedLte}
                              disabled={disabled || !!busy}
                              placeholder="2026-05-30T01:27:45+00:00"
                              onChange={(event) => updateScope(item.id, { dateModifiedLte: event.target.value })}
                            />
                          </label>
                        </div>

                        <div className="pulso-sm-extra-sources">
                          {scope.extraSources.map((source, sourceIndex) => {
                            const pickedSurvey = smSurveyById(surveys, source.surveyId);
                            const excludeIds = new Set([
                              ...Array.from(selectedIds),
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
                                  <label>
                                    <span>Etiqueta</span>
                                    <input
                                      value={source.label}
                                      disabled={disabled || !!busy}
                                      placeholder={pickedSurvey ? smSurveyDefaultAlias(pickedSurvey) : "Etiqueta opcional"}
                                      aria-label={`Etiqueta fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { label: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span>Collectors</span>
                                    <input
                                      value={source.collectorIds}
                                      disabled={disabled || !!busy}
                                      placeholder="campo, recordatorio"
                                      aria-label={`Collectors fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { collectorIds: event.target.value })}
                                    />
                                  </label>
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
                                  <label>
                                    <span>Desde</span>
                                    <input
                                      value={source.dateModifiedGte}
                                      disabled={disabled || !!busy}
                                      placeholder="2026-05-01T00:00"
                                      aria-label={`Fecha desde fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { dateModifiedGte: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span>Hasta</span>
                                    <input
                                      value={source.dateModifiedLte}
                                      disabled={disabled || !!busy}
                                      placeholder="2026-05-30T01:27"
                                      aria-label={`Fecha hasta fuente adicional ${sourceIndex + 1}`}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { dateModifiedLte: event.target.value })}
                                    />
                                  </label>
                                  <label className="pulso-sm-extra-check">
                                    <input
                                      type="checkbox"
                                      checked={source.includePartial}
                                      disabled={disabled || !!busy}
                                      onChange={(event) => updateExtraSource(item.id, source.key, { includePartial: event.target.checked })}
                                    />
                                    Parciales
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

      <div className="pulso-sm-multibase-actions">
        <button type="button" className="pulso-sm-secondary" disabled={!selectedInputs.length || !!busy || disabled} onClick={runAudit}>
          {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
          Auditar familia
        </button>
        <button type="button" className="pulso-sm-primary" disabled={!canImport} onClick={runImport}>
          <Layers size={14} />
          Importar como bases hermanas independientes
        </button>
      </div>

      {busy && <div className="pulso-sm-status"><Loader2 size={13} className="pulso-spin" /> {busy}</div>}
      {error && <ErrorBlock label="No se pudo completar la importación" detail={error} />}

      {logicSync && (
        <div className={`pulso-sm-logic-sync${logicSync.ok === false ? " is-warning" : ""}`}>
          <div className="pulso-sm-logic-sync-head">
            {logicSync.ok === false ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <strong>{logicSync.ok === false ? "Importación hecha; lógica pendiente" : "Lógica de plantilla aplicada"}</strong>
            <span>
              Plantilla <code>{logicSync.template_base}</code> · {logicSync.n_updated_bases ?? 0}/{logicSync.n_targets ?? 0} bases actualizadas
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
  if (kind === "uploaded_data") return kept == null ? "Data subida" : `Data subida · ${kept} filas`;
  const parts: string[] = [];
  if (sourceCount && sourceCount > 1) parts.push(`${sourceCount} fuentes`);
  if (kept != null) parts.push(`${kept} filtradas`);
  const statuses = Array.isArray(filter.statuses) ? filter.statuses.map(String).filter(Boolean) : [];
  if (statuses.length) parts.push(statuses.join("/"));
  const collectors = Array.isArray(filter.collector_ids) ? filter.collector_ids.map(String).filter(Boolean) : [];
  if (collectors.length) parts.push(`collector ${collectors.join(", ")}`);
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
                label="XLSForm guía"
                value={fileLabel(meta?.guide_xlsform_file_id, meta?.guide?.filename)}
              />
              <HistoryFile
                icon={<FileSpreadsheet size={14} />}
                label="XLSForm integrado"
                value={fileLabel(base.xlsform_file_id, base.xlsform_file_name)}
              />
              <HistoryFile
                icon={<Database size={14} />}
                label="Data integrada"
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
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", borderRadius: 10,
        border: "1px solid var(--pulso-success-border)",
        background: "var(--pulso-success-bg)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: "white",
          color: "var(--pulso-success-fg)",
          border: "1px solid var(--pulso-success-border)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Check size={18} />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {isRenaming ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
              style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                padding: "4px 8px", borderRadius: 5,
                border: "1px solid var(--pulso-primary-border)",
                background: "white", outline: "none",
                minWidth: 200,
              }}
            />
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <code
              style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                color: "var(--pulso-text)",
              }}
            >
              {base.nombre}
            </code>
            <button
              type="button"
              onClick={onStartRename}
              disabled={busy}
              title="Renombrar base"
              aria-label={`Renombrar base ${base.nombre}`}
              className="pulso-icon"
              style={{ minWidth: 22, minHeight: 22 }}
            >
              <Pencil size={10} />
            </button>
          </div>
        )}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 14,
            fontSize: 11, color: "var(--pulso-text-soft)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <FileSpreadsheet size={12} /> XLSForm cargado
          </span>
          {showSourceAlias && (
            <span title={sourceAlias} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Cloud size={12} /> {sourceAlias}
            </span>
          )}
          {showSourceTitle && (
            <span title={sourceTitle} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Cloud size={12} /> SurveyMonkey: {sourceTitle}
            </span>
          )}
          {filterLabel && (
            <span title={filterLabel} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Filter size={12} /> {filterLabel}
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Database size={12} />
            {base.n_filas != null && base.n_columnas != null
              ? `${base.n_filas} filas · ${base.n_columnas} cols`
              : "Datos cargados"}
            {base.data_ext && ` · .${base.data_ext}`}
          </span>
        </div>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          title={`Descargar base normalizada de ${base.nombre}`}
          aria-label={`Descargar base normalizada de ${base.nombre}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--pulso-primary-border)",
            background: "white",
            color: "var(--pulso-primary)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          <Download size={11} /> Normalizada
        </button>

        <button
          type="button"
          onClick={onStartReplace}
          disabled={busy || isReplacing}
          title={`Reemplazar el XLSForm o la data de ${base.nombre}`}
          aria-label={`Reemplazar archivos de ${base.nombre}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: isReplacing ? "var(--pulso-primary-soft)" : "white",
            color: isReplacing ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            cursor: busy ? "wait" : "pointer",
            transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (busy || isReplacing) return;
            e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
            e.currentTarget.style.color = "var(--pulso-primary)";
          }}
          onMouseLeave={(e) => {
            if (isReplacing) return;
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
        >
          <RefreshCw size={11} /> Reemplazar
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={`Quitar base ${base.nombre}`}
          aria-label={`Quitar base ${base.nombre}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--pulso-border)",
            background: "white",
            color: "var(--pulso-text-soft)",
            cursor: busy ? "wait" : "pointer",
            transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (busy) return;
            e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
            e.currentTarget.style.background = "var(--pulso-danger-bg)";
            e.currentTarget.style.color = "var(--pulso-danger-fg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
          }}
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
    <div
      style={{
        marginTop: 14,
        padding: "18px 20px", borderRadius: 10,
        border: "1px solid var(--pulso-primary)",
        background: "white",
        boxShadow: "var(--pulso-shadow-med)",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Plus size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-text)" }}>
            Agregar otra base al estudio
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginTop: 2 }}>
            Sube el XLSForm y la base de datos. El nombre es opcional — si lo
            dejas vacío se llamará <code style={{ fontFamily: "ui-monospace, monospace" }}>{autoName}</code>{" "}
            y podrás renombrarla después.
          </div>
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
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Nombre de la base <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>(opcional)</span>
        </span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={autoName}
          style={{
            fontSize: 13, fontFamily: "ui-monospace, monospace",
            padding: "8px 12px", borderRadius: 7,
            border: `1px solid ${
              nombreDuplicado ? "var(--pulso-danger-border)" :
              nombreTocado && !nombreValido ? "var(--pulso-warn-border)" :
              "var(--pulso-border)"
            }`,
            background: "white", outline: "none",
          }}
        />
        {nombreDuplicado && (
          <span style={{ fontSize: 10, color: "var(--pulso-danger-fg)" }}>
            Ya existe una base con ese nombre.
          </span>
        )}
        {nombreTocado && !nombreValido && !nombreDuplicado && (
          <span style={{ fontSize: 10, color: "var(--pulso-warn-fg)" }}>
            Usa letras, números y guiones. Sin espacios ni el símbolo $.
          </span>
        )}
      </label>

      {/* Uploaders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <FilePicker
          icon={FileSpreadsheet}
          title="XLSForm"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx)"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Base de datos"
          accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
          acceptLabel=".xlsx · .csv · .sav"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al agregar base" detail={error} />}

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        {/* Hint explícito sobre qué falta — el botón deshabilitado
            solo no es affordance suficiente. */}
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, minWidth: 200 }}>
          {!puedeAgregar && !uploading && (
            <>
              {!xlsformFile && !dataFile
                ? "Falta subir el XLSForm y la base de datos."
                : !xlsformFile
                ? "Falta subir el XLSForm."
                : !dataFile
                ? "Falta subir la base de datos."
                : nombreDuplicado
                ? "Cambia el nombre — ya existe una base así."
                : !nombreValido
                ? "El nombre tiene caracteres no permitidos."
                : ""}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeAgregar}
            style={{
              fontSize: 12, padding: "7px 14px",
              opacity: puedeAgregar ? 1 : 0.55,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
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
    <div
      style={{
        marginTop: 8,
        padding: "14px 16px", borderRadius: 10,
        border: "1px solid var(--pulso-primary)",
        background: "white",
        boxShadow: "var(--pulso-shadow-med)",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <RefreshCw size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
            Reemplazar archivos de <code style={{ fontFamily: "ui-monospace, monospace" }}>{baseNombre}</code>
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5, marginTop: 2 }}>
            Sube el XLSForm, la base de datos, o ambos. Lo que no toques se
            queda igual. La validación y el plan de analítica se invalidan.
          </div>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <FilePicker
          icon={FileSpreadsheet}
          title="Nuevo XLSForm"
          accept=".xlsx,.xls"
          acceptLabel="Excel (.xlsx) · opcional"
          file={xlsformFile}
          onPick={setXlsformFile}
        />
        <FilePicker
          icon={Database}
          title="Nueva base de datos"
          accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
          acceptLabel=".xlsx · .csv · .sav · opcional"
          file={dataFile}
          onPick={setDataFile}
        />
      </div>

      {error && <ErrorBlock label="Error al reemplazar archivos" detail={error} />}

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, minWidth: 200 }}>
          {!puedeReemplazar && !uploading && "Sube al menos uno de los dos archivos para reemplazar."}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-primary"
            onClick={handleSubmit}
            disabled={!puedeReemplazar}
            style={{
              fontSize: 12, padding: "7px 14px",
              opacity: puedeReemplazar ? 1 : 0.55,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
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
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, padding: "14px 12px", borderRadius: 8,
        border: `2px dashed ${
          file ? "var(--pulso-success-border)" :
          dragOver ? "var(--pulso-primary)" :
          "var(--pulso-border)"
        }`,
        background: file
          ? "var(--pulso-success-bg)"
          : dragOver ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
        cursor: "pointer",
        textAlign: "center",
        transition: "border-color 120ms ease, background 120ms ease",
        minWidth: 0,
      }}
    >
      {file ? (
        <Check size={18} color="var(--pulso-success-fg)" />
      ) : (
        <Upload size={18} color={dragOver ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
      )}
      <span
        style={{
          fontSize: 12, fontWeight: 600,
          color: file ? "var(--pulso-success-fg)" : "var(--pulso-text)",
          display: "inline-flex", alignItems: "center", gap: 5,
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Icon size={13} />
        {file ? file.name : title}
      </span>
      <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
        {acceptLabel}
      </span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
    </label>
  );
}
