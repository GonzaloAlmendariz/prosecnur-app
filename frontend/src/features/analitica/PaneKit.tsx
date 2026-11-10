import { useState } from "react";
import { ChevronDown, Download, Play } from "../../vendor/lucide-react";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock } from "../../components/States";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import { descargarDelServidor } from "../../components/entregables/entregaArchivo";
import type { BasePerOutput } from "../../api/client";
import type { ReporteRunState } from "./useReporteRun";

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
      {/* C1: los bloques de un grupo (formatos de salida, opciones) son
          secciones independientes, cada una con su alto propio. */}
      <div
        className="analitica-pane-group-body"
        data-qa-geometry-group="analitica/pane-group"
        data-qa-geometry-contract="intrinsic"
      >
        {children}
      </div>
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
// Pie estandarizado de «Generar» sobre el kit de entregables (ADR 0133, fase
// 4), en forma «bloque»: el botón solo se deshabilita mientras se genera (sin
// spinner ni cambio de rótulo) y debajo, al ancho del pane, el contenedor del
// archivo lleva la espera, el resultado o el fallo. Sin diálogo de guardado:
// el backend ya copió el archivo a `Entregables\<Módulo>` o se descargó;
// «Guardar como…» vive en «Más» del contenedor.
export function GenerateFooter({
  label, run, onGenerate, disabled, disabledHint, error, pie,
  variant = "primary",
}: {
  label: string;
  /** El `useReporteRun` del pane: su generación y, si es multibase, los archivos de cada base. */
  run: Pick<ReporteRunState, "generacion" | "perBase">;
  onGenerate: () => void;
  disabled?: boolean;
  disabledHint?: string;
  /** Un error del pane que no viene de la generación (p. ej. no se pudo leer la configuración). */
  error?: string;
  /** Archivos que salen en la misma corrida (el XLSForm final del libro de códigos), al pie del archivo listo. */
  pie?: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const { estado, cerrar } = run.generacion;
  const running = estado.fase === "en_curso";
  const porBase = run.perBase.length > 1 ? run.perBase : [];
  const alPie = porBase.length > 0 || pie
    ? <>{porBase.length > 0 && <ArchivosPorBase bases={porBase} />}{pie}</>
    : undefined;

  return (
    <>
      <div className="analitica-generate-footer">
        {/* La misma receta que «Generar comparativo»: PulsoButton grande con
            el acento del módulo (resto de P-A5). */}
        <PulsoButton
          variant={variant}
          size="lg"
          onClick={onGenerate}
          disabled={running || !!disabled}
        >
          <Play size={14} aria-hidden="true" />
          {label}
        </PulsoButton>
        {disabled && disabledHint && (
          <span className="analitica-generate-hint">
            {disabledHint}
          </span>
        )}
      </div>

      <ContenedorEntregable
        estado={estado}
        forma="bloque"
        onCerrar={cerrar}
        pie={estado.fase === "lista" ? alPie : undefined}
      />

      {error && <ErrorBlock label="No se pudo generar" detail={error} />}
    </>
  );
}

// Con varias bases el entregable es el ZIP; cada base se puede bajar suelta.
function ArchivosPorBase({ bases }: { bases: BasePerOutput[] }) {
  return (
    <div className="analitica-per-base-list" role="group" aria-label="Archivo de cada base">
      {bases.map((b) => {
        const fileId = b.skipped ? null : b.file_id ?? null;
        if (!fileId) {
          return (
            <span key={b.nombre} title={b.reason ?? undefined} className="analitica-per-base-chip is-skipped">
              {b.nombre}{b.skipped ? " (omitida)" : ""}
            </span>
          );
        }
        return (
          <PulsoButton
            key={b.nombre}
            variant="secondary"
            size="sm"
            className="pulso-entregable-texto"
            title={b.filename}
            onClick={() => descargarDelServidor(fileId, b.filename)}
          >
            <Download size={12} aria-hidden="true" /> {b.nombre}
          </PulsoButton>
        );
      })}
    </div>
  );
}
