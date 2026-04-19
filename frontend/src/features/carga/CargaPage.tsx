import { useState } from "react";
import {
  apiCargaData,
  apiCargaInstrumento,
  apiUpload,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: "#555" }}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

export default function CargaPage() {
  const { refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

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
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Fase 1 — Carga de insumos</h1>
      <p style={{ color: "#666" }}>
        Sube el XLSForm (instrumento) y la base de datos del estudio. El backend los parsea y muestra un resumen.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        <div>
          <h3>XLSForm (instrumento)</h3>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => onPick("xlsform", e.target.files?.[0])} />
          {instrumento && (
            <div style={{ marginTop: "1rem", fontSize: 14 }}>
              <Status label="Preguntas" value={String(instrumento.n_preguntas)} />
              <Status label="Secciones" value={String(instrumento.n_secciones)} />
              <Status label="Listas de opciones" value={String(instrumento.n_listas_opciones)} />
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
        </div>
      </div>

      {busy && <div style={{ color: "#0066cc", marginTop: "1rem" }}>{busy}</div>}
      {error && <div style={{ color: "#c00", marginTop: "1rem" }}>⚠ {error}</div>}
    </section>
  );
}
