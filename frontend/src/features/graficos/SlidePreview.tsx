import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, Eye, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import {
  apiGraficosPreviewRenderer,
  apiGraficosPreviewSlide,
  GraficosPreviewRendererStatus,
  GraficadorRef,
  Slide,
  SlideRenderedPreview,
  downloadUrl,
} from "../../api/client";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "./store";

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
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [rendererStatus, setRendererStatus] = useState<GraficosPreviewRendererStatus | null>(null);
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
  const rendererUnavailable = rendererStatus?.available === false;
  const hasPreview = !!slidePreview?.png_base64;
  const hasResult = !!fileId && !error;
  const renderFailed = hasResult && !hasPreview && rendererStatus?.available === true;
  const hasUsableResult = hasResult && (hasPreview || rendererUnavailable || renderFailed);

  useEffect(() => {
    let alive = true;
    getRendererStatus()
      .then((status) => { if (alive) setRendererStatus(status); })
      .catch(() => { if (alive) setRendererStatus(null); });
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
    if (!isBubbleRendered) {
      openBubble();
    }
    try {
      const r = await apiGraficosPreviewSlide(
        slide,
        buildGraficosConfigFromStore(),
        {
          preview_quality: "quick",
          include_images: false,
        },
      );
      setFileId(r.file_id);
      setSlidePreview(r.slide_preview ?? null);
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
  const stateLabel = getStateLabel({
    busy,
    error: !!error,
    prepOk,
    blocked,
    hasPreview,
    isStale,
    rendererUnavailable,
    renderFailed,
    hasResult,
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
              : rendererUnavailable
                    ? "No hay renderer headless configurado para generar la captura inline"
                    : hasPreview && !isStale && !renderFailed && !error
                      ? "Mostrar/Ocultar preview del slide"
                      : "Generar preview exacta del slide"
            }
          >
            {busy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
              {busy
                ? "Generando..."
                : !prepOk
                  ? "Preparar datos"
                  : blocked
                    ? "Bloqueado"
                    : hasPreview && !isStale && !renderFailed && !error
                  ? isBubbleOpen
                    ? "Ocultar"
                    : "Previsualizar"
                  : "Actualizar"}
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
          <strong>Sin renderizador headless:</strong> configura LibreOffice/soffice para ver la lámina dentro de la app.
        </PreviewNotice>
      )}

      {!compact && !prepOk && (
        <PreviewNotice tone="muted">
          Necesitas correr <strong>Fase 4 {"->"} Preparar datos</strong> antes de generar previews.
        </PreviewNotice>
      )}

      {!compact && error && (
        <PreviewNotice tone="danger">
          <strong>No pudimos generar la previsualización.</strong> {humanizePreviewError(error)}
        </PreviewNotice>
      )}

      {isBubbleRendered && (
        <div
          ref={previewBubbleRef}
          className={[
            "pulso-slide-preview-bubble",
            isBubbleOpen ? "is-open" : "",
            isBubbleClosing ? "is-closing" : "",
            busy ? "is-loading" : "",
            error ? "is-error" : "",
            isStale ? "is-stale" : "",
            hasPreview ? "has-image" : "",
          ].filter(Boolean).join(" ")}
          aria-label={stateLabel}
          role="dialog"
          aria-live="polite"
        >
          <div className="pulso-slide-preview-bubble-arrow" />
          <div className="pulso-slide-preview-bubble-inner" style={frameStyle}>
            {busy ? (
              <div className="pulso-slide-preview-placeholder">
                <Loader2 size={18} className="pulso-spin" />
                <span>Renderizando PPTX...</span>
              </div>
            ) : hasPreview ? (
              <img
                src={slidePreview.png_base64}
                alt="Preview exacta del slide"
                className="pulso-slide-preview-img"
              />
            ) : rendererUnavailable ? (
              <div className="pulso-slide-preview-placeholder">
                <ImageIcon size={18} />
                <span>Sin renderizador headless.</span>
                <small>Configura LibreOffice/soffice para activar la captura inline.</small>
                {fileId && (
                  <a href={downloadUrl(fileId)} download="preview.pptx" className="pulso-slide-preview-link">
                    Descargar preview.pptx
                  </a>
                )}
              </div>
            ) : renderFailed ? (
              <div className="pulso-slide-preview-placeholder">
                <AlertCircle size={18} />
                <span>No se pudo crear la captura.</span>
                <small>El PPTX se generó, pero el renderer no devolvió imagen.</small>
                {fileId && (
                  <a href={downloadUrl(fileId)} download="preview.pptx" className="pulso-slide-preview-link">
                    Descargar preview.pptx
                  </a>
                )}
              </div>
            ) : hasResult ? (
              <div className="pulso-slide-preview-placeholder">
                <ImageIcon size={18} />
                <span>No hay captura disponible.</span>
                <small>No se encontró un renderer headless de PPTX en este equipo.</small>
                <a href={downloadUrl(fileId)} download="preview.pptx" className="pulso-slide-preview-link">
                  Descargar preview.pptx
                </a>
              </div>
            ) : error ? (
              <div className="pulso-slide-preview-placeholder">
                <AlertCircle size={18} />
                <span>No se pudo generar la previsualización.</span>
                <small>{humanizePreviewError(error)}</small>
              </div>
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
      )}
    </section>
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

function getStateLabel(state: {
  busy: boolean;
  error: boolean;
  prepOk: boolean;
  blocked: boolean;
  hasPreview: boolean;
  isStale: boolean;
  rendererUnavailable: boolean;
  renderFailed: boolean;
  hasResult: boolean;
}) {
  if (state.busy) return "Generando preview";
  if (state.error) return "Error de preview";
  if (!state.prepOk) return "Datos no preparados";
  if (state.blocked) return "Configuración incompleta";
  if (state.hasPreview) return state.isStale ? "Preview desactualizada" : "Preview lista";
  if (state.rendererUnavailable) return "Sin renderizador";
  if (state.renderFailed) return "Captura no disponible";
  if (state.hasResult) return "Sin captura disponible";
  return "Sin preview";
}

function preValidateSlide(slide: Slide): string[] {
  const issues: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined | null;
    if (!v || !v.graficador) {
      issues.push(`elige un gráfico para "${slot}" en la pestaña Datos`);
      continue;
    }
    const args = (v.args ?? {}) as Record<string, unknown>;
    const hasVar = typeof args.var === "string" && args.var.length > 0;
    const hasVars = Array.isArray(args.vars) && (args.vars as unknown[]).length > 0;
    if (!hasVar && !hasVars) {
      issues.push(`configura la variable principal del gráfico "${slot}" en la pestaña Datos`);
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
    return "El renderer tardó demasiado. Intenta de nuevo o simplifica el gráfico.";
  }
  if (/variable.*no existe|var.*unknown|variable inv/i.test(cleaned)) {
    return "Una de las variables del gráfico no existe en el instrumento. Revísala en la pestaña Datos.";
  }
  return cleaned || "Algo salió mal al renderizar. Intenta de nuevo.";
}
