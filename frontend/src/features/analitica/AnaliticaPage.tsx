import { useState } from "react";
import { Download, Play, BookOpen, BarChart2, Grid3x3, FileText, Users } from "lucide-react";
import {
  apiAnaliticaCodebook,
  apiAnaliticaCruces,
  apiAnaliticaEnumeradores,
  apiAnaliticaFrecuencias,
  apiAnaliticaPreparar,
  apiAnaliticaSpss,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";

function Status({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
      <strong style={{ color: "var(--pulso-text)" }}>{label}:</strong> {value}
    </div>
  );
}

export default function AnaliticaPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [prep, setPrep] = useState<{ fuente: string; n_filas: number; n_columnas: number } | null>(null);
  const [downloads, setDownloads] = useState<Record<string, string>>({});
  const [cruceVar, setCruceVar] = useState("servicio");
  const [cruceModo, setCruceModo] = useState<"estandar" | "dimensiones">("estandar");
  const [colEnum, setColEnum] = useState("Enumerator_name");

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

  async function onPreparar() {
    const out = await run("preparando reporte_data…", () => apiAnaliticaPreparar());
    if (out) setPrep({ fuente: out.fuente, n_filas: out.n_filas, n_columnas: out.n_columnas });
  }

  async function onCodebook() {
    const out = await run("generando codebook…", () => apiAnaliticaCodebook());
    if (out) setDownloads((d) => ({ ...d, codebook: out.file_id }));
  }
  async function onFrecuencias() {
    const out = await run("generando frecuencias…", () => apiAnaliticaFrecuencias());
    if (out) setDownloads((d) => ({ ...d, frecuencias: out.file_id }));
  }
  async function onCruces() {
    const out = await run(`generando cruces (${cruceVar})…`, () => apiAnaliticaCruces(cruceVar, cruceModo));
    if (out) setDownloads((d) => ({ ...d, cruces: out.file_id }));
  }
  async function onSpss() {
    const out = await run("exportando SPSS (sav+sps)…", () => apiAnaliticaSpss());
    if (out) setDownloads((d) => ({ ...d, spss: out.file_id }));
  }
  async function onEnumeradores() {
    const out = await run("generando reporte de enumeradores…", () => apiAnaliticaEnumeradores(colEnum));
    if (out) setDownloads((d) => ({ ...d, enumeradores: out.file_id }));
  }

  function DL({ id, label }: { id?: string; label: string }) {
    if (!id) return null;
    return (
      <a href={downloadUrl(id)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Download size={13} /> {label}
      </a>
    );
  }

  const prepOk = !!state?.analitica_prep_ok;

  return (
    <section>
      <h1 className="pulso-page-title">Fase 4 — Preparación y reportes analíticos</h1>
      <p className="pulso-page-lead">
        Procesa la data con etiquetas y medidas SPSS y genera los entregables Excel/SPSS/PDF. Si ya aplicaste
        codificación en Fase 3, se usan los adaptados automáticamente.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar XLSForm y base de datos en <strong>1. Carga</strong> antes de preparar.</Alert>
        </div>
      )}

      <Panel eyebrow="Paso 1" title="Preparar datos para reporte"
        hint={<><code>reporte_instrumento()</code> + <code>reporte_data()</code> aplican etiquetas, value-labels y medidas SPSS. El resultado queda en memoria y alimenta todos los entregables.</>}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="pulso-primary" disabled={!prereqOk || !!busy} onClick={onPreparar}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> {prepOk ? "Volver a preparar" : "Preparar"}
          </button>
          {prep && (
            <>
              <Status label="Fuente" value={prep.fuente} />
              <Status label="Filas" value={prep.n_filas} />
              <Status label="Columnas" value={prep.n_columnas} />
            </>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Paso 2" title={<><BookOpen size={14} /> Libro de códigos</>} hint="Diccionario de variables con etiquetas y valores válidos (Excel).">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onCodebook}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Generar codebook
          </button>
          <DL id={downloads.codebook} label="codebook.xlsx" />
        </div>
      </Panel>

      <Panel eyebrow="Paso 3" title={<><BarChart2 size={14} /> Frecuencias</>} hint="Tablas univariadas por variable (estilo SPSS) en un Excel multi-hoja.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onFrecuencias}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Generar frecuencias
          </button>
          <DL id={downloads.frecuencias} label="frecuencias.xlsx" />
        </div>
      </Panel>

      <Panel eyebrow="Paso 4" title={<><Grid3x3 size={14} /> Cruces (tablas 2D)</>}
        hint={<>Indica la variable contra la cual se cruzarán el resto de preguntas (p. ej. <code>servicio</code>, <code>p1</code>, <code>distrito</code>). Puede tardar varios minutos en corpus grandes.</>}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Variable
            <input value={cruceVar} onChange={(e) => setCruceVar(e.target.value)} style={{ width: 140 }} />
          </label>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Modo
            <select value={cruceModo} onChange={(e) => setCruceModo(e.target.value as "estandar" | "dimensiones")}>
              <option value="estandar">estandar</option>
              <option value="dimensiones">dimensiones</option>
            </select>
          </label>
          <button disabled={!prepOk || !!busy || !cruceVar} onClick={onCruces}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Generar cruces
          </button>
          <DL id={downloads.cruces} label="cruces.xlsx" />
        </div>
      </Panel>

      <Panel eyebrow="Paso 5" title={<><FileText size={14} /> SPSS (.sav + .sps)</>}
        hint={<>Exporta el dataset etiquetado como <code>.sav</code> y la sintaxis de niveles como <code>.sps</code>, empaquetados en un zip.</>}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onSpss}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Exportar SPSS
          </button>
          <DL id={downloads.spss} label="spss.zip" />
        </div>
      </Panel>

      <Panel eyebrow="Paso 6" title={<><Users size={14} /> Reporte de enumeradores (PDF)</>}
        hint="Indica la columna que identifica al enumerador/encuestador en tus datos.">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Columna
            <input value={colEnum} onChange={(e) => setColEnum(e.target.value)} style={{ width: 180 }} />
          </label>
          <button disabled={!prepOk || !!busy || !colEnum} onClick={onEnumeradores}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Play size={14} /> Generar reporte
          </button>
          <DL id={downloads.enumeradores} label="enumeradores.pdf" />
        </div>
      </Panel>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
