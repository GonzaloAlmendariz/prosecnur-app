import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowRightLeft, CheckCircle2, Database, FileSpreadsheet,
  Download, Info, ShieldCheck, Trash2, Upload,
} from "lucide-react";
import {
  apiCargaData,
  apiCargaExportNormalized,
  apiCargaConfirmChoiceMapping,
  apiCargaInstrumento,
  apiEstudioDowngradeToSingle,
  apiEstudioFromSession,
  apiEstudioGet,
  apiEstudioInit,
  apiInstrumentoEstructura,
  apiQuitarData,
  apiQuitarInstrumento,
  apiUpload,
  ChoiceCodeMap,
  ChoiceCodeMapReview,
  EstudioPayload,
  NormalizedExportFormat,
  Pregunta,
  Seccion,
  downloadUrl,
  uploadKindForDataFile,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { Panel } from "../../components/Panel";
import { PageFrame } from "../../components/PageFrame";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";
import { BasesPanel } from "./BasesPanel";

// Fase 1 — Carga de insumos.
//
// El analista sube su propio XLSForm + base de datos. Cada archivo se parsea
// y muestra un resumen con contadores.
//
// Tras la carga, esta página muestra la estructura del instrumento
// (secciones + preguntas con reglas) para que el analista verifique
// antes de pasar a Validación.

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

type IconCmp = typeof Database;

function dataPreviewNormalizationDetails(preview: DataPreview | null): string[] {
  const normalizacion = preview?.normalizacion;
  if (!normalizacion) return [];
  const rows: string[] = [];
  Object.entries(normalizacion.alias_columns ?? {}).forEach(([target, source]) => {
    rows.push(`alias ${source} -> ${target}`);
  });
  Object.entries(normalizacion.single_child_collapse_columns ?? {}).forEach(([target, source]) => {
    rows.push(`colapso ${source} -> ${target}`);
  });
  Object.entries(normalizacion.select_multiple_columns ?? {}).forEach(([target, sources]) => {
    const sourceList = Array.isArray(sources) ? sources : [String(sources)];
    rows.push(`select_multiple ${target}: ${sourceList.join(", ")}`);
  });
  const choiceMaps = normalizacion.choice_code_maps;
  if (choiceMaps?.applied && choiceMaps.maps.length > 0) {
    choiceMaps.maps.forEach((map) => {
      rows.push(`mapeo SAV -> XLSForm ${map.variable}: ${map.mappings.length} opción(es) por etiqueta`);
    });
  }
  return rows;
}

function choiceMappingReviewFromPreview(preview: DataPreview | null): ChoiceCodeMapReview | null {
  const review = preview?.normalizacion?.choice_code_maps;
  if (!review?.applied) return null;
  const maps = Array.isArray(review.maps) ? review.maps : [];
  if (!maps.length) return null;
  return { ...review, maps };
}

function markChoiceMappingConfirmed(preview: DataPreview | null): DataPreview | null {
  if (!preview?.normalizacion?.choice_code_maps) return preview;
  return {
    ...preview,
    normalizacion: {
      ...preview.normalizacion,
      choice_code_maps: {
        ...preview.normalizacion.choice_code_maps,
        requires_confirmation: false,
        maps: preview.normalizacion.choice_code_maps.maps.map((map) => ({
          ...map,
          requires_confirmation: false,
        })),
      },
    },
  };
}

function normalizedChoiceCode(value: string): string {
  return String(value ?? "").replace(/^0+([0-9]+)$/, "$1");
}

function choiceMapChangedItems(map: ChoiceCodeMap) {
  return map.mappings.filter((item) => normalizedChoiceCode(item.source_code) !== normalizedChoiceCode(item.xls_code));
}

export default function CargaPage() {
  const { sessionId, state, refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [choiceMappingReview, setChoiceMappingReview] = useState<ChoiceCodeMapReview | null>(null);
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const normalizationDetails = dataPreviewNormalizationDetails(dataPreview);

  async function onQuitar(kind: "xlsform" | "data") {
    const label = kind === "xlsform" ? "el XLSForm" : "la base de datos";
    // Borrar el instrumento vuelve inválidos a la data + estudio; borrar
    // la data también invalida el estudio multi-base. Confirmamos para
    // evitar pérdidas accidentales cuando el usuario ya avanzó.
    if (!window.confirm(
      `¿Quitar ${label}?\n\nSe vaciará lo que depende de esto:\n` +
      (kind === "xlsform"
        ? "el XLSForm, su parseo, la base de datos y el estudio.\n\n" +
          "Podrás volver a cargar otro formulario después."
        : "la base de datos y el estudio. El XLSForm se queda cargado.\n\n" +
          "Podrás subir otra base después."
      )
    )) return;

    setError("");
    setBusy(`Quitando ${label}…`);
    try {
      if (kind === "xlsform") {
        await apiQuitarInstrumento();
        setInstrumento(null);
        setEstructura(null);
        // Quitar XLSForm también invalida la data a nivel UI porque
        // el backend la tiró de la sesión.
        setDataPreview(null);
        setChoiceMappingReview(null);
      } else {
        await apiQuitarData();
        setDataPreview(null);
        setChoiceMappingReview(null);
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onPick(kind: "xlsform" | "data", file?: File) {
    if (!file) return;
    if (kind === "data" && !state?.xlsform) {
      setError("Primero carga el XLSForm. La data se normaliza y valida usando ese formulario.");
      return;
    }
    setError("");
    setBusy(`Subiendo ${file.name}…`);
    try {
      const uploadKind = kind === "data" ? uploadKindForDataFile(file) : kind;
      const up = await apiUpload(file, uploadKind);
      setBusy(`Procesando ${file.name}…`);
      if (kind === "xlsform") {
        const r = await apiCargaInstrumento(up.file_id);
        setInstrumento(r.resumen);
        setEstructura(null);
      } else {
        const r = await apiCargaData(up.file_id);
        setDataPreview(r.preview);
        const review = choiceMappingReviewFromPreview(r.preview);
        setChoiceMappingReview(review?.requires_confirmation ? review : null);
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (state?.instrumento_parsed && !estructura) {
      apiInstrumentoEstructura().then(setEstructura).catch((e) => setError((e as Error).message));
    }
  }, [state?.instrumento_parsed, estructura]);

  // Estado de prereqs — muestra al lado del título como meta chip.
  const hasXlsform = !!state?.xlsform;
  const hasData = !!state?.data;
  const pendingChoiceMapping = !!dataPreview?.normalizacion?.choice_code_maps?.requires_confirmation;
  const allReady = hasXlsform && hasData && !pendingChoiceMapping;

  // ¿Está el usuario en modo multi-base? Dos formas de activarse:
  // 1) Demo/preset cargó ≥1 base real (Acreditación) → has_estudio
  //    true + n_bases ≥ 1 con nombres reales.
  // 2) Usuario activó el toggle "más de una base" manualmente → has_
  //    estudio true + n_bases puede ser 0 (estudio recién inicializado
  //    esperando que suba su primera base).
  // El caso "single-base legacy virtual" (n_bases=1 + nombre=default)
  // se sigue tratando como single-base — aún no hubo intención de
  // multi-base, es solo un mirror del legacy.
  const isMultiBase = !!state
    && state.has_estudio
    && !(state.n_bases === 1 && state.bases_nombres[0] === "default");

  // Payload del estudio — cargamos on-demand cuando entramos a modo
  // multi-base para mostrar el BasesPanel con detalle de cada base.
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  // Flag que le pide al BasesPanel abrir directamente su form "Agregar
  // base" al montar. Se activa tras convertir single → multi con el
  // botón "+ Agregar otra base" para que el usuario no tenga que
  // buscar el botón dentro del panel.
  const [autoOpenAddBase, setAutoOpenAddBase] = useState(false);
  const lastSessionIdRef = useRef(sessionId);

  useEffect(() => {
    if (!sessionId || lastSessionIdRef.current === sessionId) return;
    lastSessionIdRef.current = sessionId;
    setInstrumento(null);
    setDataPreview(null);
    setChoiceMappingReview(null);
    setEstructura(null);
    setEstudio(null);
    setAutoOpenAddBase(false);
    setError("");
    setBusy("");
  }, [sessionId]);

  useEffect(() => {
    if (!error) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  useEffect(() => {
    if (!isMultiBase) {
      setEstudio(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await apiEstudioGet();
        if (!cancelled) setEstudio(p);
      } catch {
        // Si falla (ej. sesión recién creada sin estudio), el BasesPanel
        // no se renderiza — volvemos a los UploadCards.
        if (!cancelled) setEstudio(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isMultiBase, state?.n_bases, state?.bases_nombres?.join(",")]);

  // Tras cambios al estudio (add/remove/rename base), refrescar
  // session state + estudio payload + re-hidratar estructura del primer
  // instrumento si aplica.
  async function onEstudioChanged(payload: EstudioPayload) {
    setEstudio(payload);
    await refresh();
    if (payload.n_bases > 0) {
      try {
        const r = await apiInstrumentoEstructura();
        setEstructura(r);
      } catch { /* primera base puede no tener estructura aún */ }
    } else {
      setEstructura(null);
    }
  }

  async function onConfirmChoiceMapping() {
    setError("");
    setBusy("Confirmando mapeo SAV -> XLSForm…");
    try {
      await apiCargaConfirmChoiceMapping();
      setDataPreview((prev) => markChoiceMappingConfirmed(prev));
      setChoiceMappingReview(null);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onExportNormalized(format: NormalizedExportFormat) {
    setError("");
    setBusy(`Preparando base normalizada .${format}…`);
    try {
      const out = await apiCargaExportNormalized(format);
      window.location.href = downloadUrl(out.file_id);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <PageFrame
      title="Fase 1 - Carga de insumos"
      lead="Sube un XLSForm y la base de datos para preparar el estudio."
      className="pulso-carga-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      toolbar={
        <ContextBar
          ariaLabel="Estado de carga y modo del estudio"
          className="pulso-carga-commandbar"
          elevated
        >
          <CargaCommandSummary
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
          />
          {(allReady || hasXlsform || hasData) && (
            <SaveStatusIndicator
              state={allReady ? "saved" : "dirty"}
              variant="badge"
              savedLabel="Insumos listos"
            />
          )}
          <ContextBarDivider />
          <MultiBaseToggle
            on={isMultiBase}
            canTurnOff={isMultiBase && (state?.n_bases ?? 0) <= 1}
            bases={state?.n_bases ?? 0}
            disabled={!!busy}
            onTurnOn={async () => {
              setError("");
              setBusy("Activando modo de varias bases…");
              try {
                if (hasXlsform && hasData) {
                  // Hay archivos single-base — los promovemos a base_1.
                  await apiEstudioFromSession();
                  const p = await apiEstudioGet();
                  setEstudio(p);
                  setAutoOpenAddBase(true);
                } else {
                  // Todavía no hay archivos — creamos un estudio vacío.
                  // El BasesPanel renderiza con su form "Agregar base"
                  // listo para que el usuario suba su primera base.
                  const p = await apiEstudioInit();
                  setEstudio(p);
                  setAutoOpenAddBase(true);
                }
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
            onTurnOff={async () => {
              setError("");
              setBusy("Volviendo a una sola base…");
              try {
                await apiEstudioDowngradeToSingle();
                setEstudio(null);
                setAutoOpenAddBase(false);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          />
        </ContextBar>
      }
    >
      {(busy || error) && (
        <div ref={feedbackRef} className="pulso-feedback-stack pulso-feedback-stack--upload">
          {busy && <LoadingBlock variant="inline" label={busy} />}
          {error && <ErrorBlock label="No se pudo completar la carga" detail={error} />}
        </div>
      )}

      {choiceMappingReview && (
        <ChoiceMappingReviewDialog
          review={choiceMappingReview}
          busy={!!busy}
          onClose={() => setChoiceMappingReview(null)}
          onConfirm={onConfirmChoiceMapping}
        />
      )}

      {/* Modo multi-base: BasesPanel reemplaza los UploadCards.
          Cada base es un par (XLSForm + data) con nombre único. El
          usuario puede agregar, quitar, renombrar y volver a la carga
          simple si queda 1 sola base. */}
      {isMultiBase && estudio && (
        <section className="pulso-upload-section pulso-carga-workbench pulso-split-view">
          <CargaStageRail
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
            isMultiBase={isMultiBase}
            bases={state?.n_bases ?? 0}
            instrumento={instrumento}
            dataPreview={dataPreview}
            estructura={estructura}
          />
          <div className="pulso-carga-content pulso-content-area pulso-carga-content--multi">
            <BasesPanel
              estudio={estudio}
              onChanged={onEstudioChanged}
              autoOpenAdd={autoOpenAddBase}
              onAutoOpenConsumed={() => setAutoOpenAddBase(false)}
              onDowngraded={async () => {
                setAutoOpenAddBase(false);
                setEstudio(null);
                await refresh();
              }}
            />
            <CargaFollowupContent
              showInspection={!!state?.instrumento_parsed && !!estructura}
              estructura={estructura}
              allReady={allReady}
              busy={busy}
              error={error}
            />
          </div>
        </section>
      )}

      {/* Sección 1 — LOS DOS INSUMOS (single-base). Solo se muestra si
          NO estamos en modo multi-base. Si estamos en multi-base,
          BasesPanel ya cubre la carga de insumos. */}
      {!isMultiBase && (
      <>
      <section className="pulso-upload-section pulso-carga-workbench pulso-split-view">
        <CargaStageRail
          hasXlsform={hasXlsform}
          hasData={hasData}
          pendingChoiceMapping={pendingChoiceMapping}
          allReady={allReady}
          isMultiBase={isMultiBase}
          bases={state?.n_bases ?? 0}
          instrumento={instrumento}
          dataPreview={dataPreview}
          estructura={estructura}
        />

        <div className="pulso-carga-content pulso-content-area">
          <div className="pulso-upload-section-head pulso-carga-content-head">
            <SectionEyebrow
              label="Tus dos insumos"
              hint="Carga primero el XLSForm y después la data. Pulso usa el formulario para normalizar nombres, reconstruir select_multiple y validar compatibilidad antes de procesar reportes."
            />
          </div>

          <div className="pulso-upload-grid">
            <UploadCard
              kind="xlsform"
              icon={FileSpreadsheet}
              title="1. XLSForm (instrumento)"
              hint="El formulario que usaste en ODK / KoBo / SurveyCTO. Describe las preguntas, opciones, secciones y reglas del estudio."
              whatIs={
                <>
                  Es un archivo <strong>Excel (.xlsx)</strong> con una estructura especial:
                  una hoja <code>survey</code> con las preguntas y una <code>choices</code>{" "}
                  con las opciones. Sin este archivo, la app no sabe qué variables significan qué.
                </>
              }
              accept=".xlsx,.xls"
              acceptLabel="Solo Excel (.xlsx)"
              done={hasXlsform}
              busy={!!busy}
              disabled={!!busy}
              resumen={instrumento && (
                <>
                  <ResumenStat label="Preguntas" value={instrumento.n_preguntas} />
                  {(instrumento.n_calculos ?? 0) > 0 && (
                    <ResumenStat label="Cálculos" value={instrumento.n_calculos ?? 0} />
                  )}
                  <ResumenStat label="Secciones" value={instrumento.n_secciones} />
                  <ResumenStat label="Listas de opciones" value={instrumento.n_listas_opciones} />
                </>
              )}
              onPick={(file) => onPick("xlsform", file)}
              onRemove={() => onQuitar("xlsform")}
            />

            <UploadCard
              kind="data"
              icon={Database}
              title="2. Base de datos"
              hint={hasXlsform
                ? "Las respuestas de los encuestados. Se validarán contra el XLSForm ya cargado."
                : "Primero carga el XLSForm para activar la data y evitar normalización silenciosa."}
              whatIs={
                <>
                  Es el resultado de tu trabajo de campo. Acepta <strong>Excel (.xlsx)</strong>,{" "}
                  <strong>CSV</strong> o <strong>SPSS (.sav)</strong>. Los nombres de columna deben
                  coincidir con los <code>name</code> del XLSForm.
                </>
              }
              accept=".xlsx,.xls,.csv,.sav,application/x-spss-sav,application/octet-stream"
              acceptLabel=".xlsx · .csv · .sav"
              done={hasData}
              busy={!!busy}
              disabled={!!busy || !hasXlsform}
              disabledHint="Disponible después de cargar el XLSForm"
              resumen={dataPreview && (
                <>
                  <ResumenStat label="Filas" value={dataPreview.n_filas} />
                  <ResumenStat label="Columnas" value={dataPreview.n_columnas} />
                  <div className="pulso-upload-normalizacion">
                    {dataPreview.normalizacion?.applied
                      ? (
                        <>
                          Normalización aplicada · {dataPreview.normalizacion.aliases} alias
                          {dataPreview.normalizacion.select_multiple > 0
                            ? ` · ${dataPreview.normalizacion.select_multiple} select_multiple reconstruido(s)`
                            : ""}
                          {(dataPreview.normalizacion.single_child_collapses ?? 0) > 0
                            ? ` · ${dataPreview.normalizacion.single_child_collapses} escala(s) colapsada(s)`
                            : ""}
                          {typeof dataPreview.normalizacion.extra_columns === "number" && dataPreview.normalizacion.extra_columns > 0
                            ? ` · ${dataPreview.normalizacion.extra_columns} columna(s) técnica(s) al final`
                            : ""}
                          {dataPreview.normalizacion.choice_code_maps?.applied
                            ? ` · ${dataPreview.normalizacion.choice_code_maps.n_questions} mapeo(s) SAV-XLSForm`
                            : ""}
                        </>
                      )
                      : "Normalización pendiente: se activa después de cargar el XLSForm"}
                  </div>
                  {choiceMappingReviewFromPreview(dataPreview) && (
                    <div className={`pulso-choice-map-inline${dataPreview.normalizacion?.choice_code_maps?.requires_confirmation ? " needs-review" : ""}`}>
                      <span aria-hidden="true" className="pulso-choice-map-inline-icon">
                        <ArrowRightLeft size={13} />
                      </span>
                      <span>
                        {dataPreview.normalizacion?.choice_code_maps?.requires_confirmation
                          ? "Pulso detectó las mismas etiquetas con códigos distintos entre SM/SAV y el XLSForm. Confirma cómo recodificar la data antes de validar."
                          : "Mapeo SAV -> XLSForm confirmado para esta data."}
                      </span>
                      <button
                        type="button"
                        className="pulso-choice-map-inline-button"
                        onClick={() => setChoiceMappingReview(choiceMappingReviewFromPreview(dataPreview))}
                      >
                        {dataPreview.normalizacion?.choice_code_maps?.requires_confirmation ? "Revisar" : "Ver mapeo"}
                      </button>
                    </div>
                  )}
                  {normalizationDetails.length > 0 && (
                    <details className="pulso-normalization-details">
                      <summary>Ver normalización</summary>
                      <ul>
                        {normalizationDetails.map((row, i) => (
                          <li key={i}>{row}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {dataPreview.normalizacion?.applied && !pendingChoiceMapping && (
                    <NormalizedExportActions
                      busy={!!busy}
                      onExport={(format) => void onExportNormalized(format)}
                    />
                  )}
                  {dataPreview.compatibilidad?.applied && (
                    <div className={`pulso-upload-compat ${dataPreview.compatibilidad.ok ? "is-ok" : "is-bad"}`}>
                      {dataPreview.compatibilidad.ok ? "Compatible con XLSForm" : "Incompatible con XLSForm"}
                      {typeof dataPreview.compatibilidad.expected_columns === "number"
                        ? ` · ${dataPreview.compatibilidad.matched_columns}/${dataPreview.compatibilidad.expected_columns} variables`
                        : ""}
                      {(dataPreview.compatibilidad.n_missing ?? dataPreview.compatibilidad.missing_columns.length) > 0
                        ? ` · faltan ${dataPreview.compatibilidad.missing_columns.slice(0, 6).join(", ")}`
                        : ""}
                      {(dataPreview.compatibilidad.n_extra ?? dataPreview.compatibilidad.extra_columns.length) > 0
                        ? ` · ${dataPreview.compatibilidad.n_extra ?? dataPreview.compatibilidad.extra_columns.length} extra permitida(s)`
                        : ""}
                    </div>
                  )}
                  {dataPreview.columnas.length > 0 && (
                    <details className="pulso-column-details">
                      <summary>
                        Ver columnas ({dataPreview.columnas.length})
                      </summary>
                      <ul>
                        {dataPreview.columnas.map((c, i) => (
                          <li key={i}>
                            <code>{c.nombre}</code>{" "}
                            <em>({c.tipo})</em>
                            {c.origen === "extra" && (
                              <span className="pulso-column-extra">extra</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
              onPick={(file) => onPick("data", file)}
              onRemove={() => onQuitar("data")}
            />
          </div>
          <CargaFollowupContent
            showInspection={!!state?.instrumento_parsed && !!estructura}
            estructura={estructura}
            allReady={allReady}
            busy={busy}
            error={error}
          />
        </div>

        {/* El botón "+ Agregar otra base" se eliminó — ahora la
            conversión single→multi se hace con el MultiBaseToggle de
            arriba del todo. */}
      </section>
      </>
      )}
    </PageFrame>
  );
}

// `EstudioActivoBanner` (banner genérico multi-base que vivía acá) se
// reemplazó por `BasesPanel` completo — ahora no solo muestra las bases
// sino que permite renombrar, quitar y agregar.

function NormalizedExportActions({
  busy,
  onExport,
}: {
  busy: boolean;
  onExport: (format: NormalizedExportFormat) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "9px 10px",
        borderRadius: 8,
        border: "1px solid var(--pulso-primary-border)",
        background: "var(--pulso-primary-soft)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-primary)" }}>
        Base normalizada
      </span>
      {(["xlsx", "csv", "sav"] as NormalizedExportFormat[]).map((format) => (
        <button
          key={format}
          type="button"
          disabled={busy}
          onClick={() => onExport(format)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 8px",
            borderRadius: 7,
            border: "1px solid var(--pulso-primary-border)",
            background: "white",
            color: "var(--pulso-primary)",
            fontSize: 11,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          <Download size={12} />
          .{format}
        </button>
      ))}
    </div>
  );
}

function CargaFollowupContent({
  showInspection,
  estructura,
  allReady,
  busy,
  error,
}: {
  showInspection: boolean;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
  allReady: boolean;
  busy: string;
  error: string;
}) {
  return (
    <>
      {showInspection && estructura && (
        <section className="pulso-carga-inspection" aria-label="Inspección del instrumento">
          <Panel
            eyebrow="Instrumento"
            title="Mapa de secciones"
            hint="Cada fila es una sección del XLSForm con su lógica de visibilidad (relevant)."
            className="pulso-carga-inspection-panel"
          >
            <SeccionesPanel secciones={estructura.secciones} />
          </Panel>
          <Panel
            eyebrow="Instrumento"
            title="Mapa del instrumento"
            hint="Distingue preguntas respondidas, variables calculadas y reglas declaradas en el XLSForm."
            className="pulso-carga-inspection-panel"
          >
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </section>
      )}

      {allReady && !busy && !error && <ContinuarCTA />}
    </>
  );
}

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================
function CargaCommandSummary({
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
}) {
  const reviewLabel = pendingChoiceMapping ? "Mapeo pendiente" : allReady ? "Listo para validar" : "En preparación";
  return (
    <div className="pulso-carga-command-summary" aria-label="Resumen de carga">
      <CargaCommandPill label="XLSForm" done={hasXlsform} />
      <CargaCommandPill label="Data" done={hasData} />
      <span className={`pulso-carga-command-review${allReady ? " is-ready" : pendingChoiceMapping ? " needs-review" : ""}`}>
        <ShieldCheck size={13} />
        {reviewLabel}
      </span>
    </div>
  );
}

function CargaCommandPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`pulso-carga-command-pill${done ? " is-done" : ""}`}>
      <span aria-hidden="true" className="pulso-carga-command-dot" />
      {label}
    </span>
  );
}

function CargaStageRail({
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
  isMultiBase,
  bases,
  instrumento,
  dataPreview,
  estructura,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  isMultiBase: boolean;
  bases: number;
  instrumento: InstrumentoResumen | null;
  dataPreview: DataPreview | null;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
}) {
  const xlsformMeta = instrumento
    ? `${instrumento.n_preguntas} preguntas · ${instrumento.n_secciones} secciones`
    : hasXlsform
    ? "Instrumento cargado"
    : "Pendiente";
  const dataMeta = dataPreview
    ? `${dataPreview.n_filas} filas · ${dataPreview.n_columnas} columnas`
    : hasData
    ? "Data cargada"
    : hasXlsform
    ? "Lista para cargar"
    : "Espera el XLSForm";
  const reviewTone = pendingChoiceMapping ? "warning" : allReady ? "ready" : "pending";
  const reviewMeta = pendingChoiceMapping
    ? "Requiere confirmar mapeo"
    : allReady
    ? "Compatible para Validación"
    : estructura
    ? `${estructura.secciones.length} secciones detectadas`
    : "Se activa con ambos insumos";

  return (
    <aside className="pulso-carga-stage-rail pulso-sidebar" aria-label="Estado de la carga">
      <div className="pulso-carga-stage-head">
        <span className="pulso-carga-stage-kicker">Ruta de carga</span>
        <strong>{allReady ? "Insumos listos" : "Preparando estudio"}</strong>
      </div>
      <div className="pulso-carga-stage-list">
        <CargaStageItem
          icon={FileSpreadsheet}
          title="XLSForm"
          meta={xlsformMeta}
          tone={hasXlsform ? "ready" : "pending"}
          index="1"
        />
        <CargaStageItem
          icon={Database}
          title="Base de datos"
          meta={dataMeta}
          tone={hasData ? "ready" : "pending"}
          index="2"
        />
        <CargaStageItem
          icon={ShieldCheck}
          title="Revisión"
          meta={reviewMeta}
          tone={reviewTone}
          index="3"
        />
      </div>
      <div className={`pulso-carga-stage-mode${isMultiBase ? " is-on" : ""}`}>
        <span>{isMultiBase ? "Varias bases" : "Una base"}</span>
        <strong>{isMultiBase ? `${bases} base${bases === 1 ? "" : "s"}` : "Flujo simple"}</strong>
      </div>
    </aside>
  );
}

function CargaStageItem({
  icon: Icon,
  title,
  meta,
  tone,
  index,
}: {
  icon: IconCmp;
  title: string;
  meta: string;
  tone: "ready" | "pending" | "warning";
  index: string;
}) {
  return (
    <div className={`pulso-carga-stage-item is-${tone}`}>
      <span className="pulso-carga-stage-index">{index}</span>
      <span aria-hidden="true" className="pulso-carga-stage-icon">
        <Icon size={15} />
      </span>
      <span className="pulso-carga-stage-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </span>
    </div>
  );
}

function UploadCard({
  kind, icon: Icon, title, hint, whatIs, accept, acceptLabel, done, busy, disabled, disabledHint, resumen, onPick, onRemove,
}: {
  kind: "xlsform" | "data";
  icon: IconCmp;
  title: string;
  hint: React.ReactNode;
  /** Explicación adicional de qué ES este insumo (no qué hacer). */
  whatIs: React.ReactNode;
  accept: string;
  /** Etiqueta humana de formatos aceptados (ej. "Solo Excel (.xlsx)"). */
  acceptLabel: string;
  done: boolean;
  /** Si hay otra operación en curso globalmente, deshabilita Remove. */
  busy: boolean;
  disabled?: boolean;
  disabledHint?: string;
  resumen: React.ReactNode | null;
  onPick: (file?: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className={`pulso-upload-card${done ? " is-done" : ""}${disabled && !done ? " is-disabled" : ""}`}>
      {/* Header del insumo */}
      <div className="pulso-upload-card-head">
        <span aria-hidden="true" className="pulso-upload-card-icon">
          {done ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </span>
        <div className="pulso-upload-card-copy">
          <h3 className="pulso-upload-card-title">
            {title}
          </h3>
          <span className="pulso-upload-card-hint">
            {hint}
          </span>
        </div>
        {/* Botón Quitar — solo visible cuando el insumo ya está cargado. */}
        {done && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title={`Quitar ${kind === "xlsform" ? "XLSForm" : "base de datos"}`}
            aria-label={`Quitar ${kind === "xlsform" ? "XLSForm" : "base de datos"}`}
            className="pulso-upload-remove"
          >
            <Trash2 size={11} /> Quitar
          </button>
        )}
      </div>

      {/* Qué es este archivo — explicación clara del concepto */}
      <div className="pulso-upload-note">
        {whatIs}
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          onPick(e.dataTransfer.files?.[0]);
        }}
        className={`pulso-upload-dropzone${dragOver ? " is-drag-over" : ""}${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Upload size={22} className="pulso-upload-dropzone-icon" />
        <span className="pulso-upload-dropzone-title">
          {disabled && !done
            ? "Carga el XLSForm primero"
            : done
            ? `Reemplazar ${kind === "xlsform" ? "XLSForm" : "base de datos"}`
            : "Arrastra o haz click para subir"}
        </span>
        <span className="pulso-upload-dropzone-formats">
          {disabled && disabledHint ? disabledHint : acceptLabel}
        </span>
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
      </label>

      {resumen && (
        <div className="pulso-upload-summary">
          {resumen}
        </div>
      )}
    </div>
  );
}

function ResumenStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pulso-resumen-stat">
      <span>{label}</span>
      <strong>
        {value}
      </strong>
    </div>
  );
}

function ChoiceMappingReviewDialog({
  review,
  busy,
  onClose,
  onConfirm,
}: {
  review: ChoiceCodeMapReview;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const needsConfirmation = review.requires_confirmation;
  const changedCounts = review.maps.map((map) => choiceMapChangedItems(map).length);
  const totalChangedOptions = changedCounts.reduce((sum, count) => sum + count, 0);
  const allHighConfidence = review.maps.every((map) => map.high_confidence);
  return (
    <div className="pulso-choice-map-backdrop" role="presentation">
      <div
        className="pulso-choice-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-map-title"
      >
        <div className="pulso-choice-map-head">
          <span aria-hidden="true" className="pulso-choice-map-head-icon">
            {needsConfirmation ? <ArrowRightLeft size={18} /> : <ShieldCheck size={18} />}
          </span>
          <div>
            <p className="pulso-choice-map-kicker">
              Normalización de data
            </p>
            <h2 id="choice-map-title">
              Usar mapeo recomendado
            </h2>
          </div>
        </div>

        <div className="pulso-choice-map-explain">
          <Info size={16} />
          <p>
            Pulso ya detectó diferencias entre los códigos de origen de SurveyMonkey/SAV y los valores finales
            del XLSForm. Las etiquetas coinciden, pero algunos códigos no. Al confirmar, la data se recodifica
            hacia el XLSForm; las reglas SurveyMonkey usan este mismo puente para interpretar C1, C2, C3.
          </p>
        </div>

        <div className="pulso-choice-map-summary">
          <div>
            <span>Preguntas afectadas</span>
            <strong>{review.maps.length}</strong>
          </div>
          <div>
            <span>Opciones ajustadas</span>
            <strong>{totalChangedOptions}</strong>
          </div>
          <div>
            <span>Confianza</span>
            <strong>{allHighConfidence ? "Alta" : "Requiere revisión"}</strong>
          </div>
        </div>

        <p className="pulso-choice-map-guidance">
          Revisa solo si algo te llama la atención. Si las etiquetas son las correctas, la acción esperada es usar el mapeo recomendado.
        </p>

        <div className="pulso-choice-map-list">
          {review.maps.map((map, index) => (
            <ChoiceMappingCard
              key={`${map.variable}-${map.list_name}`}
              map={map}
              defaultOpen={!map.high_confidence || index === 0}
            />
          ))}
        </div>

        <div className="pulso-choice-map-actions">
          <button
            type="button"
            className="pulso-choice-map-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cerrar y revisar luego
          </button>
          {needsConfirmation && (
            <button
              type="button"
              className="pulso-choice-map-primary"
              onClick={onConfirm}
              disabled={busy}
            >
              <ShieldCheck size={15} />
              Usar este mapeo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceMappingCard({ map, defaultOpen }: { map: ChoiceCodeMap; defaultOpen?: boolean }) {
  const changedRows = choiceMapChangedItems(map);
  const visibleRows = changedRows.length > 0 ? changedRows : map.mappings.slice(0, 4);
  const unchangedRows = Math.max(0, map.mappings.length - changedRows.length);
  return (
    <details className="pulso-choice-map-card" open={defaultOpen}>
      <summary className="pulso-choice-map-card-head">
        <div>
          <h3>
            <code>{map.variable}</code> {map.label}
          </h3>
          <p>
            {changedRows.length} ajuste(s) de código · {map.type === "select_multiple" ? "selección múltiple" : "selección única"} · catálogo <code>{map.list_name}</code>
          </p>
        </div>
        <span className={`pulso-choice-map-confidence${map.high_confidence ? " is-high" : " is-review"}`}>
          {map.high_confidence ? "Alta confianza" : "Revisar"}
        </span>
      </summary>

      <div className="pulso-choice-map-table" role="table" aria-label={`Mapeo de ${map.variable}`}>
        <div className="pulso-choice-map-row is-head" role="row">
          <span role="columnheader">Código origen SM/SAV</span>
          <span role="columnheader">Etiqueta detectada</span>
          <span role="columnheader">Valor XLSForm final</span>
        </div>
        {visibleRows.map((item, idx) => (
          <div className="pulso-choice-map-row" role="row" key={`${item.source_code}-${item.xls_code}-${idx}`}>
            <span role="cell">
              <code>C{item.source_code}</code>
            </span>
            <span role="cell">
              {item.source_label || item.xls_label}
            </span>
            <span role="cell">
              <code>{item.xls_code}</code>
              {item.xls_label && <em>{item.xls_label}</em>}
            </span>
          </div>
        ))}
      </div>

      {unchangedRows > 0 && (
        <p className="pulso-choice-map-more">
          {unchangedRows} opción(es) ya coincidían o no necesitaban cambio.
        </p>
      )}
    </details>
  );
}

// =====================================================================
// CTA al final — "Continuar a Validación"
// =====================================================================
function ContinuarCTA() {
  return (
    <div className="pulso-continue-cta">
      <span aria-hidden="true" className="pulso-continue-cta-icon">
        <CheckCircle2 size={17} />
      </span>
      <div className="pulso-continue-cta-copy">
        <div className="pulso-continue-cta-title">
          Insumos cargados
        </div>
        <div className="pulso-continue-cta-note">
          Ya puedes auditar la data en Validación o pasar directo a Codificación si no necesitas chequear reglas.
        </div>
      </div>
      <a
        href="/validacion"
        className="pulso-continue-cta-link"
      >
        Ir a Validación <ArrowRight size={13} />
      </a>
    </div>
  );
}

// =====================================================================
// MultiBaseToggle — switch explícito entre "una base" y "varias bases"
// =====================================================================
// Copy intencionalmente humano: evitamos "multi-base", "single-base",
// "XLSForm" etc. en el label. El switch dice simplemente "El estudio
// tiene más de una base".
//
// Estados:
//   - off + (algo cargado): click encendido → convierte a varias bases.
//   - on + bases<=1: click apagado → degrada a una sola base.
//   - on + bases>1: no puede apagarse sin pérdida — queda bloqueado
//     con tooltip "quita las bases extra primero". El botón "Cerrar
//     estudio" del panel cubre el caso destructivo.
function MultiBaseToggle({
  on, canTurnOff, bases, disabled, onTurnOn, onTurnOff,
}: {
  on: boolean;
  canTurnOff: boolean;
  bases: number;
  disabled: boolean;
  onTurnOn: () => Promise<void>;
  onTurnOff: () => Promise<void>;
}) {
  const locked = on && !canTurnOff;
  const effectiveDisabled = disabled || locked;

  const handleClick = async () => {
    if (effectiveDisabled) return;
    if (on) await onTurnOff();
    else await onTurnOn();
  };

  const hint = on
    ? bases > 1
      ? `Tienes ${bases} bases. Para volver a una sola, quita las extras en el panel de abajo.`
      : "Puedes apagarlo para volver a la carga simple."
    : "Actívalo si vas a combinar varios cuestionarios o varias muestras (por ejemplo: docentes y estudiantes).";

  return (
    <div
      role="group"
      aria-labelledby="multibase-toggle-label"
      className={`pulso-multibase-toggle${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
    >
      <div className="pulso-multibase-toggle-copy">
        <div
          id="multibase-toggle-label"
          className="pulso-multibase-toggle-title"
        >
          El estudio tiene más de una base
        </div>
        <div className="pulso-multibase-toggle-hint">
          {hint}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="El estudio tiene más de una base"
        onClick={handleClick}
        disabled={effectiveDisabled}
        title={locked ? "Quita las bases extra primero para apagarlo" : undefined}
        className="pulso-switch"
      >
        <span aria-hidden="true" className="pulso-switch-thumb" />
      </button>
    </div>
  );
}
