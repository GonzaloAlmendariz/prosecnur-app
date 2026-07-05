import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Download, Eye, Loader2, X } from "lucide-react";
import {
  apiGraficosPreviewSlide,
  apiGraficosSlideLayoutPreview,
  downloadUrl,
  GraficadorRef,
  GraficosSlideLayoutPlaceholder,
  GraficosSlideLayoutPreview,
  Slide,
} from "../../api/client";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { graficadorDisplayName, humanizeIdentifier } from "./graficadorDisplay";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS, usePlanStore } from "./store";
import SlidePreviewMockup from "./SlidePreviewMockup";

type Props = {
  slide: Slide;
  prepOk: boolean;
  compact?: boolean;
};

function hashSlide(slide: Slide, visualConfigHash: string): string {
  return JSON.stringify({ id: slide.id, tipo: slide.tipo, payload: slide.payload, visualConfigHash });
}

export function SlidePreview({ slide, prepOk, compact = false }: Props) {
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [lastDownloadHash, setLastDownloadHash] = useState<string | null>(null);
  const [layout, setLayout] = useState<GraficosSlideLayoutPreview | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutError, setLayoutError] = useState("");
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isBubbleRendered, setIsBubbleRendered] = useState(false);
  const [isBubbleClosing, setIsBubbleClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewBubbleRef = useRef<HTMLDivElement>(null);
  const latestHashRef = useRef<string | null>(null);
  const downloadSeqRef = useRef(0);
  const debugPh = usePlanStore((s) => s.debugPh);
  const visualConfigHash = usePlanStore((s) => JSON.stringify({
    presets: s.presets,
    debugPh: s.debugPh,
    iconos: s.iconos,
  }));

  const currentHash = hashSlide(slide, visualConfigHash);
  const downloadFresh = !!fileId && lastDownloadHash === currentHash;
  const preIssues = useMemo(() => preValidateSlide(slide), [slide]);
  const blocked = preIssues.length > 0;
  const placeholders = layout?.placeholders?.filter((ph) => !ph.hidden && hasValidRect(ph)) ?? [];
  const hasTemplateGeometry = layout?.source === "template" && placeholders.length > 0;
  const usesLocalFallback = !hasTemplateGeometry;

  useEffect(() => {
    if (latestHashRef.current === currentHash) return;
    latestHashRef.current = currentHash;
    downloadSeqRef.current += 1;
    setDownloadBusy(false);
    setFileId(null);
    setDownloadError("");
    setLastDownloadHash(null);
  }, [currentHash]);

  useEffect(() => {
    let alive = true;
    setLayoutLoading(true);
    setLayoutError("");
    apiGraficosSlideLayoutPreview(slide.tipo)
      .then((response) => {
        if (!alive) return;
        setLayout(response);
        setLayoutError("");
      })
      .catch((error) => {
        if (!alive) return;
        setLayout(null);
        setLayoutError((error as Error).message);
      })
      .finally(() => {
        if (alive) setLayoutLoading(false);
      });
    return () => { alive = false; };
  }, [slide.tipo]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isBubbleRendered) return;
    function onDocMouseDown(e: MouseEvent) {
      if (
        previewBubbleRef.current &&
        !previewBubbleRef.current.contains(e.target as Node)
      ) {
        closeBubble();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeBubble();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isBubbleRendered]);

  function openBubble() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsBubbleRendered(true);
    setIsBubbleClosing(false);
    requestAnimationFrame(() => setIsBubbleOpen(true));
  }

  function closeBubble() {
    if (!isBubbleRendered) return;
    setIsBubbleOpen(false);
    setIsBubbleClosing(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setIsBubbleRendered(false);
      setIsBubbleClosing(false);
      closeTimerRef.current = null;
    }, 180);
  }

  function toggleBubble() {
    if (isBubbleRendered) {
      if (isBubbleOpen) closeBubble();
      else openBubble();
      return;
    }
    openBubble();
  }

  function triggerDownload(nextFileId: string) {
    if (typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl(nextFileId);
    anchor.download = "lamina-preview.pptx";
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function onDownloadSlide() {
    if (downloadBusy) return;
    if (!prepOk) {
      setDownloadError("Necesitas completar la preparación de datos antes de descargar esta lámina.");
      openBubble();
      return;
    }
    if (blocked) {
      setDownloadError(`Antes de descargar: ${preIssues.join(" · ")}`);
      openBubble();
      return;
    }

    const requestId = downloadSeqRef.current + 1;
    const requestHash = currentHash;
    downloadSeqRef.current = requestId;
    setDownloadBusy(true);
    setDownloadError("");
    openBubble();
    try {
      const response = await apiGraficosPreviewSlide(
        slide,
        buildGraficosConfigFromStore(),
        {
          include_images: false,
          render_slide_preview: false,
        },
      );
      if (downloadSeqRef.current !== requestId || latestHashRef.current !== requestHash) return;
      setFileId(response.file_id);
      setLastDownloadHash(currentHash);
      triggerDownload(response.file_id);
    } catch (error) {
      if (downloadSeqRef.current !== requestId || latestHashRef.current !== requestHash) return;
      setDownloadError((error as Error).message);
    } finally {
      if (downloadSeqRef.current === requestId) setDownloadBusy(false);
    }
  }

  const stateLabel = downloadBusy
    ? "Preparando PPTX"
    : downloadError
      ? "Revisa la descarga"
      : hasTemplateGeometry
        ? "Mostrador de lámina"
        : "Referencia local";
  const chromeDetail = hasTemplateGeometry
    ? `${layout?.layout ?? "Layout PPT"} · bordes de Guías`
    : layoutLoading
      ? "Cargando geometría de plantilla"
      : layoutError
        ? "Usando distribución local"
        : "Distribución local de referencia";
  const previewStyle = {
    "--slide-guide-color": normalizeGuideColor(debugPh?.color),
    "--slide-guide-width": `${normalizeGuideWidth(debugPh?.lwd)}px`,
  } as CSSProperties;

  return (
    <section
      ref={previewRootRef}
      className={`pulso-slide-preview ${compact ? "is-compact" : ""}`}
      aria-label="Preview del slide seleccionado"
    >
      <header className="pulso-slide-preview-head">
        {!compact && (
          <div className="pulso-slide-preview-copy">
            <strong><Eye size={14} /> Mostrador de lámina</strong>
            <span>Revisa placeholders, bordes y distribución sin esperar al backend.</span>
          </div>
        )}

        <div className="pulso-slide-preview-controls">
          <button
            type="button"
            className="pulso-primary pulso-slide-preview-action"
            onClick={toggleBubble}
            aria-label={isBubbleOpen ? "Ocultar mostrador de lámina" : "Ver mostrador de lámina"}
          >
            <Eye size={13} />
            {isBubbleOpen ? "Ocultar" : "Ver lámina"}
          </button>
        </div>
      </header>

      {!compact && blocked && (
        <PreviewNotice tone="warn">
          <strong>Descarga pendiente:</strong> {preIssues.join(" · ")}
        </PreviewNotice>
      )}

      {!compact && !prepOk && (
        <PreviewNotice tone="muted">
          El mostrador local está disponible. Para descargar el PPTX, primero prepara los datos.
        </PreviewNotice>
      )}

      {!compact && downloadError && (
        <PreviewNotice tone="warn">
          <strong>No se pudo descargar.</strong> {humanizePreviewError(downloadError)}
        </PreviewNotice>
      )}

      {isBubbleRendered && typeof document !== "undefined" && createPortal((
        <div
          ref={previewBubbleRef}
          className={[
            "pulso-slide-preview-bubble",
            "is-layout-viewer",
            isBubbleOpen ? "is-open" : "",
            isBubbleClosing ? "is-closing" : "",
            downloadBusy ? "is-loading" : "",
            usesLocalFallback ? "is-reference-local" : "",
          ].filter(Boolean).join(" ")}
          aria-label={stateLabel}
          role="dialog"
          aria-live="polite"
          style={previewStyle}
        >
          <div className="pulso-slide-preview-bubble-arrow" />
          <div className="pulso-slide-preview-chrome">
            <span className={`pulso-slide-preview-status is-${downloadError ? "danger" : hasTemplateGeometry ? "exact" : "local"}`}>
              {downloadBusy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
              <span>
                <strong>{stateLabel}</strong>
                <small>{chromeDetail}</small>
              </span>
            </span>
            <span className="pulso-slide-preview-chrome-actions">
              {downloadFresh && fileId && !downloadBusy && (
                <a href={downloadUrl(fileId)} download="lamina-preview.pptx" className="pulso-slide-preview-download">
                  <Download size={12} />
                  PPTX
                </a>
              )}
              <button
                type="button"
                className="pulso-slide-preview-download"
                onClick={() => void onDownloadSlide()}
                disabled={downloadBusy || !prepOk || blocked}
                title={!prepOk ? "Prepara datos antes de descargar" : blocked ? "Completa los gráficos requeridos antes de descargar" : "Descargar esta lámina como PPTX"}
              >
                {downloadBusy ? <Loader2 size={12} className="pulso-spin" /> : <Download size={12} />}
                Descargar lámina
              </button>
              <button
                type="button"
                className="pulso-slide-preview-close"
                onClick={closeBubble}
                aria-label="Cerrar mostrador"
                title="Cerrar mostrador"
              >
                <X size={13} />
              </button>
            </span>
          </div>

          <div className="pulso-slide-preview-bubble-inner">
            {layoutLoading ? (
              <div className="pulso-slide-preview-placeholder">
                <Loader2 size={18} className="pulso-spin" />
                <span>Cargando distribución...</span>
              </div>
            ) : hasTemplateGeometry ? (
              <SlideLayoutViewer
                slide={slide}
                layout={layout}
                placeholders={placeholders}
              />
            ) : (
              <LocalReferenceViewer
                slide={slide}
                reason={layoutError || layout?.reason || "El backend no devolvió geometría para este tipo de lámina."}
              />
            )}
          </div>

          {(downloadError || blocked || !prepOk) && (
            <div className="pulso-slide-preview-bubble-note">
              <AlertCircle size={13} />
              <span>
                {downloadError
                  ? humanizePreviewError(downloadError)
                  : !prepOk
                    ? "El mostrador local no requiere backend; la descarga sí requiere datos preparados."
                    : `Para descargar: ${preIssues.join(" · ")}`}
              </span>
            </div>
          )}
        </div>
      ), document.body)}
    </section>
  );
}

function SlideLayoutViewer({
  slide,
  layout,
  placeholders,
}: {
  slide: Slide;
  layout: GraficosSlideLayoutPreview | null;
  placeholders: GraficosSlideLayoutPlaceholder[];
}) {
  const aspectRatio = Number(layout?.aspectRatio);
  const frameStyle: CSSProperties = {
    aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? `${aspectRatio}` : "16 / 9",
  };

  return (
    <div className="pulso-slide-preview-layout">
      <div className="pulso-slide-preview-layout-frame" style={frameStyle}>
        {placeholders.map((placeholder) => {
          const value = readPayloadValue(slide, placeholder);
          const assigned = isAssignedValue(value, placeholder.role);
          return (
            <div
              key={`${placeholder.key}-${placeholder.payload_key ?? ""}`}
              className={[
                "pulso-slide-preview-slot",
                `is-${placeholder.role ?? "shape"}`,
                assigned ? "is-filled" : "is-empty",
                Number(placeholder.rect.height) < 0.075 ? "is-small" : "",
              ].join(" ")}
              style={rectStyle(placeholder)}
              title={`${slotDisplayLabel(placeholder)} · ${assigned ? slotValueLabel(value, placeholder.role) : "pendiente"}`}
            >
              <span className="pulso-slide-preview-slot-label">{slotDisplayLabel(placeholder)}</span>
              <span className="pulso-slide-preview-slot-meta">{assigned ? slotValueLabel(value, placeholder.role) : "Pendiente"}</span>
            </div>
          );
        })}
      </div>
      <div className="pulso-slide-preview-layout-caption">
        <strong>{SLIDE_LABELS[slide.tipo] ?? humanizeIdentifier(slide.tipo, "Lámina")}</strong>
        <span>{layout?.layout ?? "Layout PPT"} · {placeholders.length} espacios visibles</span>
      </div>
    </div>
  );
}

function LocalReferenceViewer({ slide, reason }: { slide: Slide; reason: string }) {
  return (
    <div className="pulso-slide-preview-local is-info" data-has-images={false}>
      <div className="pulso-slide-preview-local-frame" aria-hidden="true">
        <SlidePreviewMockup slide={slide} />
      </div>
      <div className="pulso-slide-preview-local-panel">
        <span className="pulso-slide-preview-local-icon"><Eye size={14} /></span>
        <span className="pulso-slide-preview-local-copy">
          <strong>Referencia local</strong>
          <small>{reason}</small>
          <span className="pulso-slide-preview-local-badges" aria-label="Capacidades del preview local">
            <span>Sin renderer</span>
            <span>Instantánea</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function PreviewNotice({ tone, children }: { tone: "warn" | "danger" | "muted"; children: ReactNode }) {
  return (
    <div className={`pulso-slide-preview-notice is-${tone}`}>
      <AlertCircle size={13} />
      <span>{children}</span>
    </div>
  );
}

function hasValidRect(placeholder: GraficosSlideLayoutPlaceholder) {
  const rect = placeholder.rect;
  return !!rect &&
    Number.isFinite(Number(rect.x)) &&
    Number.isFinite(Number(rect.y)) &&
    Number.isFinite(Number(rect.width)) &&
    Number.isFinite(Number(rect.height)) &&
    Number(rect.width) > 0 &&
    Number(rect.height) > 0;
}

function rectStyle(placeholder: GraficosSlideLayoutPlaceholder): CSSProperties {
  const rect = placeholder.rect;
  return {
    left: `${clamp01(Number(rect.x)) * 100}%`,
    top: `${clamp01(Number(rect.y)) * 100}%`,
    width: `${clamp01(Number(rect.width)) * 100}%`,
    height: `${clamp01(Number(rect.height)) * 100}%`,
  };
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function readPayloadValue(slide: Slide, placeholder: GraficosSlideLayoutPlaceholder) {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  const keys = [
    placeholder.payload_key,
    placeholder.key,
    placeholder.key === "title" ? "titulo" : null,
    placeholder.key === "subtitle" ? "subtitulo" : null,
    placeholder.key === "date" ? "fecha" : null,
    placeholder.key === "footer" ? "pie" : null,
    placeholder.key === "plot" ? "grafico" : null,
    placeholder.key === "icon" ? "icono" : null,
  ].filter((key): key is string => typeof key === "string" && key.length > 0);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) return payload[key];
  }
  return undefined;
}

function isAssignedValue(value: unknown, role?: string) {
  if (role === "chart") {
    return isGraficadorRef(value) && typeof value.graficador === "string" && value.graficador.length > 0;
  }
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function isGraficadorRef(value: unknown): value is GraficadorRef {
  return !!value && typeof value === "object" && "graficador" in value;
}

function slotValueLabel(value: unknown, role?: string) {
  if (role === "chart" && isGraficadorRef(value)) {
    return graficadorDisplayName(value.graficador) || humanizeIdentifier(value.graficador, "Gráfico");
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim().length > 28 ? `${value.trim().slice(0, 25)}...` : value.trim();
  }
  if (role === "icon") return "Ícono";
  return "Asignado";
}

function slotDisplayLabel(placeholder: GraficosSlideLayoutPlaceholder) {
  const label = placeholder.payload_key || placeholder.label || placeholder.key;
  const friendly: Record<string, string> = {
    titulo: "Título",
    title: "Título",
    subtitulo: "Subtítulo",
    subtitle: "Subtítulo",
    texto: "Texto",
    text: "Texto",
    subtexto: "Subtexto",
    grafico: "Gráfico",
    izquierda: "Izquierda",
    derecha: "Derecha",
    grafico_1: "Gráfico 1",
    grafico_2: "Gráfico 2",
    superior_izquierda: "Superior izquierda",
    superior_derecha: "Superior derecha",
    inferior_izquierda: "Inferior izquierda",
    inferior_derecha: "Inferior derecha",
    grafico_superior_1: "Superior 1",
    grafico_superior_2: "Superior 2",
    grafico_superior_3: "Superior 3",
    grafico_inferior_1: "Inferior 1",
    grafico_inferior_2: "Inferior 2",
    grafico_inferior_3: "Inferior 3",
    base: "Base",
    pie: "Pie",
    footer: "Pie",
    right_text: "Pie",
    icono: "Ícono",
    icon: "Ícono",
    fecha: "Fecha",
    date: "Fecha",
  };
  return friendly[label] ?? humanizeIdentifier(label, "Espacio");
}

function normalizeGuideColor(value: unknown) {
  const color = typeof value === "string" && value.trim() ? value.trim() : "#0f8b7d";
  return color;
}

function normalizeGuideWidth(value: unknown) {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) return 1.2;
  return Math.max(0.75, Math.min(5, width));
}

function preValidateSlide(slide: Slide): string[] {
  const issues: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined | null;
    const slotLabel = humanizeIdentifier(slot, "gráfico");
    if (!v || !v.graficador) {
      issues.push(`elige un gráfico para ${slotLabel} en la pestaña Datos`);
      continue;
    }
    const args = (v.args ?? {}) as Record<string, unknown>;
    const hasVar = typeof args.var === "string" && args.var.length > 0;
    const hasVars = Array.isArray(args.vars) && (args.vars as unknown[]).length > 0;
    if (!hasVar && !hasVars) {
      issues.push(`configura la variable principal de ${slotLabel} en la pestaña Datos`);
    }
  }
  return issues;
}

function humanizePreviewError(raw: string): string {
  let cleaned = raw.replace(/^\s*\[[A-Z_]+\]\s*/i, "").trim();
  cleaned = cleaned.replace(/^No se pudo generar el preview:\s*/i, "");

  const argMissing = cleaned.match(/argument ['"]?([a-z_]+)['"]?\s+is missing/i);
  if (argMissing) {
    const argName = argMissing[1];
    return `Falta configurar "${argName}" en la pestaña Datos. Es un valor requerido por este tipo de gráfico.`;
  }

  if (/layout requerido|template.*layout|layout.*not found/i.test(cleaned)) {
    return "La plantilla actual no incluye el diseño que este slide necesita. Si usas una plantilla custom, añade ese layout o elige otro tipo de slide.";
  }
  if (/rp_data|rp_inst|prepar.*datos|preparar/i.test(cleaned)) {
    return "Los datos no están listos. Ve a la fase 4 -> Preparar datos y vuelve a intentarlo.";
  }
  if (/timeout|timed out/i.test(cleaned)) {
    return "La descarga tardó demasiado. Intenta de nuevo o simplifica el gráfico.";
  }
  if (/subscript out of bounds|índice fuera|indice fuera|out of bounds/i.test(cleaned)) {
    return "El gráfico no pudo completar esta combinación. Revisa la variable, cruces o escala en Datos.";
  }
  if (/variable.*no existe|var.*unknown|variable inv/i.test(cleaned)) {
    return "Una de las variables del gráfico no existe en el instrumento. Revísala en la pestaña Datos.";
  }
  return cleaned || "Algo salió mal al descargar la lámina.";
}
