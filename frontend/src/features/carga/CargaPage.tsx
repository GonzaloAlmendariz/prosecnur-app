import { useEffect, useRef, useState } from "react";
import * as Lucide from "lucide-react";
import {
  ArrowRight, CheckCircle2, Database, FileSpreadsheet,
  RotateCcw, Sparkles, Trash2, Upload,
} from "lucide-react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiEstudioDowngradeToSingle,
  apiEstudioFromSession,
  apiEstudioGet,
  apiEstudioInit,
  apiInstrumentoEstructura,
  apiListDemos,
  apiLoadDemo,
  apiQuitarData,
  apiQuitarInstrumento,
  apiUpload,
  DemoMeta,
  EstudioPayload,
  Pregunta,
  Seccion,
  uploadKindForDataFile,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { PageHeader } from "../../components/PageHeader";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";
import { BasesPanel } from "./BasesPanel";

// Fase 1 — Carga de insumos.
//
// El analista tiene tres caminos:
//   1. Elegir un demo pre-cargado (Estudio GIZ, OPS Salud, Acreditación
//      multi-base) — el backend carga XLSForm + data de un tiro y
//      salta directamente a la inspección.
//   2. Subir su propio XLSForm + base de datos manualmente. Cada uno
//      se parsea y muestra un resumen con contadores.
//   3. Combinación: cargar demo y luego reemplazar la data con la suya.
//
// Tras la carga, esta página muestra la estructura del instrumento
// (secciones + preguntas con reglas) para que el analista verifique
// antes de pasar a Validación.

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

type IconCmp = typeof Database;

function resolveLucideIcon(name: string | undefined): IconCmp {
  const registry = Lucide as unknown as Record<string, IconCmp>;
  return (name && registry[name]) || registry["FileText"] || registry["Square"];
}

