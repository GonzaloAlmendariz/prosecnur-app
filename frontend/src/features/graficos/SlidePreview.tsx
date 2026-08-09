import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { AlertCircle, Download, Eye, Loader2, X } from "lucide-react";
import {
  apiGraficosPreviewSlide,
  downloadUrl,
  GraficadorMetadata,
  GraficadorRef,
  GraficosSlideLayoutRegion,
  Slide,
  SlideRenderedPreview,
} from "../../api/client";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { graficadorDisplayName, humanizeIdentifier } from "./graficadorDisplay";
import { graficadorToPresetType } from "./graficadorPresetMap";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS, usePlanStore } from "./store";
import SlidePreviewMockup from "./SlidePreviewMockup";
import {
  slideCompositionRegionSignature,
  type SlideComposition,
} from "./slideCompositionModel";
import { chartDataPreflightIssue } from "./slidePreviewModel";
import {
  slideCompositionIdentityFromScopeRules,
  slideCompositionRevision,
  useSlideCompositions,
} from "./useSlideCompositions";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { usePresetsDefaults } from "./usePresetsDefaults";
import { parseGraficosReportScope } from "./reportScope";
import { SlideCompositionRegions } from "./v2/timeline/SlidePickerBlueprint";

type Props = {
  slide: Slide;
  prepOk: boolean;
  compact?: boolean;
};

function hashSlide(slide: Slide, visualConfigHash: string): string {
  return JSON.stringify({ id: slide.id, tipo: slide.tipo, payload: slide.payload, visualConfigHash });
}

