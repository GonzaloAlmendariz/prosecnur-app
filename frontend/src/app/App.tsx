import { useEffect, useState } from "react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiCreateSession,
  apiHealth,
  apiShutdown,
  apiUpload,
} from "../api/client";

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: "#555" }}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState<string>("conectando…");
  const [sessionId, setSessionId] = useState<string>("");
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const h = await apiHealth();
        setHealth(`prosecnur-app v${h.version} · prosecnur v${h.prosecnur_version}`);
        const s = await apiCreateSession();
        setSessionId(s.session_id);
      } catch (e: unknown) {
        setHealth(`error: ${(e as Error).message}`);
      }
    })();
  }, []);

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
      } else {
        const r = await apiCargaData(up.file_id);
        setDataPreview(r.preview);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ borderBottom: "1px solid #ddd", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Pulso Report</h1>
        <StatusLine label="Backend" value={health} />
        <StatusLine label="Sesión" value={sessionId || "—"} />
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Fase 1 — Carga de insumos</h2>
        <p style={{ color: "#666" }}>
          Sube el XLSForm y la base de datos del estudio. El backend los parseará y mostrará un resumen.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
          <div>
            <h3>XLSForm (instrumento)</h3>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => onPick("xlsform", e.target.files?.[0])} />
            {instrumento && (
              <div style={{ marginTop: "1rem", fontSize: 14 }}>
                <StatusLine label="Preguntas" value={String(instrumento.n_preguntas)} />
                <StatusLine label="Secciones" value={String(instrumento.n_secciones)} />
                <StatusLine label="Listas de opciones" value={String(instrumento.n_listas_opciones)} />
                {instrumento.secciones.length > 0 && (
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary>Ver secciones</summary>
                    <ul>{instrumento.secciones.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </details>
                )}
              </div>
            )}
          </div>

          <div>
            <h3>Base de datos</h3>
            <input type="file" accept=".xlsx,.xls,.csv,.sav" onChange={(e) => onPick("data", e.target.files?.[0])} />
            {dataPreview && (
              <div style={{ marginTop: "1rem", fontSize: 14 }}>
                <StatusLine label="Filas" value={String(dataPreview.n_filas)} />
                <StatusLine label="Columnas" value={String(dataPreview.n_columnas)} />
                <details style={{ marginTop: "0.5rem" }}>
                  <summary>Ver columnas</summary>
                  <ul>
                    {dataPreview.columnas.map((c, i) => (
                      <li key={i}>{c.nombre} <em style={{ color: "#888" }}>({c.tipo})</em></li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        </div>

        {busy && <div style={{ color: "#0066cc", marginTop: "1rem" }}>{busy}</div>}
        {error && <div style={{ color: "#c00", marginTop: "1rem" }}>⚠ {error}</div>}
      </section>

      <footer style={{ borderTop: "1px solid #ddd", paddingTop: "1rem", color: "#888", fontSize: 13 }}>
        <button onClick={() => apiShutdown().then(() => window.close())}>Cerrar aplicación</button>
      </footer>
    </main>
  );
}
