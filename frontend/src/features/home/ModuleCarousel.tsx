import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "../../vendor/lucide-react";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES as MODULES,
  homeModuleVars,
  type ProsecnurModuleMeta as ModuleMeta,
} from "../../lib/modules";
import { useLayoutPreset, type LayoutPreset } from "../../lib/layoutPreference";

// Selector cinematográfico de módulos. El click enfoca/mueve tarjetas; el
// detalle del módulo vive siempre visible. Este panel solo agrega módulos; la
// administración y el retiro viven en las cards del homepage.

export type ModulePicker = {
  isAdded: (slug: string) => boolean;
  onAdd: (slug: string) => void;
};

type ModuleMotionDirection = "forward" | "backward";
type CinemaDensity = "compact" | "standard" | "roomy";
// Coverflow de mazo: los vecinos son cartas con la misma silueta que la ficha
// enfocada, abanicadas con solape (`cardStep` corto + `stepDecay` que comprime
// las cartas del fondo) y profundidad 3D (`tiltBase/tiltStep` de rotateY hacia
// adentro, `zStep` de retroceso, caída de escala/opacidad por distancia).
type CinemaMetrics = {
  cardWidth: number;
  cardMinHeight: number;
  neighborWidth: number;
  cardStep: number;
  stepDecay: number;
  cardYOffset: number;
  zStep: number;
  tiltBase: number;
  tiltStep: number;
  scaleDrop: number;
  minScale: number;
  opacityDrop: number;
  minOpacity: number;
  hiddenDistance: number;
  density: CinemaDensity;
};

const DEFAULT_CINEMA_METRICS: CinemaMetrics = {
  cardWidth: 468,
  cardMinHeight: 452,
  neighborWidth: 292,
  cardStep: 258,
  stepDecay: 0.5,
  cardYOffset: 14,
  zStep: 62,
  tiltBase: 24,
  tiltStep: 9,
  scaleDrop: 0.1,
  minScale: 0.66,
  opacityDrop: 0.12,
  minOpacity: 0.62,
  hiddenDistance: 2,
  density: "roomy",
};