export function SlidePreview({ slide, prepOk, compact = false }: Props) {
  const location = useLocation();
  const reportScope = parseGraficosReportScope(location.search);
  const canPreview = reportScope === "consolidated" || prepOk;
  const [previewBusy, setPreviewBusy] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [renderedPreview, setRenderedPreview] = useState<SlideRenderedPreview | null>(null);
  const [lastPreviewHash, setLastPreviewHash] = useState<string | null>(null);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [isBubbleRendered, setIsBubbleRendered] = useState(false);
  const [isBubbleClosing, setIsBubbleClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewBubbleRef = useRef<HTMLDivElement>(null);
  const latestHashRef = useRef<string | null>(null);
  const previewSeqRef = useRef(0);
  const previewInFlightRef = useRef<string | null>(null);
  const debugPh = usePlanStore((s) => s.debugPh);
  const userPresets = usePlanStore((s) => s.presets);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const compositionRevision = usePlanStore(slideCompositionRevision);
  const {
    registry,
    graficadoresById,
    loading: registryLoading,
    error: registryError,
  } = useGraficosRegistry();
  const { presets: presetsDefaults } = usePresetsDefaults();
  const visualConfigHash = usePlanStore((s) => JSON.stringify({
    presets: s.presets,
    debugPh: s.debugPh,
    iconos: s.iconos,
    identity: pickPresentationIdentity(s.scopeRules.global),
  }));
  const compositionIdentity = useMemo(
    () => ({
      ...slideCompositionIdentityFromScopeRules(scopeRules),
      scope: reportScope,
    }),
    [reportScope, scopeRules],
  );
  const compositionState = useSlideCompositions(
    registry?.slides ?? [],
    compositionIdentity,
    compositionRevision,
  );
  const compositionResolution = compositionState.compositions[slide.tipo];
  const composition = compositionResolution?.status === "ready"
    ? compositionResolution.composition
    : null;
  const compositionDiagnostic = compositionResolution?.status === "fallback"
    ? compositionResolution.diagnostic
    : null;

  const currentHash = hashSlide(slide, `${reportScope}:${visualConfigHash}`);
  const previewFresh = lastPreviewHash === currentHash;
  const downloadFresh = !!fileId && previewFresh;
  const hasRenderedPreview = !!renderedPreview && previewFresh;
  const preIssues = useMemo(
    () => preValidateSlide(slide, graficadoresById),
    [graficadoresById, slide],
  );
  const blocked = preIssues.length > 0;
  const visibleRegions = composition?.regions.filter((region) => region.visible) ?? [];
  const hasEffectiveComposition = !!composition && visibleRegions.length > 0;
  const layoutLoading = registryLoading || compositionState.loading;
  const layoutError = compositionState.error
    || registryError
    || compositionDiagnostic?.message
    || "";
  const usesLocalFallback = !hasRenderedPreview && !hasEffectiveComposition;

  useEffect(() => {
    if (latestHashRef.current === currentHash) return;
    latestHashRef.current = currentHash;
    previewSeqRef.current += 1;
    previewInFlightRef.current = null;
    setPreviewBusy(false);
    setFileId(null);
    setPreviewError("");
    setRenderedPreview(null);
    setLastPreviewHash(null);
  }, [currentHash]);

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

  useEffect(() => {
    if (!isBubbleOpen || !canPreview || blocked) return;
    void requestRealPreview();
    // La solicitud se deduplica por `currentHash`; solo se reintenta cuando
    // cambia la lámina, su estilo o la identidad de la plantilla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBubbleOpen, currentHash, canPreview, blocked]);

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

  async function requestRealPreview() {
    if (previewInFlightRef.current === currentHash || previewFresh) return;
    if (!canPreview) {
      setPreviewError("Necesitas completar la preparación de datos para generar la vista real de esta lámina.");
      return;
    }
    if (blocked) {
      setPreviewError(`Antes de generar la vista: ${preIssues.join(" · ")}`);
      return;
    }

    const requestId = previewSeqRef.current + 1;
    const requestHash = currentHash;
    previewSeqRef.current = requestId;
    previewInFlightRef.current = requestHash;
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const response = await apiGraficosPreviewSlide(
        slide,
        buildGraficosConfigFromStore(),
        {
          include_images: false,
          render_slide_preview: true,
          ...(reportScope === "consolidated" ? { scope: "consolidated" as const } : {}),
        },
      );
      if (previewSeqRef.current !== requestId || latestHashRef.current !== requestHash) return;
      setFileId(response.file_id);
      setRenderedPreview(response.slide_preview ?? null);
      setLastPreviewHash(requestHash);
    } catch (error) {
      if (previewSeqRef.current !== requestId || latestHashRef.current !== requestHash) return;
      setPreviewError((error as Error).message);
    } finally {
      if (previewInFlightRef.current === requestHash) previewInFlightRef.current = null;
      if (previewSeqRef.current === requestId) setPreviewBusy(false);
    }
  }

  const stateLabel = previewBusy
    ? "Generando vista real"
    : hasRenderedPreview
      ? "Vista de la lámina"
      : previewError
        ? "Vista de referencia"
        : hasEffectiveComposition
          ? "Mostrador de lámina"
          : "Referencia local";
  const chromeDetail = hasRenderedPreview
    ? `Render completo · ${renderedPreview?.renderer || "motor PPT"}`
    : hasEffectiveComposition
      ? `${composition?.layout ?? "Layout PPT"} · geometría efectiva`
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
            <span>Abre la vista completa del motor PPT; si no está disponible, conserva la referencia de distribución.</span>
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
          <strong>Vista completa pendiente:</strong> {preIssues.join(" · ")}
        </PreviewNotice>
      )}

      {!compact && !canPreview && (
        <PreviewNotice tone="muted">
          La referencia local está disponible. Para generar la vista completa, primero prepara los datos.
        </PreviewNotice>
      )}

      {!compact && previewError && (
        <PreviewNotice tone="warn">
          <strong>No se pudo generar la vista real.</strong> {humanizePreviewError(previewError)}
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
            previewBusy ? "is-loading" : "",
            hasRenderedPreview ? "has-rendered-preview" : "",
            usesLocalFallback ? "is-reference-local" : "",
          ].filter(Boolean).join(" ")}
          aria-label={stateLabel}
          role="dialog"
          aria-live="polite"
          aria-busy={previewBusy}
          style={previewStyle}
        >
          <div className="pulso-slide-preview-bubble-arrow" />
          <div className="pulso-slide-preview-chrome">
            <span className={`pulso-slide-preview-status is-${previewError ? "danger" : hasRenderedPreview || hasEffectiveComposition ? "exact" : "local"}`}>
              {previewBusy ? <Loader2 size={13} className="pulso-spin" /> : <Eye size={13} />}
              <span>
                <strong>{stateLabel}</strong>
                <small>{chromeDetail}</small>
              </span>
            </span>
            <span className="pulso-slide-preview-chrome-actions">
              {downloadFresh && fileId && !previewBusy ? (
                <a href={downloadUrl(fileId)} download="lamina-preview.pptx" className="pulso-slide-preview-download">
                  <Download size={12} />
                  Descargar lámina
                </a>
              ) : (
                <button
                  type="button"
                  className="pulso-slide-preview-download"
                  onClick={() => void requestRealPreview()}
                  disabled={previewBusy || !canPreview || blocked}
                  title={!canPreview ? "Prepara datos antes de generar la vista" : blocked ? "Completa los gráficos requeridos antes de generar la vista" : "Generar de nuevo la vista real"}
                >
                  {previewBusy ? <Loader2 size={12} className="pulso-spin" /> : <Eye size={12} />}
                  {previewBusy ? "Generando vista" : "Generar vista"}
                </button>
              )}
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
            {hasRenderedPreview && renderedPreview ? (
              <RenderedSlideViewer preview={renderedPreview} slide={slide} />
            ) : layoutLoading ? (
              <div className="pulso-slide-preview-placeholder">
                <Loader2 size={18} className="pulso-spin" />
                <span>Cargando distribución de referencia...</span>
              </div>
            ) : hasEffectiveComposition && composition ? (
              <SlideLayoutViewer
                slide={slide}
                composition={composition}
                userPresets={userPresets}
                presetsDefaults={presetsDefaults}
                graficadoresById={graficadoresById}
              />
            ) : (
              <LocalReferenceViewer
                slide={slide}
                reason={layoutError || "El backend no devolvió una composición efectiva para este tipo de lámina."}
              />
            )}
            {previewBusy && (
              <div className="pulso-slide-preview-render-loading" role="status">
                <span><Loader2 size={15} className="pulso-spin" /> Generando la vista completa…</span>
              </div>
            )}
          </div>

          {(previewError || layoutError || blocked || !canPreview) && (
            <div className="pulso-slide-preview-bubble-note">
              <AlertCircle size={13} />
              <span>
                {previewError
                  ? `${humanizePreviewError(previewError)} Se mantiene la referencia de distribución.`
                  : layoutError
                    ? `${layoutError} Se mantiene la referencia nominal.`
                  : !canPreview
                    ? "La referencia local está disponible; la vista completa requiere datos preparados."
                    : `Para generar la vista: ${preIssues.join(" · ")}`}
              </span>
            </div>
          )}
        </div>
      ), document.body)}
    </section>
  );
}

