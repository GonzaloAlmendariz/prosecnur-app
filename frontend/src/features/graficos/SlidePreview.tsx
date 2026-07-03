import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Download, Eye, Image as ImageIcon, Loader2, RefreshCw, X } from "lucide-react";
import {
  apiGraficosPreviewRenderer,
  apiGraficosPreviewSlide,
  GraficosPreviewRendererStatus,
  GraficadorRef,
  PreviewImage,
  Slide,
  SlideRenderedPreview,
  downloadUrl,
} from "../../api/client";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { humanizeIdentifier } from "./graficadorDisplay";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "./store";
import SlidePreviewMockup from "./SlidePreviewMockup";

type Props = {
  slide: Slide;
  prepOk: boolean;
  compact?: boolean;
};

function hashSlide(slide: Slide, visualConfigHash: string): string {
  return JSON.stringify({ tipo: slide.tipo, payload: slide.payload, visualConfigHash });
}

let rendererStatusRequest: Promise<GraficosPreviewRendererStatus> | null = null;
function getRendererStatus() {
  if (!rendererStatusRequest) {
    rendererStatusRequest = apiGraficosPreviewRenderer().catch((error) => {
      rendererStatusRequest = null;
      throw error;
    });
  }
  return rendererStatusRequest;
}

export function SlidePreview({ slide, prepOk, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [slidePreview, setSlidePreview] = useState<SlideRenderedPreview | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [rendererStatus, setRendererStatus] = useState<GraficosPreviewRendererStatus | null>(null);
  const [rendererStatusChecked, setRendererStatusChecked] = useState(false);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isBubbleRendered, setIsBubbleRendered] = useState(false);
  const [isBubbleClosing, setIsBubbleClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewBubbleRef = useRef<HTMLDivElement>(null);
  const visualConfigHash = usePlanStore((s) => JSON.stringify({
    presets: s.presets,
    debugPh: s.debugPh,
    iconos: s.iconos,
  }));

  const currentHash = hashSlide(slide, visualConfigHash);
  const isStale = fileId !== null && lastHash !== currentHash;

  const preIssues = useMemo(() => preValidateSlide(slide), [slide]);
  const blocked = preIssues.length > 0;
  const rendererChecking = !rendererStatusChecked;
  const rendererAvailable = rendererStatus?.available === true;
  const rendererUnavailable = rendererStatusChecked && !rendererAvailable;
  const hasPreview = !!slidePreview?.png_base64;
  const hasEmbeddedImages = previewImages.length > 0;
  const hasResult = !!fileId && !error;
  const renderFailed = hasResult && !hasPreview && rendererAvailable;
  const hasUsableResult = hasResult && (hasPreview || hasEmbeddedImages || rendererUnavailable || renderFailed);
  const hasLocalFallback = !!error || rendererUnavailable || renderFailed || hasUsableResult;

  useEffect(() => {
    let alive = true;
    getRendererStatus()
      .then((status) => {
        if (!alive) return;
        setRendererStatus(status);
        setRendererStatusChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        setRendererStatus(null);
        setRendererStatusChecked(true);
      });
    return () => { alive = false; };
  }, []);

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
      if (e.key === "Escape") {
        closeBubble();
      }
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
      if (isBubbleOpen) {
        closeBubble();
      } else {
        openBubble();
      }
      return;
    }
    openBubble();
  }

  async function onGenerate() {
    if (blocked || busy || !prepOk) return;
    setBusy(true);
    setError("");
    setPreviewImages([]);
    if (!isBubbleRendered) {
      openBubble();
    }
    try {
      const r = await apiGraficosPreviewSlide(
        slide,
        buildGraficosConfigFromStore(),
        {
          preview_quality: "quick",
          include_images: true,
        },
      );
      setFileId(r.file_id);
      setSlidePreview(r.slide_preview ?? null);
      setPreviewImages(Array.isArray(r.images) ? r.images : []);
      setLastHash(currentHash);
      openBubble();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onActionClick() {
    if (!prepOk) {
      setError("Necesitas completar la fase de preparación de datos antes de previsualizar.");
      openBubble();
      return;
    }
    if (blocked) {
      setError(`Antes de previsualizar: ${preIssues.join(" · ")}`);
      openBubble();
      return;
    }

    const canOpen = !busy && (
      (hasPreview && !isStale && !error) ||
      (hasUsableResult && !isStale)
    );
    if (canOpen) {
      toggleBubble();
      return;
    }
    await onGenerate();
  }

  async function onRefreshClick() {
    if (!prepOk || blocked) {
      if (!prepOk) {
        setError("Necesitas completar la fase de preparación de datos antes de previsualizar.");
      } else {
        setError(`Antes de previsualizar: ${preIssues.join(" · ")}`);
      }
      openBubble();
      return;
    }
    if (busy) return;
    await onGenerate();
  }

  const showRefreshAction = compact && hasResult;

  const previewAspectRatio = previewAspect(slidePreview);
  const frameStyle: CSSProperties | undefined = previewAspectRatio
    ? { aspectRatio: previewAspectRatio }
    : undefined;
  const actionLabel = getActionLabel({
    busy,
    prepOk,
    blocked,
    rendererChecking,
    rendererUnavailable,
    hasPreview,
    hasResult,
    isStale,
    renderFailed,
    error: !!error,
    isBubbleOpen,
  });
  const stateLabel = getStateLabel({
    busy,
    error: !!error,
    prepOk,
    blocked,
    rendererChecking,
    hasPreview,
    isStale,
    rendererUnavailable,
    renderFailed,
    hasResult,
  });
  const chromeTone = busy
    ? "loading"
    : hasPreview && !isStale
      ? "exact"
      : hasLocalFallback
        ? "local"
        : "idle";
  const chromeDetail = hasPreview && !isStale
    ? `Captura PPTX${rendererStatus?.renderer ? ` · ${formatRendererName(rendererStatus.renderer)}` : ""}`
    : error
      ? "Vista de estructura disponible"
      : hasEmbeddedImages
        ? "Imagen interna PPTX"
        : rendererUnavailable || renderFailed || hasResult
          ? "Vista local garantizada"
          : humanizeIdentifier(slide.tipo, "Slide");
  const sourceSteps = getPreviewSourceSteps({
    rendererChecking,
    rendererAvailable,
    rendererUnavailable,
    rendererName: rendererStatus?.renderer ?? "",
    hasPreview: hasPreview && !isStale,
    hasEmbeddedImages,
    hasResult,
    renderFailed,
    error: !!error,
  });

  return (
    <section
      ref={previewRootRef}
      className={`pulso-slide-preview ${compact ? "is-compact" : ""}`}
      aria-label="Preview del slide seleccionado"
    >
      <header className="pulso-slide-preview-head">
        {!compact && (
          <div className="pulso-slide-preview-copy">
            <strong><Eye size={14} /> Previsualizar este slide</strong>
            <span>Renderiza una lámina real desde el PPTX de un solo slide.</span>
          </div>
        )}

        <div className="pulso-slide-preview-controls">
          <button
            type="button"
            className="pulso-primary pulso-slide-preview-action"
            onClick={onActionClick}
            disabled={busy}
            aria-label={
              !prepOk
                ? "Primero prepara los datos en Analítica"
                : blocked
                  ? `Faltan datos: ${preIssues[0]}`
                  : rendererChecking
                    ? "Generar preview mientras se comprueba el motor local"
                    : rendererUnavailable
                    ? "Generar vista local del slide en este equipo"
                    : hasPreview && !isStale && !renderFailed && !error
                      ? "Mostrar/Ocultar preview del slide"
                      : error
                      ? "Reintentar preview exacta; la vista local queda disponible"
                      : "Generar preview exacta del slide"
            }
          >
            {busy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
            {actionLabel}
          </button>
          {showRefreshAction && (
            <button
              type="button"
              className="pulso-gv2-icon-button pulso-slide-preview-refresh"
              onClick={onRefreshClick}
              disabled={busy}
              aria-label="Actualizar preview del slide"
            >
              <RefreshCw size={14} className={busy ? "pulso-spin" : ""} />
            </button>
          )}
        </div>
      </header>

      {!compact && blocked && !error && (
        <PreviewNotice tone="warn">
          <strong>Antes de previsualizar:</strong> {preIssues.join(" · ")}
        </PreviewNotice>
      )}

      {!compact && rendererUnavailable && !error && (
        <PreviewNotice tone="muted">
          <strong>Vista local disponible:</strong> si la captura exacta no está activa en este equipo, Prosecnur mantiene una referencia visual y el PPTX descargable.
        </PreviewNotice>
      )}

      {!compact && !prepOk && (
        <PreviewNotice tone="muted">
          Necesitas correr <strong>Fase 4 {"->"} Preparar datos</strong> antes de generar previews.
        </PreviewNotice>
      )}

      {!compact && error && (
        <PreviewNotice tone="warn">
          <strong>Mostrando vista local.</strong> {humanizePreviewError(error)}
        </PreviewNotice>
      )}

      {isBubbleRendered && typeof document !== "undefined" && createPortal((
        <div
          ref={previewBubbleRef}
          className={[
            "pulso-slide-preview-bubble",
            isBubbleOpen ? "is-open" : "",
            isBubbleClosing ? "is-closing" : "",
            busy ? "is-loading" : "",
            isStale ? "is-stale" : "",
            hasPreview ? "has-image" : "",
          ].filter(Boolean).join(" ")}
          aria-label={stateLabel}
          role="dialog"
          aria-live="polite"
        >
          <div className="pulso-slide-preview-bubble-arrow" />
          <div className="pulso-slide-preview-chrome">
            <span className={`pulso-slide-preview-status is-${chromeTone}`}>
              {busy ? <Loader2 size={13} className="pulso-spin" /> : hasPreview ? <Eye size={13} /> : <ImageIcon size={13} />}
              <span>
                <strong>{stateLabel}</strong>
                <small>{chromeDetail}</small>
              </span>
            </span>
            <span className="pulso-slide-preview-chrome-actions">
              {fileId && !busy && (
                <a href={downloadUrl(fileId)} download="preview.pptx" className="pulso-slide-preview-download">
                  <Download size={12} />
                  PPTX
                </a>
              )}
              <button
                type="button"
                className="pulso-slide-preview-close"
                onClick={closeBubble}
                aria-label="Cerrar preview"
                title="Cerrar preview"
              >
                <X size={13} />
              </button>
            </span>
          </div>
          <div className="pulso-slide-preview-source-rail" aria-label="Ruta de previsualización">
            {sourceSteps.map((step) => (
              <span key={step.key} className={`is-${step.key}`} data-state={step.state}>
                <i aria-hidden="true" />
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            ))}
          </div>
          <div className="pulso-slide-preview-bubble-inner" style={frameStyle}>
            {busy ? (
              <div className="pulso-slide-preview-placeholder">
                <Loader2 size={18} className="pulso-spin" />
                <span>Renderizando PPTX...</span>
              </div>
            ) : hasPreview ? (
              <>
                <img
                  src={slidePreview.png_base64}
                  alt="Preview exacta del slide"
                  className="pulso-slide-preview-img"
                />
              </>
            ) : rendererUnavailable ? (
              <LocalPreviewFallback
                slide={slide}
                title="Vista local lista"
                detail={hasEmbeddedImages ? "Imagen interna extraída del PPTX." : "Referencia visual incluida para revisar composición del slide."}
                images={previewImages}
                fileId={fileId}
              />
            ) : renderFailed ? (
              <LocalPreviewFallback
                slide={slide}
                tone="warn"
                title="Captura no disponible"
                detail={hasEmbeddedImages ? "Usando imagen interna del PPTX como referencia visual." : "El PPTX se generó, pero la captura exacta no devolvió imagen."}
                images={previewImages}
                fileId={fileId}
              />
            ) : hasResult ? (
              <LocalPreviewFallback
                slide={slide}
                title="Vista local disponible"
                detail={hasEmbeddedImages ? "Imagen del gráfico extraída del PPTX." : "Este equipo no tiene captura PPTX exacta disponible."}
                images={previewImages}
                fileId={fileId}
              />
            ) : error ? (
              <LocalPreviewFallback
                slide={slide}
                tone="warn"
                title="Vista local disponible"
                detail={`${humanizePreviewError(error)} La app mantiene esta vista para revisar estructura sin bloquear tu trabajo.`}
                images={previewImages}
                fileId={fileId}
              />
            ) : (
              <div className="pulso-slide-preview-placeholder">
                <Eye size={18} />
                <span>Genera una preview exacta.</span>
              </div>
            )}
            {isStale && (
              <div className="pulso-slide-preview-bubble-stale">
                Desactualizada
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </section>
  );
}

function LocalPreviewFallback({
  slide,
  title,
  detail,
  images = [],
  fileId,
  tone = "info",
}: {
  slide: Slide;
  title: string;
  detail: string;
  images?: PreviewImage[];
  fileId: string | null;
  tone?: "info" | "warn" | "danger";
}) {
  const embeddedImages = images
    .filter((image) => typeof image?.png_base64 === "string" && image.png_base64.startsWith("data:image/"))
    .slice(0, 4);
  const hasImages = embeddedImages.length > 0;
  const badges = [
    hasImages ? "Imagen PPTX" : "Vista local",
    fileId ? "PPTX listo" : "Incluida en Prosecnur",
  ];

  return (
    <div className={`pulso-slide-preview-local is-${tone}`} data-has-images={hasImages}>
      <div className={`pulso-slide-preview-local-frame ${hasImages ? "has-images" : ""}`} aria-hidden="true">
        {hasImages ? (
          <div className="pulso-slide-preview-image-stack" data-count={Math.min(embeddedImages.length, 4)}>
            {embeddedImages.map((image, index) => (
              <img
                key={`${image.filename || "preview-image"}-${index}`}
                src={image.png_base64}
                alt=""
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <SlidePreviewMockup slide={slide} />
        )}
      </div>
      <div className="pulso-slide-preview-local-panel">
        <span className="pulso-slide-preview-local-icon">
          {tone === "danger" ? <AlertCircle size={14} /> : <ImageIcon size={14} />}
        </span>
        <span className="pulso-slide-preview-local-copy">
          <strong>{title}</strong>
          <small>{detail}</small>
          <span className="pulso-slide-preview-local-badges" aria-label="Capacidades del preview local">
            {badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </span>
        </span>
        {fileId && (
          <a href={downloadUrl(fileId)} download="preview.pptx" className="pulso-slide-preview-link">
            Descargar preview.pptx
          </a>
        )}
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

function previewAspect(preview: SlideRenderedPreview | null): string | undefined {
  const width = Number(preview?.width);
  const height = Number(preview?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return `${Math.round(width)} / ${Math.round(height)}`;
}

function getPreviewSourceSteps(state: {
  rendererChecking: boolean;
  rendererAvailable: boolean;
  rendererUnavailable: boolean;
  rendererName: string;
  hasPreview: boolean;
  hasEmbeddedImages: boolean;
  hasResult: boolean;
  renderFailed: boolean;
  error: boolean;
}): Array<{
  key: "exact" | "image" | "local";
  label: string;
  detail: string;
  state: "active" | "ready" | "idle";
}> {
  const exactActive = state.hasPreview;
  const imageActive = !exactActive && state.hasEmbeddedImages;
  const localActive = !exactActive && !imageActive && (
    state.rendererUnavailable ||
    state.renderFailed ||
    state.error ||
    state.hasResult
  );

  return [
    {
      key: "exact",
      label: "PPTX exacto",
      detail: state.rendererChecking
        ? "Comprobando"
        : state.rendererAvailable
          ? formatRendererName(state.rendererName) || "Vista exacta local"
          : "Opcional",
      state: exactActive ? "active" : state.rendererAvailable ? "ready" : "idle",
    },
    {
      key: "image",
      label: "Imagen interna",
      detail: state.hasEmbeddedImages ? "Disponible" : "Si el PPTX la expone",
      state: imageActive ? "active" : state.hasEmbeddedImages ? "ready" : "idle",
    },
    {
      key: "local",
      label: "Vista local",
      detail: "Incluida",
      state: localActive ? "active" : "ready",
    },
  ];
}

function getActionLabel(state: {
  busy: boolean;
  prepOk: boolean;
  blocked: boolean;
  rendererChecking: boolean;
  rendererUnavailable: boolean;
  hasPreview: boolean;
  hasResult: boolean;
  isStale: boolean;
  renderFailed: boolean;
  error: boolean;
  isBubbleOpen: boolean;
}) {
  if (state.busy) return "Generando...";
  if (!state.prepOk) return "Preparar datos";
  if (state.blocked) return "Bloqueado";
  if (state.error) return "Reintentar";
  if (state.rendererChecking && !state.hasPreview && !state.hasResult) return "Previsualizar";
  if (state.rendererUnavailable && !state.hasPreview) {
    if (!state.hasResult) return "Vista local";
    return state.isBubbleOpen ? "Ocultar" : "Vista local";
  }
  if (state.hasPreview && !state.isStale && !state.renderFailed && !state.error) {
    return state.isBubbleOpen ? "Ocultar" : "Previsualizar";
  }
  return "Actualizar";
}

function getStateLabel(state: {
  busy: boolean;
  error: boolean;
  prepOk: boolean;
  blocked: boolean;
  rendererChecking: boolean;
  hasPreview: boolean;
  isStale: boolean;
  rendererUnavailable: boolean;
  renderFailed: boolean;
  hasResult: boolean;
}) {
  if (state.busy) return "Generando preview";
  if (!state.prepOk) return "Datos no preparados";
  if (state.blocked) return "Configuración incompleta";
  if (state.error) return "Vista local disponible";
  if (state.rendererChecking) return "Comprobando motor";
  if (state.hasPreview) return state.isStale ? "Preview desactualizada" : "Preview lista";
  if (state.rendererUnavailable) return state.hasResult ? "Vista local lista" : "Vista local disponible";
  if (state.renderFailed) return "Captura no disponible";
  if (state.hasResult) return "Sin captura disponible";
  return "Sin preview";
}

function formatRendererName(renderer?: string | null): string {
  const normalized = String(renderer ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("artifact")) return "PPTX local";
  if (normalized.includes("libreoffice") || normalized.includes("soffice")) return "LibreOffice local";
  if (normalized.includes("powerpoint")) return "PowerPoint local";
  if (normalized.includes("pptx")) return "PPTX local";
  return "Motor local";
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
    return "La captura exacta tardó demasiado. Intenta de nuevo o simplifica el gráfico.";
  }
  if (/subscript out of bounds|índice fuera|indice fuera|out of bounds/i.test(cleaned)) {
    return "El gráfico no pudo completar esta combinación. Revisa la variable, cruces o escala en Datos; la vista local queda disponible para revisar estructura.";
  }
  if (/variable.*no existe|var.*unknown|variable inv/i.test(cleaned)) {
    return "Una de las variables del gráfico no existe en el instrumento. Revísala en la pestaña Datos.";
  }
  return cleaned || "Algo salió mal al renderizar. Intenta de nuevo.";
}
