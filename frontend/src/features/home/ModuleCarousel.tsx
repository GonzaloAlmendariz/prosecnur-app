import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES as MODULES,
  homeModuleVars,
  type ProsecnurModuleMeta as ModuleMeta,
} from "../../lib/modules";
import { useLayoutPreset, type LayoutPreset } from "../../lib/layoutPreference";

// Selector cinematográfico de módulos. El click enfoca/mueve tarjetas; el
// detalle del módulo vive siempre visible. En modo selector cada módulo se
// agrega o se quita del proyecto. Luce a casi pantalla completa.

export type ModulePicker = {
  isAdded: (slug: string) => boolean;
  onAdd: (slug: string) => void;
  onRemove: (slug: string) => void;
};

type ModuleMotionDirection = "forward" | "backward";
type CinemaDensity = "compact" | "standard" | "roomy";
type CinemaMetrics = {
  cardWidth: number;
  cardMinHeight: number;
  cardStep: number;
  cardYOffset: number;
  cardRotate: number;
  cardTilt: number;
  scaleDrop: number;
  minScale: number;
  hiddenDistance: number;
  density: CinemaDensity;
};

const DEFAULT_CINEMA_METRICS: CinemaMetrics = {
  cardWidth: 372,
  cardMinHeight: 398,
  cardStep: 236,
  cardYOffset: 10,
  cardRotate: 4.5,
  cardTilt: 10,
  scaleDrop: 0.105,
  minScale: 0.72,
  hiddenDistance: 1,
  density: "roomy",
};

