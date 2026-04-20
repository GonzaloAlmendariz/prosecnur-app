import { useState } from "react";
import { ChevronDown, ChevronRight, Download, Play } from "lucide-react";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { downloadUrl, FileJobResult } from "../../api/client";

// Toolkit compartido por los 5 panes de analítica (Codebook, Bases,
// Frecuencias, Cruces, Enumeradores). Mantiene consistencia visual —
// misma jerarquía tipográfica, mismo estilo de secciones, mismo estilo
// de colapsables, mismo footer "Generar".

// ---- Section wrapper ------------------------------------------------------
// Título numerado + subtítulo explicativo + contenido. Da identidad
// uniforme a cada paso de configuración.
export function Section({ title, subtitle, children }: { title: string; subtitle?: string | React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

// ---- Collapsible ----------------------------------------------------------
export function Collapsible({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--pulso-border)", borderRadius: 6, background: "var(--pulso-surface)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left",
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
          color: "var(--pulso-text-soft)",
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{title}</span>
        {summary && !open && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--pulso-text)" }}>
            {summary}
          </span>
        )}
      </button>
      {open && <div style={{ padding: "4px 14px 12px", background: "white" }}>{children}</div>}
    </div>
  );
}

// ---- GenerateFooter -------------------------------------------------------
// Footer estandarizado: botón primario "Generar" + JobProgress (si async)
// + link de descarga inline + bloque de error.
export function GenerateFooter({
  label, busy, jobId, fileId, downloadName, error,
  onGenerate, disabled, disabledHint,
  onJobDone, onJobError, onJobCancelled,
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
}) {
  const running = busy || !!jobId;
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--pulso-border)", paddingTop: 14, marginTop: 4 }}>
        <button
          className="pulso-primary"
          onClick={onGenerate}
          disabled={running || !!disabled}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Play size={14} /> {running ? "Generando…" : label}
        </button>
        {disabled && disabledHint && (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            {disabledHint}
          </span>
        )}
        {fileId && (
          <a
            href={downloadUrl(fileId)}
            style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Download size={13} /> {downloadName}
          </a>
        )}
      </div>
      {jobId && onJobDone && onJobError && onJobCancelled && (
        <JobProgress<FileJobResult>
          label={label}
          jobId={jobId}
          onDone={onJobDone}
          onError={onJobError}
          onCancelled={onJobCancelled}
        />
      )}
      {error && <Alert kind="error">{error}</Alert>}
    </>
  );
}
