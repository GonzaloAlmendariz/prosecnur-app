import { useState } from "react";
import { Download } from "lucide-react";
import {
  apiCodifAplicar,
  downloadUrl,
  FamiliasCommitResponse,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { FamiliasEditor } from "./FamiliasEditor";
import { CodigosEditor } from "./CodigosEditor";

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [familiasCommit, setFamiliasCommit] = useState<FamiliasCommitResponse | null>(null);
  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);

  const prereqOk = !!state?.xlsform && !!state?.data;

  async function onAplicar() {
    setError("");
    setBusy("aplicando codificación…");
    try {
      const out = await apiCodifAplicar();
      setAdaptados({ data: out.data_adaptada.file_id, inst: out.instrumento_adaptado.file_id });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        Agrupa las respuestas abiertas en familias, asigna códigos dentro de la app, y genera el dataset + instrumento adaptados. Todo se autoguarda.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      <Panel
        eyebrow="Paso 1"
        title="Editar familias"
        hint="La app sugiere un borrador de familias desde tu XLSForm y tu data. Activa/desactiva filas, marca select_one como padre/hijo, y ajusta las columnas del dataset. El progreso se autoguarda cada 2 segundos."
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
        title="Asignar códigos"
        hint="Para cada respuesta observada, escribe el código final en la columna *_recod. Los códigos nuevos se declaran en el bloque auxiliar (nuevo_codigo / nueva_etiqueta). Las ediciones se autoguardan directo al xlsx de la plantilla."
      >
        {prereqOk ? (
          <CodigosEditor onApply={onAplicar} applyBusy={!!busy} />
        ) : (
          <em style={{ color: "var(--pulso-text-soft)", fontSize: 13 }}>
            Carga primero XLSForm y data en Fase 1.
          </em>
        )}
      </Panel>

      {adaptados && (
        <Panel eyebrow="Resultado" title="Archivos adaptados">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={downloadUrl(adaptados.data)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> data_adaptada.xlsx
            </a>
            <a href={downloadUrl(adaptados.inst)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> instrumento_adaptado.xlsx
            </a>
          </div>
        </Panel>
      )}

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