export function ModuleCarousel({ picker }: { picker: ModulePicker }) {
  const [layoutPreset] = useLayoutPreset();
  const [focusIndex, setFocusIndex] = useState(0);
  const [motionDirection, setMotionDirection] = useState<ModuleMotionDirection>("forward");
  const { deckRef, metrics } = useAdaptiveCinemaMetrics(layoutPreset);
  const focused = MODULES[focusIndex] ?? MODULES[0];
  const FocusIcon = focused.icon;
  const focusedAdded = picker.isAdded(focused.slug);

  const focusedStyle = {
    ...homeModuleVars(focused),
    "--home-card-width": `${metrics.cardWidth}px`,
    "--home-card-min-height": `${metrics.cardMinHeight}px`,
  } as CSSProperties;

  function focusBy(delta: number) {
    setMotionDirection(delta >= 0 ? "forward" : "backward");
    setFocusIndex((current) => wrapIndex(current + delta, MODULES.length));
  }

  function focusModule(index: number) {
    if (index === focusIndex) return;
    const offset = circularOffset(index, focusIndex, MODULES.length);
    setMotionDirection(offset >= 0 ? "forward" : "backward");
    setFocusIndex(index);
  }

  function toggleFocused() {
    if (focusedAdded) picker.onRemove(focused.slug);
    else picker.onAdd(focused.slug);
  }

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBy(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBy(1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleFocused();
    }
  }

  return (
    <section
      aria-label="Módulos de Prosecnur"
      className="home-module-stack home-cinema"
      style={focusedStyle}
      data-motion={motionDirection}
      data-density={metrics.density}
      data-layout-preset={layoutPreset}
      data-focused-module={focused.slug}
      onKeyDown={handleDeckKeyDown}
    >
      <div className="home-cinema-stage">
        <div className="home-cinema-deck-wrap">
          <div className="home-cinema-controls" aria-label="Mover tarjetas">
            <button
              type="button"
              className="home-cinema-arrow"
              onClick={() => focusBy(-1)}
              aria-label="Módulo anterior"
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="home-cinema-arrow"
              onClick={() => focusBy(1)}
              aria-label="Módulo siguiente"
            >
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div ref={deckRef} className="home-cinema-deck" aria-live="polite">
            {MODULES.map((mod, index) => {
              const Icon = mod.icon;
              const offset = circularOffset(index, focusIndex, MODULES.length);
              const distance = Math.abs(offset);
              const hidden = distance > metrics.hiddenDistance;
              const added = picker.isAdded(mod.slug);
              const cardStyle = {
                ...homeModuleVars(mod),
                "--card-x": `${offset * metrics.cardStep}px`,
                "--card-y": `${distance * metrics.cardYOffset}px`,
                "--card-rotate": `${offset * -metrics.cardRotate}deg`,
                "--card-tilt": `${offset * -metrics.cardTilt}deg`,
                "--card-scale": `${Math.max(metrics.minScale, 1 - distance * metrics.scaleDrop)}`,
                "--card-opacity": hidden ? "0" : "1",
                "--card-z": `${80 - distance}`,
              } as CSSProperties;

              return (
                <button
                  key={mod.slug}
                  type="button"
                  className={[
                    "home-cinema-card",
                    index === focusIndex ? "is-focused" : "",
                    hidden ? "is-hidden" : "",
                    "is-active",
                  ].filter(Boolean).join(" ")}
                  style={cardStyle}
                  onClick={() => focusModule(index)}
                  aria-pressed={index === focusIndex}
                  aria-label={`${mod.title}: ${mod.tagline}`}
                >
                  <span className="home-cinema-card-glow" aria-hidden="true" />
                  {added && (
                    <span
                      className={`home-cinema-card-added${index === focusIndex ? " is-pill" : ""}`}
                      aria-hidden="true"
                    >
                      <Check size={11} strokeWidth={3} />
                      {index === focusIndex && <em>En el proyecto</em>}
                    </span>
                  )}
                  <span className="home-cinema-card-icon" aria-hidden="true">
                    <Icon size={40} strokeWidth={1.65} />
                  </span>
                  <span className="home-cinema-card-title">{mod.title}</span>
                  <span className="home-cinema-card-tagline">{mod.tagline}</span>
                  <span className="home-cinema-card-blurb">{mod.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside
          key={focused.slug}
          className="home-cinema-panel"
          aria-label={`Detalle: ${focused.title}`}
        >
          <div className="home-cinema-panel-top">
            <span className="home-cinema-panel-icon" aria-hidden="true">
              <FocusIcon size={34} strokeWidth={1.7} />
            </span>
          </div>
          <h3>{focused.title}</h3>
          <p className="home-cinema-panel-tagline">{focused.tagline}</p>
          <p className="home-cinema-panel-blurb">{focused.blurb}</p>
          <ul className="home-cinema-feature-list">
            {focused.features.slice(0, 5).map((feature) => (
              <li key={feature}>
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {focusedAdded ? (
            <div className="home-cinema-picker-actions">
              <span className="home-cinema-added-badge">
                <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                En el proyecto
              </span>
              <button
                type="button"
                className="home-cinema-cta-secondary"
                onClick={() => picker.onRemove(focused.slug)}
              >
                <Minus size={13} strokeWidth={2.4} aria-hidden="true" />
                Quitar
              </button>
            </div>
          ) : (
            <button type="button" className="home-cinema-cta" onClick={() => picker.onAdd(focused.slug)}>
              Agregar al proyecto
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          )}
        </aside>
      </div>

      <div className="home-cinema-strip" aria-label="Ir a un módulo">
        {MODULES.map((mod, index) => {
          const Icon = mod.icon;
          const added = picker.isAdded(mod.slug);
          return (
            <button
              key={mod.slug}
              type="button"
              className={`home-cinema-dot ${index === focusIndex ? "is-current" : ""}${added ? " is-added" : ""}`}
              style={{ ...homeModuleVars(mod) } as CSSProperties}
              onClick={() => focusModule(index)}
              aria-label={`Ver ${mod.title}`}
              aria-current={index === focusIndex ? "true" : undefined}
            >
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{mod.shortLabel}</span>
              {added && <span className="home-cinema-dot-check" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function circularOffset(index: number, focusIndex: number, length: number): number {
  let offset = index - focusIndex;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
}

function useAdaptiveCinemaMetrics(layoutPreset: LayoutPreset) {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<CinemaMetrics>(DEFAULT_CINEMA_METRICS);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;

    let frame = 0;
    const update = () => {
      const rect = deck.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = computeCinemaMetrics(rect.width, rect.height, layoutPreset);
      setMetrics((current) => (sameCinemaMetrics(current, next) ? current : next));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(deck);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      observer?.disconnect();
    };
  }, [layoutPreset]);

  return { deckRef, metrics };
}

function computeCinemaMetrics(
  width: number,
  height: number,
  layoutPreset: LayoutPreset,
): CinemaMetrics {
  const presetShort = layoutPreset === "short";
  const presetCompact =
    layoutPreset === "portable-compact" ||
    layoutPreset === "compact" ||
    presetShort;
  const presetRoomy = layoutPreset === "large";
  const presetBalanced = layoutPreset === "portable";
  const crampedHeight = height < (presetShort ? 250 : 220) && width < 620;
  const shortDeck = height < (presetShort ? 350 : presetRoomy ? 360 : 335) || presetShort;
  const tallDeck = height >= 560 && width >= 680;
  const compact = presetCompact || width < 500 || crampedHeight || shortDeck;
  const roomy = !compact && (presetRoomy || tallDeck || (width > 640 && height > 365));
  const density: CinemaDensity = compact ? "compact" : roomy ? "roomy" : "standard";
  const widthFactor = compact ? 0.64 : presetRoomy ? 0.54 : presetBalanced ? 0.52 : tallDeck ? 0.51 : 0.48;
  const cardWidthMax = compact
    ? presetShort ? 316 : 334
    : presetRoomy ? 456 : tallDeck ? 420 : roomy ? 380 : 340;
  const cardWidth = Math.round(clamp(
    width * widthFactor,
    compact ? 216 : 276,
    cardWidthMax,
  ));
  const cardMinHeight = Math.round(
    crampedHeight
      ? clamp(height - 16, 126, 220)
      : shortDeck
      ? clamp(height - (presetShort ? 34 : 24), 180, presetShort ? 226 : 258)
      : clamp(
          height - (compact ? 28 : presetRoomy ? 72 : tallDeck ? 86 : 30),
          compact ? 248 : 292,
          presetRoomy ? 520 : tallDeck ? 470 : roomy ? 390 : 326,
        ),
  );
  const cardStep = Math.round(clamp(
    width * (presetShort ? 0.22 : compact ? 0.28 : presetRoomy ? 0.35 : tallDeck ? 0.33 : 0.31),
    presetShort ? 84 : compact ? 96 : 148,
    compact ? (presetShort ? 112 : 170) : presetRoomy ? 312 : tallDeck ? 286 : roomy ? 246 : 194,
  ));
  const cardYOffset = Math.round(clamp(height * 0.024, compact ? 4 : 7, tallDeck ? 16 : 12));

  return {
    cardWidth,
    cardMinHeight,
    cardStep,
    cardYOffset,
    cardRotate: compact ? 2.2 : tallDeck ? 4.6 : roomy ? 4.2 : 3.4,
    cardTilt: compact ? 4 : tallDeck ? 10 : roomy ? 9 : 7,
    scaleDrop: compact ? 0.092 : roomy ? 0.1 : 0.095,
    minScale: compact ? 0.76 : 0.72,
    hiddenDistance: 1,
    density,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sameCinemaMetrics(a: CinemaMetrics, b: CinemaMetrics): boolean {
  return (
    a.cardWidth === b.cardWidth &&
    a.cardMinHeight === b.cardMinHeight &&
    a.cardStep === b.cardStep &&
    a.cardYOffset === b.cardYOffset &&
    a.cardRotate === b.cardRotate &&
    a.cardTilt === b.cardTilt &&
    a.scaleDrop === b.scaleDrop &&
    a.minScale === b.minScale &&
    a.hiddenDistance === b.hiddenDistance &&
    a.density === b.density
  );
}
