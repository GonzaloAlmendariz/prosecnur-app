import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, CheckCircle2, Database, FileSpreadsheet,
  Trash2, Upload,
} from "lucide-react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiEstudioDowngradeToSingle,
  apiEstudioFromSession,
  apiEstudioGet,
  apiEstudioInit,
  apiInstrumentoEstructura,
  apiQuitarData,
  apiQuitarInstrumento,
  apiUpload,
  EstudioPayload,
  Pregunta,
  Seccion,
  uploadKindForDataFile,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
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
  return rows;
}

export default function CargaPage() {
  const { sessionId, state, refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
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
      } else {
        await apiQuitarData();
        setDataPreview(null);
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
  const allReady = hasXlsform && hasData;

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
    setEstructura(null);
    setEstudio(null);
    setAutoOpenAddBase(false);
    setError("");
    setBusy("");
  }, [sessionId]);

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

  return (
    <PageFrame
      title="Fase 1 - Carga de insumos"
      lead="Sube un XLSForm y la base de datos para preparar el estudio."
      meta={
        allReady ? (
          <SaveStatusIndicator state="saved" variant="badge" savedLabel="Insumos listos" />
        ) : hasXlsform || hasData ? (
          <SaveStatusIndicator state="dirty" variant="badge" />
        ) : undefined
      }
      toolbar={
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
      }
    >
      {/* Modo multi-base: BasesPanel reemplaza los UploadCards.
          Cada base es un par (XLSForm + data) con nombre único. El
          usuario puede agregar, quitar, renombrar y volver a la carga
          simple si queda 1 sola base. */}
      {isMultiBase && estudio && (
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
      )}

      {/* Sección 1 — LOS DOS INSUMOS (single-base). Solo se muestra si
          NO estamos en modo multi-base. Si estamos en multi-base,
          BasesPanel ya cubre la carga de insumos. */}
      {!isMultiBase && (
      <>
      <section className="pulso-upload-section">
        <div className="pulso-upload-section-head">
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
                      </>
                    )
                    : "Normalización pendiente: se activa después de cargar el XLSForm"}
                </div>
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

        {/* El botón "+ Agregar otra base" se eliminó — ahora la
            conversión single→multi se hace con el MultiBaseToggle de
            arriba del todo. */}
      </section>
      </>
      )}

      {/* Inspección del instrumento */}
      {state?.instrumento_parsed && estructura && (
        <>
          <Panel
            eyebrow="Instrumento"
            title="Mapa de secciones"
            hint="Cada fila es una sección del XLSForm con su lógica de visibilidad (relevant)."
          >
            <SeccionesPanel secciones={estructura.secciones} />
          </Panel>
          <Panel
            eyebrow="Instrumento"
            title="Mapa del instrumento"
            hint="Distingue preguntas respondidas, variables calculadas y reglas declaradas en el XLSForm."
          >
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </>
      )}

      {/* Feedback inferior — loading + errores */}
      {busy && (
        <div className="pulso-feedback-stack">
          <LoadingBlock variant="inline" label={busy} />
        </div>
      )}
      {error && (
        <div className="pulso-feedback-stack">
          <ErrorBlock label="No se pudo completar la carga" detail={error} />
        </div>
      )}

      {/* CTA de continuar cuando todo está listo */}
      {allReady && !busy && !error && (
        <ContinuarCTA />
      )}
    </PageFrame>
  );
}

// `EstudioActivoBanner` (banner genérico multi-base que vivía acá) se
// reemplazó por `BasesPanel` completo — ahora no solo muestra las bases
// sino que permite renombrar, quitar y agregar.

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================
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
