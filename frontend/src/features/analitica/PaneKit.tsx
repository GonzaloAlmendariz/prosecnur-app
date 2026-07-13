import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Download, Loader2, Play } from "lucide-react";
import { JobProgress } from "../../components/JobProgress";
import { ErrorBlock } from "../../components/States";
import { apiSaveFileAs, downloadUrl, FileJobResult } from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";

// Toolkit compartido por los 5 panes de analítica (Codebook, Bases,
// Frecuencias, Cruces, Enumeradores). Mantiene consistencia visual —
// misma jerarquía tipográfica, mismo estilo de secciones, mismo estilo
// de colapsables, mismo footer "Generar".

// ---- PaneGroup ------------------------------------------------------------
// Encabezado de categoría (tipo de entregable / de salida) + divisor + sus
// secciones. Separa visualmente grupos como "Fuente original", "Archivos
// para análisis", "Formatos del libro"… para que el analista ubique rápido
// qué necesita. Full-width; las secciones se apilan dentro del body.
export function PaneGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="analitica-pane-group">
      <header className="analitica-pane-group-head">
        <span className="analitica-pane-group-label">{label}</span>
        {hint && <span className="analitica-pane-group-hint">{hint}</span>}
      </header>
      <div className="analitica-pane-group-body">{children}</div>
    </section>
  );
}