function RenderedSlideViewer({ preview, slide }: { preview: SlideRenderedPreview; slide: Slide }) {
  const width = Number(preview.width);
  const height = Number(preview.height);
  const frameStyle: CSSProperties = {
    aspectRatio: Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? `${width} / ${height}`
      : "16 / 9",
  };
  const src = preview.png_base64.startsWith("data:")
    ? preview.png_base64
    : `data:image/png;base64,${preview.png_base64}`;

  return (
    <div className="pulso-slide-preview-rendered">
      <div className="pulso-slide-preview-rendered-frame" style={frameStyle}>
        <img
          src={src}
          alt={`Vista completa de ${String(slide.payload?.titulo || SLIDE_LABELS[slide.tipo] || "la lámina")}`}
        />
      </div>
      <div className="pulso-slide-preview-layout-caption">
        <strong>{SLIDE_LABELS[slide.tipo] ?? humanizeIdentifier(slide.tipo, "Lámina")}</strong>
        <span>Vista generada por {preview.renderer || "el motor PPT"}</span>
      </div>
    </div>
  );
}

export function SlideLayoutViewer({
  slide,
  composition,
  userPresets,
  presetsDefaults,
  graficadoresById = {},
}: {
  slide: Slide;
  composition: SlideComposition;
  userPresets: PresetArgsMap;
  presetsDefaults: PresetArgsMap;
  graficadoresById?: Readonly<Record<string, GraficadorMetadata | undefined>>;
}) {
  const frameStyle: CSSProperties = {
    aspectRatio: String(composition.aspectRatio),
  };
  const visibleRegionCount = composition.regions.filter((region) => region.visible).length;

  return (
    <div
      className="pulso-slide-preview-layout"
      data-composition-regions={slideCompositionRegionSignature(composition)}
      data-composition-fingerprint={composition.template.fingerprint}
    >
      <div className="pulso-slide-preview-layout-frame" style={frameStyle}>
        <SlideCompositionRegions
          composition={composition}
          className="pulso-slide-preview-composition-regions"
          regionClassName={(region) => {
            const value = readPayloadValue(slide, region);
            const assigned = isAssignedValue(value, region.role);
            const chartLayout = assigned && region.role === "chart" && isGraficadorRef(value)
              ? buildChartMicroLayout(
                value,
                userPresets,
                presetsDefaults,
                graficadoresById[value.graficador],
              )
              : null;
            return [
                "pulso-slide-preview-slot",
                assigned ? "is-filled" : "is-empty",
                chartLayout ? "has-chart-layout" : "",
                region.rect.height < 0.075 ? "is-small" : "",
              ].filter(Boolean).join(" ");
          }}
          regionTitle={(region) => {
            const value = readPayloadValue(slide, region);
            const assigned = isAssignedValue(value, region.role);
            return `${slotDisplayLabel(region)} · ${assigned ? slotValueLabel(value, region.role) : "pendiente"}`;
          }}
          renderRegion={(region) => {
            const value = readPayloadValue(slide, region);
            const assigned = isAssignedValue(value, region.role);
            const chartLayout = assigned && region.role === "chart" && isGraficadorRef(value)
              ? buildChartMicroLayout(
                value,
                userPresets,
                presetsDefaults,
                graficadoresById[value.graficador],
              )
              : null;
            return (
              <>
                <span className="pulso-slide-preview-slot-label">{slotDisplayLabel(region)}</span>
                {chartLayout && <ChartMicroLayout spec={chartLayout} />}
                <span className="pulso-slide-preview-slot-meta">
                  {assigned ? slotValueLabel(value, region.role) : "Pendiente"}
                </span>
              </>
            );
          }}
        />
      </div>
      <div className="pulso-slide-preview-layout-caption">
        <strong>{SLIDE_LABELS[slide.tipo] ?? humanizeIdentifier(slide.tipo, "Lámina")}</strong>
        <span>{composition.layout} · {visibleRegionCount} espacios visibles</span>
      </div>
    </div>
  );
}

