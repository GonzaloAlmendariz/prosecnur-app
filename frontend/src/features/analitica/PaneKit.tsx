import { useState } from "react";
import { ChevronDown, ChevronRight, Download, Loader2, Play } from "lucide-react";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { downloadUrl, FileJobResult } from "../../api/client";

// Toolkit compartido por los 5 panes de analítica (Codebook, Bases,
// Frecuencias, Cruces, Enumeradores). Mantiene consistencia visual —
// misma jerarquía tipográfica, mismo estilo de secciones, mismo estilo
// de colapsables, mismo footer "Generar".

// ---- Section wrapper ------------------------------------------------------
// Título + subtítulo explicativo + contenido. Da identidad uniforme a
// cada paso de configuración dentro de un Panel.
export function Section({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string | React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-text)", lineHeight: 1.4 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4, lineHeight: 1.55 }}>
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
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: "var(--pulso-surface)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: "100%", textAlign: "left",
          padding: "9px 12px",
          display: "flex", alignItems: "center", gap: 6,
          background: hover ? "var(--pulso-surface-2)" : "transparent",
          border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
          color: "var(--pulso-text-soft)",
          transition: "background 120ms ease",
        }}
        aria-expanded={open}
      >
        <span style={{ display: "inline-flex", transition: "transform 150ms ease", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDown size={13} />
        </span>
        <span>{title}</span>
        {summary && !open && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11, fontWeight: 500,
              textTransform: "none", letterSpacing: 0,
              color: "var(--pulso-text)",
              maxWidth: "60%",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            padding: "10px 14px 14px",
            background: "white",
            borderTop: "1px solid var(--pulso-border)",
          }}
        >
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
      <div
        style={{
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
          borderTop: "1px solid var(--pulso-border)",
          paddingTop: 14, marginTop: 6,
        }}
      >
        <button
          className="pulso-primary"
          onClick={onGenerate}
          disabled={running || !!disabled}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
            style={{
              fontSize: 12,
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 999,
              color: "var(--pulso-primary)",
              background: "var(--pulso-primary-soft)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <Download size={12} /> {downloadName}
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
