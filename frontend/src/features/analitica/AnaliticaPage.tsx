import { useState } from "react";
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e3e3e8", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function Status({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "#555" }}>
      <strong>{label}:</strong> {value}
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
    return <a href={downloadUrl(id)} style={{ fontSize: 14 }}>{label} →</a>;
  }

  const prepOk = !!state?.analitica_prep_ok;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Fase 4 — Preparación y reportes analíticos</h1>
      <p style={{ color: "#666" }}>
        Procesa la data con etiquetas y medidas SPSS, y genera los entregables Excel/SPSS/PDF.
        Si ya aplicaste codificación en Fase 3, se usan los adaptados automáticamente.
      </p>

      {!prereqOk && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem", fontSize: 14 }}>
          Necesitas cargar XLSForm y base de datos en <strong>1. Carga</strong> antes de preparar.
        </div>
      )}

      <Panel title="Paso 1 — Preparar datos para reporte">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Ejecuta <code>reporte_instrumento()</code> + <code>reporte_data()</code> para aplicar etiquetas, value-labels
          y medidas SPSS. Este resultado queda en memoria y alimenta todos los entregables siguientes.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prereqOk || !!busy} onClick={onPreparar}>
            {prepOk ? "Volver a preparar" : "Preparar"}
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

      <Panel title="Paso 2 — Libro de códigos">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Diccionario de variables con etiquetas y valores válidos (Excel).
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onCodebook}>Generar codebook</button>
          <DL id={downloads.codebook} label="codebook.xlsx" />
        </div>
      </Panel>

      <Panel title="Paso 3 — Frecuencias">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Tablas univariadas por variable (estilo SPSS), exportadas en un Excel multi-hoja.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onFrecuencias}>Generar frecuencias</button>
          <DL id={downloads.frecuencias} label="frecuencias.xlsx" />
        </div>
      </Panel>

      <Panel title="Paso 4 — Cruces (tablas 2D)">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Indica la variable contra la cual se cruzarán el resto de preguntas (p. ej. <code>servicio</code>,
          <code>p1</code>, <code>distrito</code>). Puede tardar varios minutos en corpus grandes.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            Variable:{" "}
            <input
              value={cruceVar}
              onChange={(e) => setCruceVar(e.target.value)}
              style={{ fontSize: 13, padding: "2px 6px", width: 140 }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Modo:{" "}
            <select value={cruceModo} onChange={(e) => setCruceModo(e.target.value as "estandar" | "dimensiones")}>
              <option value="estandar">estandar</option>
              <option value="dimensiones">dimensiones</option>
            </select>
          </label>
          <button disabled={!prepOk || !!busy || !cruceVar} onClick={onCruces}>Generar cruces</button>
          <DL id={downloads.cruces} label="cruces.xlsx" />
        </div>
      </Panel>

      <Panel title="Paso 5 — SPSS (.sav + .sps)">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Exporta el dataset etiquetado como <code>.sav</code> y la sintaxis de niveles como <code>.sps</code>,
          empaquetados en un zip.
        </p>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={!prepOk || !!busy} onClick={onSpss}>Exportar SPSS</button>
          <DL id={downloads.spss} label="spss.zip" />
        </div>
      </Panel>

      <Panel title="Paso 6 — Reporte de enumeradores (PDF)">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
          Indica la columna que identifica al enumerador/encuestador en tus datos.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            Columna:{" "}
            <input
              value={colEnum}
              onChange={(e) => setColEnum(e.target.value)}
              style={{ fontSize: 13, padding: "2px 6px", width: 180 }}
            />
          </label>
          <button disabled={!prepOk || !!busy || !colEnum} onClick={onEnumeradores}>Generar reporte</button>
          <DL id={downloads.enumeradores} label="enumeradores.pdf" />
        </div>
      </Panel>

      {busy && <div style={{ color: "#0066cc" }}>{busy}</div>}
      {error && <div style={{ color: "#c00" }}>⚠ {error}</div>}
    </section>
  );
}
