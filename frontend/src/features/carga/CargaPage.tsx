import { useEffect, useState } from "react";
import * as Lucide from "lucide-react";
import {
  ArrowRight, CheckCircle2, Database, FileSpreadsheet,
  Layers, Sparkles, Upload,
} from "lucide-react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiInstrumentoEstructura,
  apiListDemos,
  apiLoadDemo,
  apiUpload,
  DemoMeta,
  Pregunta,
  Seccion,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { PageHeader } from "../../components/PageHeader";
import { LoadingBlock, ErrorBlock, EmptyState, SectionEyebrow } from "../../components/States";
import { ContextBar } from "../../components/ContextBar";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";

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
  const { state, refresh } = useSession();
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

  async function onPick(kind: "xlsform" | "data", file?: File) {
    if (!file) return;
    setError("");
    setBusy(`Subiendo ${file.name}…`);
    try {
      const up = await apiUpload(file, kind);
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

      {/* Banner Estudio activo (multi-base). Arriba de todo para que el
          analista vea inmediatamente qué bases tiene cargadas. */}
      {state && state.n_bases > 1 && (
        <EstudioActivoBanner
          estudioNombre={state.estudio_nombre}
          basesNombres={state.bases_nombres}
        />
      )}

      {/* Sección 1 — LOS DOS INSUMOS (protagonistas). Upload grande,
          con explicación de qué es cada uno. Es lo más importante de
          la página: arriba, con espacio y claridad. */}
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
            resumen={instrumento && (
              <>
                <ResumenStat label="Preguntas" value={instrumento.n_preguntas} />
                <ResumenStat label="Secciones" value={instrumento.n_secciones} />
                <ResumenStat label="Listas de opciones" value={instrumento.n_listas_opciones} />
              </>
            )}
            onPick={(file) => onPick("xlsform", file)}
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
            accept=".xlsx,.xls,.csv,.sav"
            acceptLabel=".xlsx · .csv · .sav"
            done={hasData}
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
          />
        </div>
      </section>

      {/* Sección 2 — Demos discretos (ambient content, no compite).
          Fila compacta con datasets de ejemplo. El usuario no debería
          sentir que "demo" es la ruta principal — es el fallback para
          explorar sin datos propios. */}
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
              ¿Sin datos propios? Explora con un ejemplo
            </span>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
              Cargamos XLSForm + base de datos de un estudio real para que veas el flujo completo.
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
              {demos.map((d) => (
                <DemoChip
                  key={d.name}
                  demo={d}
                  isLoading={loadingDemo === d.name}
                  isDisabled={!!busy && loadingDemo !== d.name}
                  onLoad={() => onLoadDemo(d.name)}
                />
              ))}
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

// =====================================================================
// Estudio activo (multi-base)
// =====================================================================
function EstudioActivoBanner({
  estudioNombre, basesNombres,
}: {
  estudioNombre: string | null;
  basesNombres: string[];
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <ContextBar
        ariaLabel="Estudio multi-base activo"
        background="var(--pulso-primary-soft)"
        border="1px solid var(--pulso-primary-border)"
        style={{ alignItems: "flex-start", gap: 12 }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "white",
            color: "var(--pulso-primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--pulso-primary-border)",
            flexShrink: 0,
          }}
        >
          <Layers size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-primary)" }}>
            Estudio multi-base{estudioNombre ? `: ${estudioNombre}` : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
            Tienes <strong>{basesNombres.length} bases</strong> cargadas. Los slides del
            reporte pueden mezclar variables de distintas fuentes con la notación{" "}
            <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>fuente$variable</code>.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {basesNombres.map((nombre) => (
              <span
                key={nombre}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 999,
                  background: "white",
                  border: "1px solid var(--pulso-primary-border)",
                  color: "var(--pulso-primary)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {nombre}
              </span>
            ))}
          </div>
        </div>
      </ContextBar>
    </div>
  );
}

// =====================================================================
// Demo chip — compact, ambient (nota al pie de la carga manual).
// =====================================================================
function DemoChip({
  demo, isLoading, isDisabled, onLoad,
}: {
  demo: DemoMeta;
  isLoading: boolean;
  isDisabled: boolean;
  onLoad: () => void;
}) {
  const Icon = resolveLucideIcon(demo.icono_ui);
  const multiBase = demo.n_bases > 1;
  return (
    <button
      type="button"
      disabled={isDisabled || isLoading}
      onClick={onLoad}
      title={demo.descripcion}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 8,
        border: "1px solid var(--pulso-border)",
        background: "white",
        cursor: isDisabled ? "not-allowed" : "pointer",
        textAlign: "left",
        opacity: isDisabled ? 0.55 : 1,
        transition: "border-color 120ms ease, background 120ms ease",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (isDisabled || isLoading) return;
        e.currentTarget.style.borderColor = "var(--pulso-primary)";
        e.currentTarget.style.background = "var(--pulso-primary-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--pulso-border)";
        e.currentTarget.style.background = "white";
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: "var(--pulso-surface-2)",
          color: "var(--pulso-primary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isLoading ? <Lucide.Loader2 size={13} className="pulso-spin" /> : <Icon size={13} />}
      </span>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 1 }}>
        <span
          style={{
            fontSize: 12, fontWeight: 600, color: "var(--pulso-text)",
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
          {demo.etiqueta_estudio}
          {multiBase && ` · ${demo.n_bases} bases`}
        </span>
      </div>
      <ArrowRight size={12} color="var(--pulso-text-soft)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================
function UploadCard({
  kind, icon: Icon, title, hint, whatIs, accept, acceptLabel, done, resumen, onPick,
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
  resumen: React.ReactNode | null;
  onPick: (file?: File) => void;
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