type PresetArgsMap = Record<string, Record<string, unknown>>;

type ChartMicroSegment = {
  key: "group" | "buffer-group" | "labels" | "buffer-labels" | "bars" | "buffer-extra" | "extra";
  label: string;
  value: number;
  tone: "muted" | "labels" | "bars" | "extra" | "group";
};

type ChartMicroLayoutSpec = {
  presetType: string;
  segments: ChartMicroSegment[];
  total: number;
};

const BAR_CANVAS_PRESETS = new Set(["barras_apiladas", "multi_apiladas", "barras_agrupadas"]);
const BAR_CANVAS_KEYS = [
  "canvas_w_grupo",
  "canvas_w_buf_grupo_etq",
  "canvas_w_etiquetas",
  "canvas_w_buf_etq_bars",
  "canvas_w_bars",
  "canvas_w_buf_bars_extra",
  "canvas_w_extra",
  "mostrar_barra_extra",
];

const BAR_CANVAS_DEFAULTS: PresetArgsMap = {
  barras_apiladas: {
    canvas_w_grupo: 0,
    canvas_w_buf_grupo_etq: 0,
    canvas_w_etiquetas: 0.18,
    canvas_w_buf_etq_bars: 0.03,
    canvas_w_bars: 0.54,
    canvas_w_buf_bars_extra: 0.02,
    canvas_w_extra: 0.12,
    mostrar_barra_extra: true,
  },
  multi_apiladas: {
    canvas_w_grupo: 0,
    canvas_w_buf_grupo_etq: 0,
    canvas_w_etiquetas: 0.36,
    canvas_w_buf_etq_bars: 0.05,
    canvas_w_bars: 0.46,
    canvas_w_buf_bars_extra: 0,
    canvas_w_extra: 0.10,
    mostrar_barra_extra: true,
  },
  barras_agrupadas: {
    canvas_w_grupo: 0,
    canvas_w_buf_grupo_etq: 0,
    canvas_w_etiquetas: 0.45,
    canvas_w_buf_etq_bars: 0.03,
    canvas_w_bars: 0.52,
    canvas_w_buf_bars_extra: 0,
    canvas_w_extra: 0,
    mostrar_barra_extra: false,
  },
};