// ---- Section wrapper ------------------------------------------------------
// Título + subtítulo explicativo + contenido. Da identidad uniforme a
// cada paso de configuración dentro de un Panel.
export function Section({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string | React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="analitica-section">
      <div className="analitica-section-head">
        <div className="analitica-section-title">{title}</div>
        {subtitle && (
          <div className="analitica-section-subtitle">
            {subtitle}
          </div>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

// ---- Collapsible ----------------------------------------------------------
// Plegable compacto con resumen cuando está cerrado. El botón
// trigger tiene hover background tenue (var(--pulso-surface-2)) para
// dar affordance; la animación del chevron suaviza el switch.
export function Collapsible({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="analitica-collapsible">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="analitica-collapsible-trigger"
        aria-expanded={open}
      >
        <span className="analitica-collapsible-chevron" data-open={open ? "true" : "false"}>
          <ChevronDown size={13} />
        </span>
        <span>{title}</span>
        {summary && !open && (
          <span className="analitica-collapsible-summary">
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div className="analitica-collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}

// ---- GenerateFooter -------------------------------------------------------
// Footer estandarizado: botón primario "Generar" + JobProgress (si async)
// + link de descarga inline + bloque de error. El botón muestra spinner
// Loader2 girando mientras está busy (feedback inmediato; JobProgress
// cubre el async detallado).
export function GenerateFooter({
  label, busy, jobId, fileId, downloadName, error,
  onGenerate, disabled, disabledHint,
  onJobDone, onJobError, onJobCancelled,
  perBase,
  variant = "primary",
}: {
  label: string;
  busy: boolean;
  jobId?: string | null;
  fileId: string | null;
  downloadName: string;
  error: string;
  onGenerate: () => void;
  disabled?: boolean;
  disabledHint?: string;
  onJobDone?: (d: FileJobResult) => void;
  onJobError?: (m: string) => void;
  onJobCancelled?: () => void;
  // v0.2+: cuando el reporte es multi-base, el backend devuelve
  // `bases[]` con cada archivo individual. El footer muestra el zip
  // principal (via fileId) + una lista discreta con los archivos por
  // base abajo para descarga individual.
  perBase?: {
    nombre: string;
    file_id?: string;
    filename: string;
    size: number;
    skipped?: boolean;
    reason?: string;
  }[];
  variant?: "primary" | "secondary";
}) {
  const running = busy || !!jobId;
  const multi = (perBase?.length ?? 0) > 1;
  const { project } = useProjectShell();
  const autoSavedRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    if (!fileId || running || autoSavedRef.current === fileId || !window.prosecnurApi) return;
    const generatedFileId = fileId;
    autoSavedRef.current = generatedFileId;
    const ext = downloadName.includes(".") ? downloadName.split(".").pop() || "*" : "*";
    const defaultPath = project.status.path
      ? (() => {
          const sep = project.status.path!.includes("\\") ? "\\" : "/";
          return `${project.status.path!.replace(/[/\\][^/\\]+$/, "")}${sep}${downloadName}`;
        })()
      : undefined;
    let cancelled = false;
    async function saveGeneratedFile() {
      try {
        const target = await window.prosecnurApi!.saveEntregableDialog({
          defaultName: downloadName,
          defaultPath,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: "Todos", extensions: ["*"] }],
        });
        if (!target || cancelled) return;
        const saved = await apiSaveFileAs(generatedFileId, target, { overwrite: true });
        if (!cancelled) setSaveStatus(`Guardado como ${saved.filename}`);
      } catch (e) {
        if (!cancelled) {
          autoSavedRef.current = null;
          setSaveStatus((e as Error).message);
        }
      }
    }
    void saveGeneratedFile();
    return () => { cancelled = true; };
  }, [fileId, running, downloadName, project.status.path]);

  return (
    <>
      <div className="analitica-generate-footer">
        <button
          className={variant === "secondary" ? "pulso-secondary" : "pulso-primary"}
          onClick={onGenerate}
          disabled={running || !!disabled}
        >
          {running ? (
            <Loader2 size={14} className="pulso-spin" />
          ) : (
            <Play size={14} />
          )}
          {running ? "Generando…" : label}
        </button>
        {disabled && disabledHint && (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            {disabledHint}
          </span>
        )}
        {fileId && (
          <a
            href={downloadUrl(fileId)}
            className="analitica-download-pill"
          >
            <Download size={12} />
            {multi ? `${downloadName} (zip · ${perBase!.length} bases)` : downloadName}
          </a>
        )}
        {saveStatus && (
          <span style={{
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: saveStatus.startsWith("[") ? "var(--pulso-danger-fg)" : "var(--pulso-success-fg)",
          }}>
            {!saveStatus.startsWith("[") && <CheckCircle2 size={12} />}
            {saveStatus}
          </span>
        )}
      </div>

      {multi && (
        <div className="analitica-per-base-card">
          <div className="analitica-per-base-title">
            Descarga individual por base:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {perBase!.map((b) => (
              b.skipped ? (
                <span
                  key={b.nombre}
                  title={b.reason ?? "Omitida"}
                  style={{
                    fontSize: 11, padding: "3px 9px", borderRadius: 999,
                    background: "var(--pulso-surface)",
                    border: "1px dashed var(--pulso-border)",
                    color: "var(--pulso-text-soft)",
                    fontStyle: "italic",
                  }}
                >
                  {b.nombre} (omitida)
                </span>
              ) : b.file_id ? (
                <a
                  key={b.nombre}
                  href={downloadUrl(b.file_id)}
                  style={{
                    fontSize: 11,
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 9px", borderRadius: 999,
                    background: "white", border: "1px solid var(--pulso-border)",
                    color: "var(--pulso-text)", textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  <Download size={10} /> {b.nombre}
                </a>
              ) : (
                <span
                  key={b.nombre}
                  style={{
                    fontSize: 11, padding: "3px 9px", borderRadius: 999,
                    background: "var(--pulso-surface)",
                    border: "1px solid var(--pulso-border)",
                    color: "var(--pulso-text-soft)",
                  }}
                >
                  {b.nombre}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {jobId && onJobDone && onJobError && onJobCancelled && (
        <JobProgress<FileJobResult>
          label={label}
          jobId={jobId}
          onDone={onJobDone}
          onError={onJobError}
          onCancelled={onJobCancelled}
        />
      )}
      {error && <ErrorBlock label="No se pudo generar" detail={error} />}
    </>
  );
}
