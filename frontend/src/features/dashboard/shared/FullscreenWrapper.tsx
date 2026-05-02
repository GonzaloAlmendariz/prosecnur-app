import { Check, Copy, Download, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./fullscreen.css";

// Lazy: html-to-image solo se carga cuando el usuario hace click en Copiar.
// Mantiene el bundle inicial ligero (la lib es ~9 KB gzip pero igual sumás
// solo cuando se usa).
async function captureBlob(panel: HTMLElement): Promise<Blob | null> {
  const plotlyNode = panel.querySelector<HTMLElement>(".dash-plotly-chart");
  if (plotlyNode) {
    try {
      const Plotly = await import("plotly.js-dist-min");
      const rect = plotlyNode.getBoundingClientRect();
      const dataUri = await Plotly.toImage(plotlyNode, {
        format: "png",
        width: Math.max(800, Math.round(rect.width * 2)),
        height: Math.max(600, Math.round(rect.height * 2)),
      });
      const res = await fetch(dataUri);
      return await res.blob();
    } catch {
      // cae al captador DOM
    }
  }
  try {
    const { toBlob } = await import("html-to-image");
    return await toBlob(panel, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      cacheBust: true,
    });
  } catch {
    return null;
  }
}

async function copyOrDownloadBlob(blob: Blob, filename: string): Promise<"copied" | "downloaded"> {
  // Algunos navegadores (Safari, Firefox sin permiso) no soportan
  // ClipboardItem con imágenes — caemos a descarga sin alarmar al usuario.
  try {
    const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (ClipboardItemCtor && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blob })]);
      return "copied";
    }
  } catch {
    // cae a descarga
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

// Patrón hook + scope. El padre obtiene `ctx` con `useFullscreen()` y
// decide DÓNDE va el botón (típicamente en el header de su card,
// FUERA del scope). El scope envuelve solo lo que debe pasar a fullscreen
// (p. ej. el body del chart) — el header con título y selectores queda
// fuera del overlay.
//
// Uso típico (chart-only fullscreen):
//   const fs = useFullscreen();
//   return (
//     <section>
//       <header>
//         <h2>Título</h2>
//         <SegmentedControl />
//         <FullscreenButton ctx={fs} />
//       </header>
//       <FullscreenScope ctx={fs} title="Título">
//         <div className="chart-body">…</div>
//       </FullscreenScope>
//     </section>
//   );

export type FullscreenCtx = {
  maxed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export function useFullscreen(shortcut = "f"): FullscreenCtx {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target?.isContentEditable ?? false);

      if (e.key === "Escape" && maxed) {
        e.preventDefault();
        setMaxed(false);
        return;
      }
      if (
        shortcut &&
        e.altKey &&
        e.key.toLowerCase() === shortcut.toLowerCase() &&
        !inField
      ) {
        e.preventDefault();
        setMaxed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed, shortcut]);

  return {
    maxed,
    open: () => setMaxed(true),
    close: () => setMaxed(false),
    toggle: () => setMaxed((v) => !v),
  };
}

export function FullscreenScope({
  ctx,
  title,
  children,
  className,
}: {
  ctx: FullscreenCtx;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { maxed, close } = ctx;
  const previousFocus = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Estado del botón Copiar — declarado SIEMPRE arriba (Rules of Hooks).
  // Si lo movés debajo del early return, React lanza error #310 al
  // alternar fullscreen on/off.
  const [copyStatus, setCopyStatus] = useState<"idle" | "working" | "copied" | "downloaded" | "error">("idle");

  // Bloquea el scroll del body mientras está fullscreen.
  useEffect(() => {
    if (!maxed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [maxed]);

  // Focus management: al abrir, guarda el foco previo y mueve foco al
  // panel. Al cerrar, restaura el foco previo.
  useEffect(() => {
    if (maxed) {
      previousFocus.current = (document.activeElement as HTMLElement) ?? null;
      const t = window.setTimeout(() => {
        const firstBtn = panelRef.current?.querySelector<HTMLElement>(
          "button, [tabindex]:not([tabindex='-1'])",
        );
        firstBtn?.focus();
      }, 0);
      return () => window.clearTimeout(t);
    } else {
      previousFocus.current?.focus?.();
    }
  }, [maxed]);

  // Focus trap simple: si Tab sale del panel, lo regresa al primero/último.
  useEffect(() => {
    if (!maxed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed]);

  if (!maxed) {
    return <div className={`dash-fs-wrap ${className ?? ""}`}>{children}</div>;
  }

  const handleCopy = async () => {
    if (copyStatus === "working" || !panelRef.current) return;
    setCopyStatus("working");
    const target = panelRef.current.querySelector<HTMLElement>(".dash-fs-body") ?? panelRef.current;
    const blob = await captureBlob(target);
    if (!blob) {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
      return;
    }
    const safeTitle = (title ?? "dashboard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dashboard";
    const filename = `${safeTitle}.png`;
    const result = await copyOrDownloadBlob(blob, filename);
    setCopyStatus(result);
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  return (
    <div className={`dash-fs-wrap is-maxed ${className ?? ""}`}>
      <div
        className="dash-fs-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Vista expandida"}
      >
        <div className="dash-fs-panel" ref={panelRef}>
          <div className="dash-fs-head">
            {title ? <h2 className="dash-fs-title">{title}</h2> : <span />}
            <div className="dash-fs-actions">
              <button
                type="button"
                className={`dash-fs-copy-btn is-${copyStatus}`}
                onClick={handleCopy}
                disabled={copyStatus === "working"}
                title={
                  copyStatus === "copied"
                    ? "Copiado al portapapeles"
                    : copyStatus === "downloaded"
                    ? "Descargado como PNG"
                    : copyStatus === "error"
                    ? "No se pudo copiar"
                    : "Copiar como imagen"
                }
                aria-label="Copiar el gráfico como imagen"
              >
                {copyStatus === "copied" ? (
                  <>
                    <Check size={13} />
                    <span>Copiado</span>
                  </>
                ) : copyStatus === "downloaded" ? (
                  <>
                    <Download size={13} />
                    <span>Descargado</span>
                  </>
                ) : copyStatus === "error" ? (
                  <span>Error</span>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>{copyStatus === "working" ? "Copiando…" : "Copiar"}</span>
                  </>
                )}
              </button>
              <span className="dash-fs-hint" aria-hidden="true">
                Esc para salir
              </span>
              <button
                type="button"
                className="dash-icon-btn"
                onClick={close}
                title="Salir de pantalla completa (Esc)"
                aria-label="Salir de pantalla completa"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>
          <div className="dash-fs-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Botón "Ampliar" reutilizable. Vive donde el padre lo coloque (típicamente
// en el header del card, FUERA del scope).
export function FullscreenButton({
  ctx,
  label = "Ampliar",
}: {
  ctx: FullscreenCtx;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="dash-fs-trigger"
      onClick={ctx.open}
      title="Ampliar (Alt+F)"
      aria-label={`${label} a pantalla completa`}
    >
      <Maximize2 size={13} />
      <span className="dash-fs-trigger-label">{label}</span>
    </button>
  );
}