function ChartMicroLayout({ spec }: { spec: ChartMicroLayoutSpec }) {
  return (
    <div
      className="pulso-slide-preview-graph-layout"
      aria-label={`Distribución interna del gráfico: ${spec.segments.map((s) => s.label).join(", ")}`}
    >
      {spec.segments.map((segment) => {
        const pct = spec.total > 0 ? Math.round((segment.value / spec.total) * 100) : 0;
        return (
          <span
            key={segment.key}
            className={[
              "pulso-slide-preview-graph-segment",
              `is-${segment.tone}`,
              segment.key.startsWith("buffer") ? "is-buffer" : "",
            ].filter(Boolean).join(" ")}
            style={{ flexGrow: Math.max(segment.value, 0.006) }}
            title={`${segment.label}: ${pct}% del canvas interno`}
          >
            <span className="pulso-slide-preview-graph-mark" aria-hidden="true" />
            <span className="pulso-slide-preview-graph-segment-label">{segment.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function buildChartMicroLayout(
  value: GraficadorRef,
  userPresets: PresetArgsMap,
  presetsDefaults: PresetArgsMap,
  metadata: GraficadorMetadata | undefined,
): ChartMicroLayoutSpec | null {
  const presetType = graficadorToPresetType(value.graficador, metadata?.preset_key);
  if (!presetType || !BAR_CANVAS_PRESETS.has(presetType)) return null;

  const args = asRecord(value.args);
  const merged = {
    ...(BAR_CANVAS_DEFAULTS[presetType] ?? {}),
    ...normalizePresetArgs(presetsDefaults[presetType]),
    ...normalizePresetArgs(userPresets[presetType]),
    ...pickCanvasArgs(args),
    ...pickCanvasArgs(asRecord(args.overrides)),
  };

  const rawExtra = readPositiveNumber(merged.canvas_w_extra);
  const showExtra = readBoolean(merged.mostrar_barra_extra, rawExtra > 0);
  const rawSegments: ChartMicroSegment[] = [
    { key: "group", label: "Grupo", value: readPositiveNumber(merged.canvas_w_grupo), tone: "group" },
    { key: "buffer-group", label: "Buffer", value: readPositiveNumber(merged.canvas_w_buf_grupo_etq), tone: "muted" },
    { key: "labels", label: "Etiquetas", value: readPositiveNumber(merged.canvas_w_etiquetas), tone: "labels" },
    { key: "buffer-labels", label: "Buffer", value: readPositiveNumber(merged.canvas_w_buf_etq_bars), tone: "muted" },
    { key: "bars", label: "Barras", value: readPositiveNumber(merged.canvas_w_bars), tone: "bars" },
    { key: "buffer-extra", label: "Buffer", value: readPositiveNumber(merged.canvas_w_buf_bars_extra), tone: "muted" },
    { key: "extra", label: showExtra ? "Barra extra" : "Reserva", value: rawExtra, tone: "extra" },
  ];
  const segments = rawSegments.filter((segment) => segment.value > 0.001);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0 || segments.length < 2) return null;
  return { presetType, segments, total };
}

function normalizePresetArgs(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const nestedArgs = asRecord(record.args);
  return Object.keys(nestedArgs).length > 0 ? nestedArgs : record;
}

function pickCanvasArgs(value: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of BAR_CANVAS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) picked[key] = value[key];
  }
  return picked;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function pickPresentationIdentity(value: unknown) {
  const global = asRecord(value);
  const read = (key: string) => {
    const field = global[key];
    return typeof field === "string" && field.trim() ? field : undefined;
  };
  return {
    profile_id: read("profile_id"),
    template_id: read("template_id"),
    acnur_mode: read("acnur_mode"),
    report_scope: read("report_scope"),
    meta: Object.keys(asRecord(global.meta)).length > 0 ? asRecord(global.meta) : undefined,
  };
}

function readPositiveNumber(value: unknown) {
  const next = typeof value === "string" && value.trim() !== "" ? Number(value) : Number(value);
  if (!Number.isFinite(next) || next <= 0) return 0;
  return Math.min(next, 1);
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
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

function readPayloadValue(slide: Slide, region: GraficosSlideLayoutRegion) {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  return payload[region.payload_key];
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

function slotDisplayLabel(region: GraficosSlideLayoutRegion) {
  return humanizeIdentifier(region.payload_key, "Espacio");
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

function preValidateSlide(
  slide: Slide,
  graficadoresById: Readonly<Record<string, GraficadorMetadata | undefined>>,
): string[] {
  const issues: string[] = [];
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  for (const slot of slots) {
    const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined | null;
    const slotLabel = humanizeIdentifier(slot, "gráfico");
    if (!v || !v.graficador) {
      issues.push(`elige un gráfico para ${slotLabel} en la pestaña Datos`);
      continue;
    }
    const dataIssue = chartDataPreflightIssue(
      v.args ?? {},
      graficadoresById[v.graficador],
    );
    if (dataIssue) issues.push(`${slotLabel}: ${dataIssue}`);
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
    return "La vista tardó demasiado. Intenta de nuevo o simplifica el gráfico.";
  }
  if (/subscript out of bounds|índice fuera|indice fuera|out of bounds/i.test(cleaned)) {
    return "El gráfico no pudo completar esta combinación. Revisa la variable, cruces o escala en Datos.";
  }
  if (/variable.*no existe|var.*unknown|variable inv/i.test(cleaned)) {
    return "Una de las variables del gráfico no existe en el instrumento. Revísala en la pestaña Datos.";
  }
  return cleaned || "No se pudo generar la vista completa de la lámina.";
}