export default function CargaPage() {
  const { sessionId, state, refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [demos, setDemos] = useState<DemoMeta[]>([]);
  const [demosLoading, setDemosLoading] = useState<boolean>(true);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  // Cargar catálogo de demos disponibles al montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiListDemos();
        if (!cancelled) setDemos(r.demos);
      } catch {
        if (!cancelled) setDemos([]);
      } finally {
        if (!cancelled) setDemosLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onLoadDemo(name?: string) {
    setError("");
    setLoadingDemo(name ?? "giz");
    setBusy(`Cargando ${name ?? "demo"}…`);
    try {
      const out = await apiLoadDemo(name);
      localStorage.setItem("pulso.sessionId", out.session_id);
      setInstrumento(out.resumen_instrumento);
      setDataPreview({
        n_filas: out.n_filas,
        n_columnas: out.n_columnas,
        columnas: [],
        preview_filas: [],
      } as DataPreview);
      await refresh();
      const r = await apiInstrumentoEstructura();
      setEstructura(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      setLoadingDemo(null);
    }
  }

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

  // Detectar cuál demo (si alguno) está cargado en la sesión actual.
  // Match por `titulo_humano` contra `estudio_nombre` — es el identifier
  // humano que el backend usa al crear la sesión desde un demo. Funciona
  // single-base (estudio_nombre = titulo_humano del demo) y multi-base
  // (GIZ o Acreditación también setean titulo_humano como nombre).
  const activeDemoName = state?.estudio_nombre ?? null;
  const activeDemo = activeDemoName
    ? demos.find((d) => d.titulo_humano === activeDemoName)
    : null;

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
    <section>
      <PageHeader
        title="Fase 1 — Carga de insumos"
        lead="Sube un XLSForm + la base de datos, o arranca con uno de nuestros datasets de ejemplo. Cuando ambos estén cargados, podrás pasar a Validación."
        meta={
          allReady ? (
            <SaveStatusIndicator state="saved" variant="badge" savedLabel="Insumos listos" />
          ) : hasXlsform || hasData ? (
            <SaveStatusIndicator state="dirty" variant="badge" />
          ) : undefined
        }
      />

      {/* Toggle del modo de estudio — reemplaza el botón "+ Agregar
          otra base" con un switch explícito. Visible siempre que el
          usuario tenga algo cargado (single o multi). Cuando lo activa
          por primera vez, el backend convierte los archivos a multi-
          base con auto-nombre; al apagarlo, degrada a single-base si
          queda 1 sola base. */}
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
      <section style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 14 }}>
          <SectionEyebrow
            label="Tus dos insumos"
            hint="Para generar el reporte, Prosecnur necesita estas dos piezas. Cada una explica una parte del estudio — el XLSForm el 'qué se preguntó' y la base de datos el 'qué respondieron'."
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 16,
          }}
        >
          <UploadCard
            kind="xlsform"
            icon={FileSpreadsheet}
            title="XLSForm (instrumento)"
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
            resumen={instrumento && (
              <>
                <ResumenStat label="Preguntas" value={instrumento.n_preguntas} />
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
            title="Base de datos"
            hint="Las respuestas de los encuestados, una fila por caso. Cada columna corresponde a una pregunta del XLSForm."
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
            resumen={dataPreview && (
              <>
                <ResumenStat label="Filas" value={dataPreview.n_filas} />
                <ResumenStat label="Columnas" value={dataPreview.n_columnas} />
                {dataPreview.columnas.length > 0 && (
                  <details style={{ marginTop: 6, fontSize: 11 }}>
                    <summary style={{ cursor: "pointer", color: "var(--pulso-primary)", fontWeight: 600 }}>
                      Ver columnas ({dataPreview.columnas.length})
                    </summary>
                    <ul
                      style={{
                        maxHeight: 180, overflow: "auto",
                        margin: "6px 0 0", padding: "0 0 0 18px",
                        fontSize: 11, lineHeight: 1.5,
                      }}
                    >
                      {dataPreview.columnas.map((c, i) => (
                        <li key={i}>
                          <code style={{ fontFamily: "ui-monospace, monospace" }}>{c.nombre}</code>{" "}
                          <em style={{ color: "var(--pulso-text-soft)" }}>({c.tipo})</em>
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

      {/* Sección 2 — Demos discretos (ambient content, no compite).
          Reactivo: si ya hay un demo cargado, ese chip queda resaltado
          (primary-soft + check) y ofrece "Quitar". El resto se muestra
          deshabilitado para señalar que cambiar de demo requiere
          descargar primero el actual. */}
      {(demosLoading || demos.length > 0) && (
        <section
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            background: "var(--pulso-surface-2)",
            border: "1px solid var(--pulso-border)",
            borderRadius: 10,
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            marginBottom: demosLoading ? 0 : 10,
          }}>
            <Sparkles size={13} color="var(--pulso-text-soft)" aria-hidden="true" />
            <span style={{
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.5,
              color: "var(--pulso-text-soft)",
            }}>
              {activeDemo ? "Datos de ejemplo cargados" : "¿Sin datos propios? Explora con un ejemplo"}
            </span>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
              {activeDemo
                ? <>Estás trabajando con <strong>{activeDemo.titulo_humano}</strong>. Si quieres cambiar, primero quítalo.</>
                : "Cargamos XLSForm + base de datos de un estudio real para que veas el flujo completo."}
            </span>
          </div>

          {demosLoading ? null : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {demos.map((d) => {
                const isActive = activeDemo?.name === d.name;
                const isOtherActive = !!activeDemo && !isActive;
                return (
                  <DemoChip
                    key={d.name}
                    demo={d}
                    isActive={isActive}
                    isLoading={loadingDemo === d.name}
                    isDisabled={(!!busy && loadingDemo !== d.name) || isOtherActive}
                    onLoad={() => onLoadDemo(d.name)}
                    onRemove={isActive ? () => onQuitar("xlsform") : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
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
            title="Mapa de preguntas"
            hint="Cada celda es una pregunta. Los chips indican las reglas declaradas en el XLSForm."
          >
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </>
      )}

      {/* Feedback inferior — loading + errores */}
      {busy && (
        <div style={{ marginTop: 16 }}>
          <LoadingBlock variant="inline" label={busy} />
        </div>
      )}
      {error && (
        <div style={{ marginTop: 16 }}>
          <ErrorBlock label="No se pudo completar la carga" detail={error} />
        </div>
      )}

      {/* CTA de continuar cuando todo está listo */}
      {allReady && !busy && !error && (
        <ContinuarCTA />
      )}
    </section>
  );
}

// `EstudioActivoBanner` (banner genérico multi-base que vivía acá) se
// reemplazó por `BasesPanel` completo — ahora no solo muestra las bases
// sino que permite renombrar, quitar y agregar.

// =====================================================================
// Demo chip — compact, ambient (nota al pie de la carga manual).
// =====================================================================
function DemoChip({
  demo, isActive, isLoading, isDisabled, onLoad, onRemove,
}: {
  demo: DemoMeta;
  /** Este demo está cargado en la sesión actual. */
  isActive: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onLoad: () => void;
  /** Si está presente + isActive, se muestra botón "Quitar". */
  onRemove?: () => void;
}) {
  const Icon = resolveLucideIcon(demo.icono_ui);
  const multiBase = demo.n_bases > 1;

  // Estilos del container según estado: activo > hoverable > deshabilitado.
  const baseBg = isActive ? "var(--pulso-primary-soft)" : "white";
  const baseBorder = isActive ? "var(--pulso-primary)" : "var(--pulso-border)";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 8,
        border: `1px solid ${baseBorder}`,
        background: baseBg,
        boxShadow: isActive ? "0 0 0 3px var(--pulso-primary-ring)" : "none",
        opacity: !isActive && isDisabled ? 0.45 : 1,
        transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
        minWidth: 0,
      }}
    >
      {/* Icon — pasa a check cuando está activo */}
      <span
        aria-hidden="true"
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: isActive ? "white" : "var(--pulso-surface-2)",
          color: isActive ? "var(--pulso-primary)" : "var(--pulso-primary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: isActive ? "1px solid var(--pulso-primary-border)" : "none",
          flexShrink: 0,
        }}
      >
        {isLoading ? (
          <Lucide.Loader2 size={13} className="pulso-spin" />
        ) : isActive ? (
          <CheckCircle2 size={13} />
        ) : (
          <Icon size={13} />
        )}
      </span>

      {/* Texto: título + etiqueta. Es la zona clickeable cuando NO está
          activo — cargar al click. Cuando está activo, el chip entero
          no es un botón; las acciones van en el botón Quitar. */}
      <button
        type="button"
        onClick={isActive ? undefined : onLoad}
        disabled={isActive || isDisabled || isLoading}
        title={demo.descripcion}
        style={{
          flex: 1, minWidth: 0,
          display: "flex", flexDirection: "column", gap: 1,
          padding: 0, border: "none", background: "transparent",
          textAlign: "left",
          cursor: isActive ? "default" : isDisabled ? "not-allowed" : "pointer",
          color: "inherit",
        }}
      >
        <span
          style={{
            fontSize: 12, fontWeight: 600,
            color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {demo.titulo_humano}
        </span>
        <span
          style={{
            fontSize: 10, color: "var(--pulso-text-soft)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {isActive ? "Cargado" : demo.etiqueta_estudio}
          {multiBase && ` · ${demo.n_bases} bases`}
        </span>
      </button>

      {/* Acción lateral: Quitar cuando activo, flecha cuando disponible. */}
      {isActive && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          title="Quitar este demo"
          aria-label={`Quitar ${demo.titulo_humano}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 600,
            padding: "3px 8px", borderRadius: 5,
            border: "1px solid var(--pulso-primary-border)",
            background: "white",
            color: "var(--pulso-primary)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
            e.currentTarget.style.background = "var(--pulso-danger-bg)";
            e.currentTarget.style.color = "var(--pulso-danger-fg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = "var(--pulso-primary)";
          }}
        >
          <RotateCcw size={10} /> Quitar
        </button>
      ) : (
        <ArrowRight
          size={12}
          color="var(--pulso-text-soft)"
          style={{ flexShrink: 0, opacity: isDisabled ? 0.3 : 1 }}
        />
      )}
    </div>
  );
}

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================
function UploadCard({
  kind, icon: Icon, title, hint, whatIs, accept, acceptLabel, done, busy, resumen, onPick, onRemove,
}: {
  kind: "xlsform" | "data";
  icon: IconCmp;
  title: string;
  hint: string;
  /** Explicación adicional de qué ES este insumo (no qué hacer). */
  whatIs: React.ReactNode;
  accept: string;
  /** Etiqueta humana de formatos aceptados (ej. "Solo Excel (.xlsx)"). */
  acceptLabel: string;
  done: boolean;
  /** Si hay otra operación en curso globalmente, deshabilita Remove. */
  busy: boolean;
  resumen: React.ReactNode | null;
  onPick: (file?: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 16,
        padding: "22px 24px", borderRadius: 12,
        border: done ? "1px solid var(--pulso-success-border)" : "1px solid var(--pulso-border)",
        background: done ? "var(--pulso-success-bg)" : "white",
        boxShadow: done ? "none" : "var(--pulso-shadow-low)",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      {/* Header del insumo */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: done ? "white" : "var(--pulso-primary-soft)",
            color: done ? "var(--pulso-success-fg)" : "var(--pulso-primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: done
              ? "1px solid var(--pulso-success-border)"
              : "1px solid var(--pulso-primary-border)",
            flexShrink: 0,
          }}
        >
          {done ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 3 }}>
          <h3
            style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              color: "var(--pulso-text)", letterSpacing: -0.2, lineHeight: 1.25,
            }}
          >
            {title}
          </h3>
          <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
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
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, padding: "5px 9px",
              border: "1px solid var(--pulso-border)",
              borderRadius: 6, background: "white",
              color: "var(--pulso-text-soft)",
              cursor: busy ? "wait" : "pointer",
              flexShrink: 0,
              transition: "border-color 120ms ease, color 120ms ease, background 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
              e.currentTarget.style.color = "var(--pulso-danger-fg)";
              e.currentTarget.style.background = "var(--pulso-danger-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--pulso-border)";
              e.currentTarget.style.color = "var(--pulso-text-soft)";
              e.currentTarget.style.background = "white";
            }}
          >
            <Trash2 size={11} /> Quitar
          </button>
        )}
      </div>

      {/* Qué es este archivo — explicación clara del concepto */}
      <div
        style={{
          fontSize: 11, lineHeight: 1.6,
          color: "var(--pulso-text-soft)",
          padding: "10px 12px",
          background: "var(--pulso-surface-2)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 7,
        }}
      >
        {whatIs}
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onPick(e.dataTransfer.files?.[0]);
        }}
        style={{
          padding: "20px 14px", borderRadius: 9,
          border: `2px dashed ${dragOver ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
          background: dragOver ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
          cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          textAlign: "center",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <Upload size={22} color={dragOver ? "var(--pulso-primary)" : "var(--pulso-text-soft)"} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pulso-text)" }}>
          {done
            ? `Reemplazar ${kind === "xlsform" ? "XLSForm" : "base de datos"}`
            : "Arrastra o haz click para subir"}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 500,
            color: "var(--pulso-text-soft)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {acceptLabel}
        </span>
        <input
          type="file"
          accept={accept}
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
      </label>

      {resumen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {resumen}
        </div>
      )}
    </div>
  );
}

function ResumenStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "baseline", gap: 8,
        fontSize: 12, color: "var(--pulso-text-soft)",
      }}
    >
      <span style={{ minWidth: 110 }}>{label}</span>
      <strong
        style={{
          color: "var(--pulso-text)",
          fontFamily: "ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
        }}
      >
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
    <div
      style={{
        marginTop: 20,
        padding: "14px 18px",
        borderRadius: 10,
        background: "var(--pulso-success-bg)",
        border: "1px solid var(--pulso-success-border)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: "white",
          color: "var(--pulso-success-fg)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--pulso-success-border)",
          flexShrink: 0,
        }}
      >
        <CheckCircle2 size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-success-fg)" }}>
          Insumos cargados
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-success-fg)", opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>
          Ya puedes auditar la data en Validación o pasar directo a Codificación si no necesitas chequear reglas.
        </div>
      </div>
      <a
        href="/validacion"
        className="pulso-primary"
        style={{
          textDecoration: "none",
          fontSize: 12, fontWeight: 600,
          padding: "7px 14px",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
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
      style={{
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 16px", borderRadius: 10,
        border: "1px solid var(--pulso-border)",
        background: on ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
        transition: "background 160ms ease, border-color 160ms ease",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          id="multibase-toggle-label"
          style={{
            fontSize: 13, fontWeight: 700,
            color: on ? "var(--pulso-primary)" : "var(--pulso-text)",
          }}
        >
          El estudio tiene más de una base
        </div>
        <div
          style={{
            fontSize: 11, color: "var(--pulso-text-soft)",
            lineHeight: 1.4, marginTop: 2,
          }}
        >
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
        style={{
          position: "relative",
          width: 44, height: 24,
          borderRadius: 999,
          border: "1px solid",
          // OFF: fondo gris medio (var(--pulso-text-soft) atenuado vía
          // token --pulso-neutral), contraste claro contra el bg del
          // contenedor (surface-2 o primary-soft).
          borderColor: on ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          background: on ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          cursor: effectiveDisabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : locked ? 0.75 : 1,
          transition: "background 160ms ease, border-color 160ms ease",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2, left: on ? 22 : 2,
            width: 18, height: 18,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
            transition: "left 160ms ease",
          }}
        />
      </button>
    </div>
  );
}