export function ModuleCarousel({ picker }: { picker: ModulePicker }) {
  const [layoutPreset] = useLayoutPreset();
  const [focusIndex, setFocusIndex] = useState(0);
  const [motionDirection, setMotionDirection] = useState<ModuleMotionDirection>("forward");
  const { deckRef, metrics } = useAdaptiveCinemaMetrics(layoutPreset);
  const focused = MODULES[focusIndex] ?? MODULES[0];

  const focusedStyle = {
    ...homeModuleVars(focused),
    "--home-card-width": `${metrics.cardWidth}px`,
    "--home-card-min-height": `${metrics.cardMinHeight}px`,
    "--home-neighbor-width": `${metrics.neighborWidth}px`,
    "--home-neighbor-height": `${Math.round(metrics.neighborWidth * 1.22)}px`,
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

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBy(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBy(1);
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
              const isFocused = index === focusIndex;
              const offset = circularOffset(index, focusIndex, MODULES.length);
              const distance = Math.abs(offset);
              const hidden = distance > metrics.hiddenDistance;
              const added = picker.isAdded(mod.slug);
              // Abanico coverflow: X con solape (`fanExtent` acumula pasos que
              // se comprimen), rotateY hacia adentro creciente, retroceso en Z
              // y caída de escala/opacidad por distancia. El signo lleva la
              // carta al lado correcto y le hace mirar hacia el centro.
              const dir = offset === 0 ? 0 : offset > 0 ? 1 : -1;
              const extent = fanExtent(distance, metrics.cardStep, metrics.stepDecay);
              const tilt = distance === 0 ? 0 : metrics.tiltBase + (distance - 1) * metrics.tiltStep;
              const scale = Math.max(metrics.minScale, 1 - distance * metrics.scaleDrop);
              const opacity = hidden ? 0 : Math.max(metrics.minOpacity, 1 - distance * metrics.opacityDrop);
              const cardStyle = {
                ...homeModuleVars(mod),
                "--card-x": `${dir * extent}px`,
                "--card-y": `${distance * metrics.cardYOffset}px`,
                "--card-depth": `${-distance * metrics.zStep}px`,
                "--card-tilt": `${dir * tilt}deg`,
                "--card-scale": `${scale}`,
                "--card-opacity": `${opacity}`,
                "--card-z": `${80 - distance}`,
              } as CSSProperties;

              const cardClass = [
                "home-cinema-card",
                isFocused ? "is-focused" : "",
                added ? "is-added" : "",
                hidden ? "is-hidden" : "",
                "is-active",
              ].filter(Boolean).join(" ");

              // Vecinos: cartas del mazo (misma silueta que la enfocada) que
              // muestran su cara compacta —sello de ícono en el color del
              // módulo + nombre + tagline en una línea—; clickeables para
              // traerlas al frente.
              if (!isFocused) {
                return (
                  <button
                    key={mod.slug}
                    type="button"
                    className={cardClass}
                    style={cardStyle}
                    onClick={() => focusModule(index)}
                    aria-label={`${mod.title}: ${mod.tagline}`}
                  >
                    <span className="home-cinema-card-glow" aria-hidden="true" />
                    <span className="home-cinema-card-icon" aria-hidden="true">
                      <Icon size={30} strokeWidth={1.65} />
                    </span>
                    <span className="home-cinema-poster-label">{mod.shortLabel ?? mod.title}</span>
                    <span className="home-cinema-poster-tagline">{mod.tagline}</span>
                  </button>
                );
              }

              // Card enfocada: autosuficiente. Toda la información del módulo
              // vive aquí (ícono, nombre, descripción, features y acción); ya no
              // hay panel lateral, así el deck respira a lo ancho.
              return (
                <div
                  key={mod.slug}
                  className={cardClass}
                  style={cardStyle}
                  aria-label={`${mod.title}: ${mod.tagline}`}
                >
                  <span className="home-cinema-card-glow" aria-hidden="true" />
                  <div className="home-cinema-card-head">
                    <span className="home-cinema-card-icon" aria-hidden="true">
                      <Icon size={38} strokeWidth={1.65} />
                    </span>
                    <span className="home-cinema-card-heading">
                      <h3 className="home-cinema-card-name">{mod.title}</h3>
                      <span className="home-cinema-card-tagline">{mod.tagline}</span>
                    </span>
                  </div>
                  <p className="home-cinema-card-blurb">{mod.blurb}</p>
                  <ul className="home-cinema-card-features">
                    {mod.features.slice(0, 5).map((feature) => (
                      <li key={feature}>
                        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {!added && (
                    <button
                      type="button"
                      className="home-cinema-cta"
                      onClick={() => picker.onAdd(mod.slug)}
                    >
                      Agregar al proyecto
                      <ArrowRight size={16} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
              aria-label={`Ver ${mod.title}${added ? ", en el proyecto" : ""}`}
              aria-current={index === focusIndex ? "true" : undefined}
              title={mod.shortLabel ?? mod.title}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
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
  // Solo colapsamos a densidad compacta (tagline/blurb ocultos) en alturas
  // realmente diminutas: con el deck rellenando el stage (fix del recorte), a
  // 640px de ventana el deck mide ~470px y NO debe leerse como "compact".
  const crampedHeight = height < (presetShort ? 240 : 200) && width < 620;
  const shortDeck = height < (presetShort ? 320 : 288) || presetShort;
  const tallDeck = height >= 520 && width >= 680;
  // Deck ancho: hay lienzo de sobra → mostramos ±2 vecinos y una ficha más
  // grande para comunicar amplitud en vez de quedar subpoblado.
  const wideDeck = !presetCompact && width >= 1000 && height >= 380;
  const compact = presetCompact || width < 480 || crampedHeight || shortDeck;
  const roomy = !compact && (presetRoomy || tallDeck || wideDeck || (width > 640 && height > 340));
  const density: CinemaDensity = compact ? "compact" : roomy ? "roomy" : "standard";
  // Ancho de la ficha SIN angostar (features envuelven menos = ficha más baja,
  // evita el roce inferior en poca altura); a ±1 lo saca a la vista el paso
  // largo del abanico, no una ficha más delgada.
  const widthFactor = compact ? 0.64 : presetRoomy ? 0.5 : presetBalanced ? 0.5 : wideDeck ? 0.44 : 0.48;
  // Ficha ~440-520 (un pelo más angosta que antes) para que los vecinos del
  // abanico asomen a los lados en vez de quedar tapados por la ficha.
  const cardWidthMax = compact
    ? presetShort ? 316 : 334
    : wideDeck ? 522 : presetRoomy ? 500 : tallDeck ? 470 : roomy ? 452 : 400;
  const cardWidth = Math.round(clamp(
    width * widthFactor,
    compact ? 216 : 300,
    cardWidthMax,
  ));
  const cardMinHeight = Math.round(
    crampedHeight
      ? clamp(height - 16, 126, 220)
      : shortDeck
      ? clamp(height - (presetShort ? 34 : 24), 180, presetShort ? 226 : 258)
      : clamp(
          height - (compact ? 28 : presetRoomy ? 72 : tallDeck ? 86 : 40),
          compact ? 248 : 300,
          wideDeck ? 560 : presetRoomy ? 540 : tallDeck ? 500 : roomy ? 460 : 360,
        ),
  );
  // Vecinos: cartas con la misma silueta (retrato) que la ficha, un pelo más
  // angostas para que asomen a los lados del enfocado como un mazo.
  const neighborWidth = Math.round(clamp(
    cardWidth * (compact ? 0.62 : 0.6),
    compact ? 188 : 248,
    wideDeck ? 332 : compact ? 260 : 312,
  ));
  // Primer paso del abanico: como la ficha es más ancha que un vecino, el paso
  // debe sacar a ±1 fuera del ancho de la ficha para que muestre su cara (sello
  // + nombre) y no quede tragado; los siguientes se tuckean detrás porque
  // `fanExtent` comprime cada paso con `stepDecay`. Con deck ancho ±3.
  const cardStep = Math.round(clamp(
    cardWidth * (compact ? 0.56 : wideDeck ? 0.68 : 0.72),
    compact ? 146 : wideDeck ? 292 : 268,
    compact ? (presetShort ? 190 : 214) : wideDeck ? 344 : 336,
  ));
  const cardYOffset = Math.round(clamp(height * 0.022, compact ? 6 : 10, tallDeck ? 18 : 15));
  // En compacto angosto sólo cabe ±1 sin recortar; en compacto ancho y en
  // estándar/roomy ±2; con deck ancho ±3 para que el mazo tenga grosor visible.
  const hiddenDistance = compact
    ? (presetShort || width < 520 ? 1 : 2)
    : wideDeck
    ? 3
    : 2;

  return {
    cardWidth,
    cardMinHeight,
    neighborWidth,
    cardStep,
    stepDecay: compact ? 0.52 : wideDeck ? 0.5 : 0.48,
    cardYOffset,
    zStep: compact ? 40 : wideDeck ? 66 : 60,
    tiltBase: compact ? 18 : tallDeck ? 24 : roomy ? 23 : 21,
    tiltStep: compact ? 7 : 9,
    scaleDrop: compact ? 0.11 : 0.1,
    minScale: compact ? 0.7 : wideDeck ? 0.64 : 0.66,
    opacityDrop: compact ? 0.14 : 0.12,
    minOpacity: compact ? 0.7 : 0.62,
    hiddenDistance,
    density,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Extensión horizontal acumulada del abanico: el primer paso es el más largo y
// cada carta adicional aporta menos (multiplicado por `decay`), de modo que las
// cartas del fondo se comprimen contra la más cercana al centro.
function fanExtent(distance: number, step: number, decay: number): number {
  let extent = 0;
  let increment = step;
  for (let i = 0; i < distance; i += 1) {
    extent += increment;
    increment *= decay;
  }
  return Math.round(extent);
}

function sameCinemaMetrics(a: CinemaMetrics, b: CinemaMetrics): boolean {
  return (
    a.cardWidth === b.cardWidth &&
    a.cardMinHeight === b.cardMinHeight &&
    a.neighborWidth === b.neighborWidth &&
    a.cardStep === b.cardStep &&
    a.stepDecay === b.stepDecay &&
    a.cardYOffset === b.cardYOffset &&
    a.zStep === b.zStep &&
    a.tiltBase === b.tiltBase &&
    a.tiltStep === b.tiltStep &&
    a.scaleDrop === b.scaleDrop &&
    a.minScale === b.minScale &&
    a.opacityDrop === b.opacityDrop &&
    a.minOpacity === b.minOpacity &&
    a.hiddenDistance === b.hiddenDistance &&
    a.density === b.density
  );
}
