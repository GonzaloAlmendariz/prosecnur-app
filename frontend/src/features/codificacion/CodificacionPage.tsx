import { useState } from "react";
import { Download, Upload, Play, Check } from "lucide-react";
import {
  apiCodifAplicar,
  apiCodifPlantillaCodigosGenerar,
  apiCodifPlantillaCodigosSubir,
  apiUpload,
  downloadUrl,
  FamiliasCommitResponse,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { FamiliasEditor } from "./FamiliasEditor";

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [familiasCommit, setFamiliasCommit] = useState<FamiliasCommitResponse | null>(null);
  const [plantillaCodifFileId, setPlantillaCodifFileId] = useState<string | null>(null);
  const [codigosUploaded, setCodigosUploaded] = useState<{ name: string; size: number } | null>(null);
  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);

  const prereqOk = !!state?.xlsform && !!state?.data;
  const splitReady = !!familiasCommit;

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

  async function onGenerarPlantillaCodigos() {
    const out = await run("generando plantilla de códigos…", () => apiCodifPlantillaCodigosGenerar());
    if (out) setPlantillaCodifFileId(out.file_id);
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
        Las familias se editan dentro de la app; la plantilla de códigos sigue en Excel por ahora.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      <Panel
        eyebrow="Paso 1"
        title="Editar familias"
        hint="La app sugiere un borrador de familias desde tu XLSForm y tu data. Activa/desactiva filas, ajusta las columnas del dataset y marca select_one como padre/hijo. El progreso se autoguarda cada 2 segundos."
      >
        {prereqOk ? (
          <FamiliasEditor onCommitted={(res) => setFamiliasCommit(res)} />
        ) : (
          <em style={{ color: "var(--pulso-text-soft)", fontSize: 13 }}>
            Carga primero XLSForm y data en Fase 1.
          </em>
        )}
      </Panel>

      <Panel
        eyebrow="Paso 2"
        title="Plantilla de códigos"
        hint="Genera el Excel multi-hoja para asignar códigos a cada respuesta abierta. Edítalo fuera de la app y súbelo en el Paso 3. (El editor in-app llegará en la próxima sub-parte.)"
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="pulso-primary"
            disabled={!splitReady || !!busy}
            onClick={onGenerarPlantillaCodigos}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> Generar plantilla
          </button>
          {!splitReady && (
            <span style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
              Antes valida el borrador de familias en el Paso 1.
            </span>
          )}
          {plantillaCodifFileId && (
            <a href={downloadUrl(plantillaCodifFileId)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> plantilla_codificacion.xlsx
            </a>
          )}
        </div>
      </Panel>

      <Panel
        eyebrow="Paso 3"
        title="Subir plantilla de códigos editada"
        hint="Una vez que codificaste cada respuesta, sube el Excel final."
      >
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
