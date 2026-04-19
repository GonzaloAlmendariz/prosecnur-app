import { useEffect, useState } from "react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiInstrumentoEstructura,
  apiLoadDemo,
  apiUpload,
  Pregunta,
  Seccion,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: "#555" }}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e3e3e8", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

export default function CargaPage() {
  const { state, refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  async function onLoadDemo() {
    setError("");
    setBusy("cargando demo GIZ…");
    try {
      const out = await apiLoadDemo();
      localStorage.setItem("pulso.sessionId", out.session_id);
      setInstrumento({
        n_preguntas: out.n_preguntas,
        n_secciones: 0,
        secciones: [],
        n_listas_opciones: 0,
      } as InstrumentoResumen);
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
        setEstructura(null); // reset viz until user opens it
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

  const xlsformReady = !!state?.xlsform && !!state?.instrumento_parsed;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Fase 1 — Carga de insumos</h1>
      <p style={{ color: "var(--pulso-text-soft)" }}>
        Sube el XLSForm (instrumento) y la base de datos del estudio. El backend los parsea y muestra un resumen;
        abajo puedes inspeccionar interactivamente la estructura del instrumento antes de pasar a la validación.
      </p>

      <div
        className="pulso-card"
        style={{
          padding: "1rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(175deg, rgba(255,255,255,0.96), rgba(247,251,255,0.90))",
          borderColor: "var(--pulso-primary-border)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-primary)" }}>
            ¿Solo quieres explorar la app?
          </div>
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 2 }}>
            Carga un conjunto de datos de prueba (proyecto GIZ, 1 631 encuestas) y recorre todas las fases sin subir archivos propios.
          </div>
        </div>
        <button className="pulso-primary" disabled={!!busy} onClick={onLoadDemo}>
          Cargar datos de prueba
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <Panel title="XLSForm (instrumento)">
          <input type="file" accept=".xlsx,.xls" onChange={(e) => onPick("xlsform", e.target.files?.[0])} />
          {instrumento && (
            <div style={{ marginTop: "1rem", fontSize: 14 }}>
              <Status label="Preguntas" value={String(instrumento.n_preguntas)} />
              <Status label="Secciones" value={String(instrumento.n_secciones)} />
              <Status label="Listas de opciones" value={String(instrumento.n_listas_opciones)} />
            </div>
          )}
        </Panel>

        <Panel title="Base de datos">
          <input type="file" accept=".xlsx,.xls,.csv,.sav" onChange={(e) => onPick("data", e.target.files?.[0])} />
          {dataPreview && (
            <div style={{ marginTop: "1rem", fontSize: 14 }}>
              <Status label="Filas" value={String(dataPreview.n_filas)} />
              <Status label="Columnas" value={String(dataPreview.n_columnas)} />
              <details style={{ marginTop: "0.5rem" }}>
                <summary>Ver columnas</summary>
                <ul>
                  {dataPreview.columnas.map((c, i) => (
                    <li key={i}>
                      {c.nombre} <em style={{ color: "#888" }}>({c.tipo})</em>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </Panel>
      </div>

      {xlsformReady && estructura && (
        <>
          <Panel title="Mapa de secciones">
            <SeccionesPanel secciones={estructura.secciones} />
          </Panel>
          <Panel title="Mapa de preguntas">
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </>
      )}

      {busy && <div style={{ color: "#0066cc", marginTop: "1rem" }}>{busy}</div>}
      {error && <div style={{ color: "#c00", marginTop: "1rem" }}>⚠ {error}</div>}
    </section>
  );
}
