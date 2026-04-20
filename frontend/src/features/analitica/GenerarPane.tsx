import { useRef, useState } from "react";
import { Play, Download, Upload, CheckCircle2 } from "lucide-react";
import {
  apiAnaliticaCodebook,
  apiAnaliticaConfigExport,
  apiAnaliticaConfigImport,
  apiAnaliticaCruces,
  apiAnaliticaEnumeradores,
  apiAnaliticaFrecuencias,
  apiAnaliticaSpss,
  downloadUrl,
  FileJobResult,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { useAnaliticaStore } from "./store";

// Paso 3 — Generar.
// Ejecución de los 5 reportes con la config del store. B1 mantiene la
// semántica exacta del AnaliticaPage original (algunos reportes son
// síncronos, otros async); B4 uniforma todos a jobs async y agrega
// indicador "config cambiada desde última generación".

type ReporteKey = "codebook" | "frecuencias" | "cruces" | "spss" | "enumeradores";

export function GenerarPane() {
  const { state, refresh } = useSession();
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const enumer = useAnaliticaStore((s) => s.config.enumeradores);

  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [downloads, setDownloads] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Record<ReporteKey, string | null>>({
    codebook: null, frecuencias: null, cruces: null, spss: null, enumeradores: null,
  });
  const [ioBusy, setIoBusy] = useState<"export" | "import" | null>(null);
  const [ioMsg, setIoMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prepOk = !!state?.analitica_prep_ok;
  const hasJob = Object.values(jobs).some(Boolean);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setError("");
    setBusy(label);
    try {
      const out = await fn();
      await refresh();
      return out;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onCodebook() {
    const out = await run("Generando codebook…", () => apiAnaliticaCodebook());
    if (out) setDownloads((d) => ({ ...d, codebook: out.file_id }));
  }
  async function onFrecuencias() {
    const out = await run("Generando frecuencias…", () => apiAnaliticaFrecuencias());
    if (out) setDownloads((d) => ({ ...d, frecuencias: out.file_id }));
  }
  async function onCruces() {
    // B1: aún se pasa la variable como antes (primera del array para compat).
    // B3: endpoint aceptará el body JSON entero con cruces_vars:[].
    const primaryVar = cruces.cruces_vars.find((v) => v.trim().length > 0) ?? "";
    if (!primaryVar) { setError("Agrega al menos una variable en Diseñar → Cruces."); return; }
    const out = await run(`Iniciando cruces (${primaryVar})…`, () => apiAnaliticaCruces(primaryVar, cruces.modo));
    if (out) setJobs((j) => ({ ...j, cruces: out.job_id }));
  }
  async function onSpss() {
    const out = await run("Exportando SPSS…", () => apiAnaliticaSpss());
    if (out) setJobs((j) => ({ ...j, spss: out.job_id }));
  }
  async function onEnumeradores() {
    if (!enumer.col_enumerador.trim()) { setError("Configura la columna de enumerador en Diseñar."); return; }
    const out = await run("Generando reporte de enumeradores…", () => apiAnaliticaEnumeradores(enumer.col_enumerador));
    if (out) setJobs((j) => ({ ...j, enumeradores: out.job_id }));
  }

  function onJobDone(key: ReporteKey, data: FileJobResult) {
    setDownloads((d) => ({ ...d, [key]: data.file_id }));
    setJobs((j) => ({ ...j, [key]: null }));
    void refresh();
  }
  function onJobError(key: ReporteKey, msg: string) {
    setError(msg);
    setJobs((j) => ({ ...j, [key]: null }));
  }
  function onJobCancelled(key: ReporteKey) {
    setJobs((j) => ({ ...j, [key]: null }));
  }

  async function onExportJson() {
    setError(""); setIoMsg(""); setIoBusy("export");
    try {
      const bundle = await apiAnaliticaConfigExport();
      const { ok: _ok, ...payload } = bundle;
      void _ok;
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pulso_analitica_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setIoMsg("Exportado ✓");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIoBusy(null);
      setTimeout(() => setIoMsg(""), 2500);
    }
  }

  async function onImportJson(file?: File) {
    if (!file) return;
    setError(""); setIoMsg(""); setIoBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiAnaliticaConfigImport(parsed);
      setIoMsg("Importado ✓ (recarga la página para ver los cambios)");
    } catch (e) {
      setError(`JSON inválido o rechazado: ${(e as Error).message}`);
    } finally {
      setIoBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setIoMsg(""), 4000);
    }
  }

  if (!prepOk) {
    return (
      <Alert kind="warn">
        Prepara los datos primero en el paso <strong>1 · Preparar</strong> antes de generar reportes.
      </Alert>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ReporteRow
        title="Codebook"
        desc="Diccionario de variables con etiquetas y valores."
        onRun={onCodebook}
        downloadId={downloads.codebook}
        downloadLabel="codebook.xlsx"
        busy={!!busy || hasJob}
      />

      <ReporteRow
        title="Frecuencias"
        desc="Tablas univariadas estilo SPSS por sección."
        onRun={onFrecuencias}
        downloadId={downloads.frecuencias}
        downloadLabel="frecuencias.xlsx"
        busy={!!busy || hasJob}
      />

      <ReporteRow
        title="Cruces"
        desc={cruces.cruces_vars.length > 0
          ? `${cruces.cruces_vars.filter(v=>v.trim()).length} variable(s) · modo ${cruces.modo}${cruces.show_sig ? ` · α=${cruces.alpha}` : ""}`
          : "Configura las variables a cruzar en Diseñar."}
        onRun={onCruces}
        downloadId={downloads.cruces}
        downloadLabel="cruces.xlsx"
        busy={!!busy || !!jobs.cruces}
        disabled={cruces.cruces_vars.every((v) => !v.trim())}
        job={jobs.cruces}
        onJobDone={(d) => onJobDone("cruces", d)}
        onJobError={(m) => onJobError("cruces", m)}
        onJobCancelled={() => onJobCancelled("cruces")}
      />

      <ReporteRow
        title="SPSS"
        desc="Dataset etiquetado .sav + sintaxis .sps empaquetados."
        onRun={onSpss}
        downloadId={downloads.spss}
        downloadLabel="spss.zip"
        busy={!!busy || !!jobs.spss}
        job={jobs.spss}
        onJobDone={(d) => onJobDone("spss", d)}
        onJobError={(m) => onJobError("spss", m)}
        onJobCancelled={() => onJobCancelled("spss")}
      />

      <ReporteRow
        title="Enumeradores"
        desc={`col=${enumer.col_enumerador || "?"} · min=${enumer.min_encuestas}`}
        onRun={onEnumeradores}
        downloadId={downloads.enumeradores}
        downloadLabel="enumeradores.pdf"
        busy={!!busy || !!jobs.enumeradores}
        disabled={!enumer.col_enumerador.trim()}
        job={jobs.enumeradores}
        onJobDone={(d) => onJobDone("enumeradores", d)}
        onJobError={(m) => onJobError("enumeradores", m)}
        onJobCancelled={() => onJobCancelled("enumeradores")}
      />

      {/* Bloque de persistencia: export/import JSON + indicador autosave */}
      <div
        style={{
          marginTop: 10, padding: 12,
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <CheckCircle2 size={11} /> Autoguardado activo
        </div>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1 }}>
          La configuración se guarda sola. Exporta un JSON para respaldarla o compartirla.
        </span>
        <button
          type="button"
          onClick={onExportJson}
          disabled={ioBusy === "export"}
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Download size={12} /> {ioBusy === "export" ? "Exportando…" : "Exportar JSON"}
        </button>
        <label
          style={{
            fontSize: 12, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            cursor: ioBusy === "import" ? "wait" : "pointer",
            border: "1px solid var(--pulso-border)", borderRadius: 4, background: "white",
          }}
          title="Restaura un estado previamente exportado"
        >
          <Upload size={12} />
          {ioBusy === "import" ? "Importando…" : "Importar JSON"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => onImportJson(e.target.files?.[0])}
          />
        </label>
        {ioMsg && <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>{ioMsg}</div>}
      </div>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}

function ReporteRow({
  title, desc, onRun, downloadId, downloadLabel, busy, disabled,
  job, onJobDone, onJobError, onJobCancelled,
}: {
  title: string;
  desc: string;
  onRun: () => void;
  downloadId?: string;
  downloadLabel: string;
  busy: boolean;
  disabled?: boolean;
  job?: string | null;
  onJobDone?: (d: FileJobResult) => void;
  onJobError?: (m: string) => void;
  onJobCancelled?: () => void;
}) {
  return (
    <Panel eyebrow="Ejecutar" title={title} hint={desc}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="pulso-primary"
          onClick={onRun}
          disabled={busy || !!disabled}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Play size={14} /> Generar
        </button>
        {downloadId && (
          <a
            href={downloadUrl(downloadId)}
            style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Download size={13} /> {downloadLabel}
          </a>
        )}
      </div>
      {job && onJobDone && onJobError && onJobCancelled && (
        <div style={{ marginTop: 12 }}>
          <JobProgress<FileJobResult>
            label={`Generando ${title.toLowerCase()}`}
            jobId={job}
            onDone={onJobDone}
            onError={onJobError}
            onCancelled={onJobCancelled}
          />
        </div>
      )}
    </Panel>
  );
}
