import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Play } from "lucide-react";
import { JobProgress } from "../../components/JobProgress";
import { ErrorBlock } from "../../components/States";
import { apiSaveFileAs, downloadUrl, FileJobResult } from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";

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
  perBase,
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
        <div
          style={{
            marginTop: 10, padding: "8px 10px",
            borderRadius: 6, background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pulso-text-soft)" }}>
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
