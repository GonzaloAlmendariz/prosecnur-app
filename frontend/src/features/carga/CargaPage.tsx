import { useEffect, useState } from "react";
import * as Lucide from "lucide-react";
import { FileSpreadsheet, Database, PlayCircle, Loader2 } from "lucide-react";
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
import { Alert } from "../../components/Alert";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
      <strong style={{ color: "var(--pulso-text)" }}>{label}:</strong> {value}
    </div>
  );
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

  // Cargar catálogo de demos disponibles al montar. Si el backend no
  // tiene ninguno registrado o los archivos no existen, `demos` queda
  // vacío y el picker muestra solo el demo genérico por fallback.
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
    setLoadingDemo(name ?? "generic");
    setBusy(`cargando ${name ?? "demo"}…`);
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
    setBusy(`subiendo ${file.name}…`);
    try {
      const up = await apiUpload(file, kind);
      setBusy(`procesando ${file.name}…`);
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

  return (
    <section>
      <h1 className="pulso-page-title">Fase 1 — Carga de insumos</h1>
      <p className="pulso-page-lead">
        Sube el XLSForm (instrumento) y la base de datos. El backend los parsea y muestra un resumen; abajo
        puedes inspeccionar interactivamente la estructura del instrumento antes de pasar a Validación.
      </p>

      <div
        style={{
          padding: "16px 18px",
          marginBottom: 20,
          borderRadius: "var(--pulso-radius)",
          border: "1px solid var(--pulso-primary-border)",
          background: "linear-gradient(135deg, rgba(0,36,87,0.08), rgba(0,36,87,0.02))",
          boxShadow: "var(--pulso-shadow-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 999,
              background: "var(--pulso-primary)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(0,36,87,0.35)", flexShrink: 0,
            }}
          >
            <PlayCircle size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-primary)" }}>
              ¿Solo quieres explorar la app?
            </div>
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
              Elige uno de los datasets de prueba — cada uno abre la sesión con XLSForm + data listos,
              saltando la carga manual. Puedes reemplazar luego con tus propios archivos.
            </div>
          </div>
        </div>

        {demosLoading ? (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            Cargando catálogo de demos…
          </div>
        ) : demos.length === 0 ? (
          <div
            style={{
              fontSize: 12, color: "var(--pulso-text-soft)",
              padding: "10px 12px", borderRadius: 6,
              background: "white", border: "1px dashed var(--pulso-border)",
            }}
          >
            No hay demos disponibles. Añade archivos en <code>api/inst/samples/</code> según el catálogo en <code>router_sistema.R</code>.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {demos.map((d) => {
              const Icon = resolveLucideIcon(d.icono_ui);
              const isLoading = loadingDemo === d.name;
              const isDisabled = !!busy && !isLoading;
              return (
                <button
                  key={d.name}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onLoadDemo(d.name)}
                  style={{
                    display: "flex", flexDirection: "column", gap: 6,
                    padding: 12, borderRadius: 9,
                    border: "1px solid var(--pulso-border)",
                    background: "white",
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled ? 0.55 : 1,
                    textAlign: "left",
                    transition: "border-color 120ms ease, box-shadow 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled) {
                      e.currentTarget.style.borderColor = "var(--pulso-primary)";
                      e.currentTarget.style.boxShadow = "var(--pulso-shadow-med)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--pulso-border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <span
                      style={{
                        width: 30, height: 30, borderRadius: 7,
                        background: "var(--pulso-primary-soft)",
                        color: "var(--pulso-primary)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isLoading ? <Loader2 size={14} className="pulso-spin" /> : <Icon size={15} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.25 }}>
                        {d.titulo_humano}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 1 }}>
                        {d.etiqueta_estudio}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
                    {d.descripcion}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Panel title={<><FileSpreadsheet size={14} /> XLSForm (instrumento)</>}>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => onPick("xlsform", e.target.files?.[0])} />
          {instrumento && (
            <div style={{ marginTop: 14, fontSize: 13, display: "grid", gap: 4 }}>
              <Status label="Preguntas" value={String(instrumento.n_preguntas)} />
              <Status label="Secciones" value={String(instrumento.n_secciones)} />
              <Status label="Listas de opciones" value={String(instrumento.n_listas_opciones)} />
            </div>
          )}
        </Panel>

        <Panel title={<><Database size={14} /> Base de datos</>}>
          <input type="file" accept=".xlsx,.xls,.csv,.sav" onChange={(e) => onPick("data", e.target.files?.[0])} />
          {dataPreview && (
            <div style={{ marginTop: 14, fontSize: 13, display: "grid", gap: 4 }}>
              <Status label="Filas" value={String(dataPreview.n_filas)} />
              <Status label="Columnas" value={String(dataPreview.n_columnas)} />
              {dataPreview.columnas.length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: "pointer" }}>Ver columnas</summary>
                  <ul style={{ maxHeight: 180, overflow: "auto" }}>
                    {dataPreview.columnas.map((c, i) => (
                      <li key={i}>
                        {c.nombre} <em style={{ color: "var(--pulso-text-soft)" }}>({c.tipo})</em>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Panel>
      </div>

      {state?.instrumento_parsed && estructura && (
        <>
          <Panel eyebrow="Instrumento" title="Mapa de secciones" hint="Cada fila es una sección del XLSForm con su lógica de visibilidad (relevant).">
            <SeccionesPanel secciones={estructura.secciones} />
          </Panel>
          <Panel eyebrow="Instrumento" title="Mapa de preguntas" hint="Cada celda es una pregunta. Los chips indican las reglas declaradas en el XLSForm.">
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </>
      )}

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}

type LucideIcon = (props: { size?: number; className?: string }) => JSX.Element;

function resolveLucideIcon(name: string | undefined): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return (name && registry[name]) || registry["FileText"] || registry["Square"];
}
