import { useState } from "react";
import { Download, Upload, Play, Check } from "lucide-react";
import {
  apiCodifAplicar,
  apiCodifFamiliasAplicar,
  apiCodifPlantillaCodigosSubir,
  apiCodifPlantillaFamilias,
  apiUpload,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";

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
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        Agrupa las respuestas abiertas en familias, asigna códigos y genera el dataset + instrumento adaptados.
        Las familias y la plantilla de códigos se editan en Excel fuera de la app; aquí solo se exportan, suben y aplican.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      <Panel eyebrow="Paso 1" title="Generar plantilla de familias" hint="El backend inspecciona las variables de texto y genera un Excel con sugerencias de familias. Edítalo para agrupar las respuestas abiertas en categorías.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="pulso-primary" disabled={!prereqOk || !!busy} onClick={onGenerarFamilias}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Generar plantilla
          </button>
          {familiasFileId && (
            <a href={downloadUrl(familiasFileId)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> familias.xlsx
            </a>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Paso 2" title="Subir familias editadas" hint="Sube el Excel con las familias ya agrupadas. El backend genera una segunda plantilla lista para que asignes un código por cada respuesta abierta.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} color="var(--pulso-text-soft)" />
            <input
              type="file"
              accept=".xlsx"
              disabled={!prereqOk || !!busy}
              onChange={(e) => onSubirFamilias(e.target.files?.[0])}
            />
          </label>
          {plantillaCodifFileId && (
            <a href={downloadUrl(plantillaCodifFileId)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> plantilla_codificacion.xlsx
            </a>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Paso 3" title="Subir plantilla de códigos editada" hint="Una vez que codificaste cada respuesta, sube el Excel final. No se genera descarga aquí — solo se registra para el Paso 4.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} color="var(--pulso-text-soft)" />
            <input
              type="file"
              accept=".xlsx"
              disabled={!plantillaCodifFileId || !!busy}
              onChange={(e) => onSubirCodigos(e.target.files?.[0])}
            />
          </label>
          {codigosUploaded && (
            <span style={{ fontSize: 13, color: "var(--pulso-text-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Check size={14} color="#10b981" /> {codigosUploaded.name} ({Math.round(codigosUploaded.size / 1024)} KB)
            </span>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Paso 4" title="Aplicar codificación y descargar adaptados" hint="Genera la base de datos y el instrumento adaptados con los códigos aplicados. Serán los insumos de las fases siguientes.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="pulso-primary" disabled={!codigosUploaded || !!busy} onClick={onAplicar}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Aplicar codificación
          </button>
          {adaptados && (
            <>
              <a href={downloadUrl(adaptados.data)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Download size={13} /> data_adaptada.xlsx
              </a>
              <a href={downloadUrl(adaptados.inst)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Download size={13} /> instrumento_adaptado.xlsx
              </a>
            </>
          )}
        </div>
      </Panel>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
