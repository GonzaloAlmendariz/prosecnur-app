import { useState } from "react";
import {
  apiCodifAplicar,
  apiCodifFamiliasAplicar,
  apiCodifPlantillaCodigosSubir,
  apiCodifPlantillaFamilias,
  apiUpload,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e3e3e8", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [familiasFileId, setFamiliasFileId] = useState<string | null>(null);
  const [plantillaCodifFileId, setPlantillaCodifFileId] = useState<string | null>(null);
  const [codigosUploaded, setCodigosUploaded] = useState<{ name: string; size: number } | null>(null);
  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);

  const prereqOk = !!state?.xlsform && !!state?.data;

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setError("");
    setBusy(label);
    try {
      const out = await fn();
      await refresh();
      return out;
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onGenerarFamilias() {
    const out = await run("generando plantilla de familias…", () => apiCodifPlantillaFamilias());
    if (out) setFamiliasFileId(out.file_id);
  }

  async function onSubirFamilias(file?: File) {
    if (!file) return;
    await run(`subiendo ${file.name}…`, async () => {
      const up = await apiUpload(file, "plantilla_codif");
      return apiCodifFamiliasAplicar(up.file_id);
    }).then((out) => {
      if (out) setPlantillaCodifFileId(out.file_id);
    });
  }

  async function onSubirCodigos(file?: File) {
    if (!file) return;
    await run(`subiendo ${file.name}…`, async () => {
      const up = await apiUpload(file, "plantilla_codif");
      return apiCodifPlantillaCodigosSubir(up.file_id);
    }).then((out) => {
      if (out) setCodigosUploaded({ name: out.original_name, size: out.size });
    });
  }

  async function onAplicar() {
    const out = await run("aplicando codificación…", () => apiCodifAplicar());
    if (out) setAdaptados({ data: out.data_adaptada.file_id, inst: out.instrumento_adaptado.file_id });
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Fase 3 — Codificación de preguntas abiertas</h1>
      <p style={{ color: "#666" }}>
        Agrupa las respuestas abiertas en familias, asigna códigos y genera el dataset + instrumento adaptados.
        Las familias y la plantilla de códigos se editan en Excel fuera de la app; aquí solo se exportan, suben y aplican.
      </p>

      {!prereqOk && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem", fontSize: 14 }}>
          Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.
        </div>
      )}

      <Panel title="Paso 1 — Generar plantilla de familias">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          El backend inspecciona las variables de texto y genera un Excel con sugerencias de familias. Edítalo para
          agrupar las respuestas abiertas en categorías.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prereqOk || !!busy} onClick={onGenerarFamilias}>
            Generar plantilla
          </button>
          {familiasFileId && (
            <a href={downloadUrl(familiasFileId)} style={{ fontSize: 14 }}>familias.xlsx →</a>
          )}
        </div>
      </Panel>

      <Panel title="Paso 2 — Subir familias editadas → genera plantilla de códigos">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Sube el Excel con las familias ya agrupadas. El backend lo procesa y genera una segunda plantilla lista para
          que asignes un código por cada respuesta abierta.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx"
            disabled={!prereqOk || !!busy}
            onChange={(e) => onSubirFamilias(e.target.files?.[0])}
          />
          {plantillaCodifFileId && (
            <a href={downloadUrl(plantillaCodifFileId)} style={{ fontSize: 14 }}>plantilla_codificacion.xlsx →</a>
          )}
        </div>
      </Panel>

      <Panel title="Paso 3 — Subir plantilla de códigos editada">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Una vez que codificaste cada respuesta, sube el Excel final. No se genera descarga aquí — solo se registra
          para el Paso 4.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx"
            disabled={!plantillaCodifFileId || !!busy}
            onChange={(e) => onSubirCodigos(e.target.files?.[0])}
          />
          {codigosUploaded && (
            <span style={{ fontSize: 13, color: "#555" }}>
              ✓ {codigosUploaded.name} ({Math.round(codigosUploaded.size / 1024)} KB)
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Paso 4 — Aplicar codificación y descargar adaptados">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Genera la base de datos y el instrumento adaptados con los códigos aplicados. Estos serán los insumos de
          las fases siguientes.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!codigosUploaded || !!busy} onClick={onAplicar}>
            Aplicar codificación
          </button>
          {adaptados && (
            <>
              <a href={downloadUrl(adaptados.data)} style={{ fontSize: 14 }}>data_adaptada.xlsx →</a>
              <a href={downloadUrl(adaptados.inst)} style={{ fontSize: 14 }}>instrumento_adaptado.xlsx →</a>
            </>
          )}
        </div>
      </Panel>

      {busy && <div style={{ color: "#0066cc" }}>{busy}</div>}
      {error && <div style={{ color: "#c00" }}>⚠ {error}</div>}
    </section>
  );
}
