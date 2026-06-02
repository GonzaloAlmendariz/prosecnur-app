import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FolderOpen,
  Power,
  Folder,
  Clock,
  Settings2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiShutdown, type SessionState } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import {
  PROSECNUR_MODULES as MODULES,
  homeModuleVars,
  type ProsecnurModuleMeta,
} from "../../lib/modules";
import { useProjectShell } from "../project/ProjectShell";
import type { RecentProject } from "../project/types";
import type { UseProjectReturn } from "../project/useProject";
import { ExitDialog } from "./ExitDialog";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import {
  type ReleaseNote,
} from "./ReleaseNotesDrawer";

// Home — menú principal de Prosecnur.
//
// Los 8 módulos son herramientas independientes (no fases obligatorias
// de un flujo): un usuario puede usar Hojas de Ruta sin haber tocado
// Procesamiento. El layout y el peso visual reflejan esa independencia.
//
// Layout:
//   1. ProjectBar — proyecto activo + recientes en una consola compacta.
//   2. ModulesDeck — carrusel cinematográfico con detalle visible.
//   3. Footer — atribución, notas, cerrar.
//   4. Drawer lateral derecho — historial completo de release notes.
//
// Los estilos viven en `app/theme.css` con prefijo `.home-*`.
// El motion reusa los tokens centralizados (--motion-dur-*, --motion-ease-out).

export type ModuleMeta = ProsecnurModuleMeta;

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
  cardWidth: 344,
  cardMinHeight: 342,
  cardStep: 220,
  cardYOffset: 10,
  cardRotate: 4.5,
  cardTilt: 10,
  scaleDrop: 0.105,
  minScale: 0.72,
  hiddenDistance: 1,
  density: "roomy",
};

// ---- Notas de la versión --------------------------------------------
const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.3",
    date: "2026-06-02",
    highlights: [
      "Arquitectura canonica: guia principal y ADRs para app local, formato .pulso, secretos fuera del proyecto, modulos por dominio, integraciones salientes y auditoria reproducible.",
      "Auditoria canonica: nuevo proyecto .pulso sintetico, comandos Make y smoke de Electron para diagnosticar regresiones con capturas, sid, puerto y checksum aislados.",
      "Conexiones: Ajustes centraliza SurveyMonkey y Kobo, guarda claves fuera del .pulso, soporta perfiles SurveyMonkey y solo expone mascaras al frontend.",
      "Multibase y monitoreo: mejor importacion de familias SurveyMonkey, bases hermanas independientes, sincronizacion de fuentes, seleccion de base activa y motores mas defensivos.",
      "Home y shell: nuevo deck de modulos, Ajustes con notas/creditos/conexiones, catalogo de modulos compartido y estados de proyecto mas claros.",
      "Calidad del release: mas pruebas frontend/R para cliente API, carga multibase, codificacion, analitica, persistencia .pulso, secretos y auditoria.",
    ],
  },
  {
    version: "0.14",
    date: "2026-05-03",
    highlights: [
      "Nuevo módulo Hojas de ruta: valida columnas de campo, arma cuotas por UMP, previsualiza mapas faltantes y genera un ZIP con PDFs listos para impresión.",
      "Editor XLSForm + SurveyMonkey: importación API-only más fiel, matrices y opciones “Otro” mejor interpretadas, lógica avanzada aplicable al formulario actual y nuevo asistente visual de saltos.",
      "Gráficos: inspector V2 reorganizado, controles visuales para colores por serie y criterios, presets Word sin JSON crudo, auto-layout/canvas más estable y leyendas configurables arriba/abajo/lados.",
      "Analítica: frecuencias y cruces ganan opciones para ocultar títulos/secciones, mejor manejo de categorías y select_multiple, filtros nombrados más robustos y UI de configuración más clara.",
      "Carga y normalización: aliases q→p, padding de opciones y reconstrucción de select_multiple se muestran en la vista previa; columnas extra quedan identificadas.",
      "Codificación y validación: textos abiertos independientes se pueden recodificar, la base adaptada alimenta Analítica automáticamente y las reglas/preview toleran mejor labels, fechas, regex y expresiones select_multiple.",
    ],
  },
  {
    version: "0.13",
    date: "2026-05-02",
    highlights: [
      "Independencia entre proyectos: fix de fuga de estado al cambiar de .pulso (Dashboard/Analítica/Gráficos/Wizard de Dimensiones se resetean al cambiar sid).",
      "StartModal rediseñado: solo Nuevo proyecto + Abrir proyecto + lista de Recientes con papelera (no borra el archivo, solo lo quita de la lista).",
      "Modo navegador desbloqueado: abrir/crear .pulso por path manual sin Electron.",
      "Editor de XLSForms: el export se guarda automáticamente en la carpeta del proyecto en vez de ~/Downloads.",
      "Home: grid de módulos 3×2 con sexto slot reservado.",
      "Fix Limpieza y normalización: el endpoint ya no se cae con E_INTERNAL al serializar evaluacion_final.",
      "Fix Codificación: preview de respuestas con un solo elemento ya no rompe la UI.",
      "Fix bootstrap: la app adopta el .pulso preload aunque jsonlite serialice NULL como `{}`.",
    ],
  },
  {
    version: "0.12",
    date: "2026-04-28",
    highlights: [
      "Dashboard exporta como HTML autosuficiente con WebR (R en el navegador, sin servidor).",
      "Bridge WebR para modo standalone: cómputo R nativo dentro del .html exportado.",
    ],
  },
  {
    version: "0.11",
    date: "2026-04-28",
    highlights: [
      "Dashboard: vista previa, paleta UI, recodificación por variable, override de vars.",
      "Revamp UX: toolbar afuera del canvas, marca con múltiples logos, sidebar Dimensiones rediseñado.",
      "Vista FODA Lectura como modo pedagógico.",
      "Avances en analítica/dimensiones, gráficos v2 y router del proyecto en R API.",
    ],
  },
  {
    version: "0.10",
    date: "2026-04-27",
    highlights: [
      "Dashboard fullscreen transversal, con skeleton de filtros y tests del semáforo.",
      "Barras h/v/facet, radar polygonal con modos/animado, FODA polish.",
      "Semáforo configurable, leyendas centradas, IterStepper, % fuera de barra.",
      "Chip rectangular al final de cada barra, FODA legacy preservado.",
      "Plotly como un solo chunk compartido (~4.6 MB) entre features.",
      "SessionChip resiliente a sessionId no-string + setter defensivo.",
    ],
  },
  {
    version: "0.9",
    date: "2026-04-26",
    highlights: [
      "Dashboard /tablero independiente, con paletas y reglas de diseño Emil aplicadas.",
      "Pestañas Relaciones y Base de datos con persistencia en el .pulso.",
      "Pestaña Dimensiones con heatmap semáforo, radar y barras.",
      "FODA scatter flotante + barras ordenadas con chip semáforo.",
      "Pasada de fidelidad al legacy reporte_interactivo.",
      "Curaduría preservada al reabrir un .pulso.",
    ],
  },
  {
    version: "0.8",
    date: "2026-04-21",
    highlights: [
      "Home rediseñado como menú de módulos — Prosecnur como suite multi-propósito.",
      "Notas de versión integradas con historial colapsable.",
      "Confirmación al cerrar la app para no perder progreso.",
    ],
  },
  {
    version: "0.7",
    date: "2026-04-20",
    highlights: [
      "Sistema de diseño unificado: tokens de status, primitivos compartidos, sin hex hardcoded en Fases 3/4/5.",
      "Color picker integrado en presets con paletas del estudio.",
      "Textos en negrita con multi-select de chips.",
      "Hot-reload del engine R sin reiniciar el proceso.",
    ],
  },
  {
    version: "0.6",
    date: "2026-04-18",
    highlights: [
      "Overrides defaults persistentes simétricos a presets defaults.",
      "DefaultsModal accesible desde el engranaje de Configuración global.",
    ],
  },
];

// ---- Atribución ------------------------------------------------------
const PULSO_FULL_NAME =
  "Instituto de Analítica Social e Inteligencia Estratégica de la Pontificia Universidad Católica del Perú (PULSO PUCP)";

// ---- Estado del módulo "Procesamiento" ------------------------------
type ModulePhaseState = {
  done: number;
  total: number;
};

function useProcesamientoState(): ModulePhaseState {
  const { state } = useSession();
  const phases = [
    { done: !!state?.xlsform && !!state?.data },
    { done: !!state?.auditoria_run },
    { done: !!state?.codif_aplicado },
    { done: !!state?.analitica_prep_ok },
    { done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok },
  ];
  let done = 0;
  for (const phase of phases) {
    if (!phase.done) break;
    done += 1;
  }
  return { done, total: phases.length };
}

// ---- Mini-estado por módulo (solo cuando aplique) -------------------
function computeMeta(
  slug: string,
  state: SessionState | null,
  proc: ModulePhaseState,
): string | null {
  switch (slug) {
    case "editor-xlsform":
      return null;
    case "procesamiento":
      return proc.done > 0 ? `${proc.done}/${proc.total} fases` : null;
    case "dashboard":
      return state?.xlsform && state?.data ? "Listo para explorar" : null;
    case "hojas-ruta":
      return state?.hojas_ruta_ok ? "Lista generada" : null;
    case "calc-muestra":
      return null;
    case "recopiladores":
      return "Próximamente";
    case "monitoreo":
      return null;
    default:
      return null;
  }
}

// =====================================================================
// Componente principal
// =====================================================================
export default function HomePage() {
  const { state, version } = useSession();
  const { project } = useProjectShell();
  const proc = useProcesamientoState();
  const [exitOpen, setExitOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="home-wrap">
      <ProjectBar project={project} />
      <ModulesGrid state={state} proc={proc} />
      <HomeFooter
        version={version}
        onClose={() => setExitOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <GlobalSettingsDialog
        open={settingsOpen}
        notes={RELEASE_NOTES}
        pulsoName={PULSO_FULL_NAME}
        onClose={() => setSettingsOpen(false)}
      />

      {exitOpen && (
        <ExitDialog
          onCancel={() => setExitOpen(false)}
          onConfirm={doShutdown}
        />
      )}
    </div>
  );
}

// =====================================================================
// ProjectBar — barra superior con estado del proyecto + recientes
// Reemplaza el StartModal bloqueante: si hay proyecto, muestra info;
// si no hay, muestra CTA con "Nuevo / Abrir". Los recientes viven al
// costado siempre que existan.
// =====================================================================
function ProjectBar({ project }: { project: UseProjectReturn }) {
  const hasProject = project.status.has_project;
  const recents = project.recents.slice(0, 4);

  return (
    <section
      className={`home-projbar ${recents.length > 0 ? "has-recents" : ""}`}
      aria-label="Proyecto y recientes"
    >
      {hasProject ? (
        <ActiveProjectCard project={project} />
      ) : (
        <StartProjectCard project={project} />
      )}
      {recents.length > 0 && (
        <RecentsList recents={recents} project={project} />
      )}
    </section>
  );
}

function ActiveProjectCard({ project }: { project: UseProjectReturn }) {
  const { name, last_saved_at, dirty } = project.status;
  const savedLabel = useMemo(() => {
    if (dirty) return "Cambios sin guardar";
    if (!last_saved_at) return "Listo para trabajar";
    return `Guardado ${formatRelative(last_saved_at)}`;
  }, [dirty, last_saved_at]);
  const dotClass = dirty ? "is-dirty" : last_saved_at ? "is-saved" : "";

  return (
    <div className="home-proj-card is-active">
      <div className="home-proj-icon" aria-hidden="true">
        <Folder size={22} strokeWidth={1.8} />
      </div>
      <div className="home-proj-body">
        <span className="home-proj-name">{name ?? "Sin nombre"}</span>
        <span className="home-proj-meta">
          <span className={`home-proj-meta-dot ${dotClass}`} aria-hidden="true" />
          {savedLabel}
        </span>
      </div>
      <div className="home-proj-actions">
        <button
          type="button"
          className="home-proj-btn home-proj-btn--ghost"
          onClick={() => void project.open()}
          disabled={project.busy}
        >
          <FolderOpen size={14} />
          Cambiar
        </button>
        <button
          type="button"
          className="home-proj-btn home-proj-btn--primary"
          onClick={() => void project.newProject()}
          disabled={project.busy}
        >
          <FilePlus2 size={14} />
          Nuevo
        </button>
      </div>
    </div>
  );
}

function StartProjectCard({ project }: { project: UseProjectReturn }) {
  return (
    <div className="home-proj-card is-empty">
      <div className="home-proj-icon home-proj-icon--accent" aria-hidden="true">
        <FolderOpen size={22} strokeWidth={1.8} />
      </div>
      <div className="home-proj-body">
        <span className="home-proj-name">Crear o abrir proyecto</span>
        <span className="home-proj-meta">
          Trabaja sobre un archivo <code>.pulso</code> nuevo o existente.
        </span>
      </div>
      <div className="home-proj-actions">
        <button
          type="button"
          className="home-proj-btn home-proj-btn--ghost"
          onClick={() => void project.open()}
          disabled={project.busy}
        >
          <FolderOpen size={14} />
          Abrir
        </button>
        <button
          type="button"
          className="home-proj-btn home-proj-btn--primary"
          onClick={() => void project.newProject()}
          disabled={project.busy}
        >
          <FilePlus2 size={14} />
          Nuevo proyecto
        </button>
      </div>
    </div>
  );
}

function RecentsList({
  recents,
  project,
}: {
  recents: RecentProject[];
  project: UseProjectReturn;
}) {
  return (
    <div className="home-recents">
      <div className="home-recents-head">
        <Clock size={13} strokeWidth={1.8} aria-hidden="true" />
        <span>Proyectos recientes</span>
      </div>
      <ul className="home-recents-list">
        {recents.map((r) => (
          <li key={r.path}>
            <button
              type="button"
              className="home-recent-item"
              onClick={() => void project.open(r.path)}
              disabled={project.busy}
              title={r.path}
            >
              <span className="home-recent-name">{r.name}</span>
              <span className="home-recent-meta">
                {formatRelative(r.opened_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Formato relativo simple en español ("hace 2 horas", "hace 3 días", …).
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "hace un momento";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `hace ${day} ${day === 1 ? "día" : "días"}`;
  const week = Math.round(day / 7);
  if (week < 5) return `hace ${week} ${week === 1 ? "semana" : "semanas"}`;
  const month = Math.round(day / 30);
  if (month < 12) return `hace ${month} ${month === 1 ? "mes" : "meses"}`;
  const year = Math.round(day / 365);
  return `hace ${year} ${year === 1 ? "año" : "años"}`;
}

function doShutdown() {
  apiShutdown()
    .then(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    });
}

// =====================================================================
// ModulesGrid — deck cinematográfico. El click enfoca/mueve tarjetas; el
// detalle del módulo vive siempre visible para no depender de un modal.
// =====================================================================
function ModulesGrid({
  state,
  proc,
}: {
  state: SessionState | null;
  proc: ModulePhaseState;
}) {
  const navigate = useNavigate();
  const [focusIndex, setFocusIndex] = useState(0);
  const [motionDirection, setMotionDirection] = useState<ModuleMotionDirection>("forward");
  const { deckRef, metrics } = useAdaptiveCinemaMetrics();
  const focused = MODULES[focusIndex] ?? MODULES[0];
  const FocusIcon = focused.icon;

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

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBy(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBy(1);
    }
    if (event.key === "Enter" && focused.to) {
      event.preventDefault();
      navigate(focused.to);
    }
  }

  function handleEnterModule() {
    if (focused.to) navigate(focused.to);
  }

  return (
    <section
      aria-label="Módulos de Prosecnur"
      className="home-module-stack home-cinema"
      style={focusedStyle}
      data-motion={motionDirection}
      data-density={metrics.density}
      data-focused-module={focused.slug}
      onKeyDown={handleDeckKeyDown}
    >
      <div className="home-cinema-head">
        <div className="home-cinema-titleblock">
          <span className="home-cinema-eyebrow">Suite de herramientas</span>
          <h2>Explora los módulos de trabajo de Prosecnur</h2>
        </div>
      </div>

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
              const meta = computeMeta(mod.slug, state, proc);
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
                    mod.to ? "is-active" : "is-soon",
                  ].filter(Boolean).join(" ")}
                  style={cardStyle}
                  onClick={() => focusModule(index)}
                  aria-pressed={index === focusIndex}
                  aria-label={`${mod.title}: ${mod.tagline}`}
                >
                  <span className="home-cinema-card-glow" aria-hidden="true" />
                  <span className="home-cinema-card-icon" aria-hidden="true">
                    <Icon size={40} strokeWidth={1.65} />
                  </span>
                  {!mod.to && (
                    <span className="home-cinema-card-kicker">
                      Próximamente
                    </span>
                  )}
                  <span className="home-cinema-card-title">{mod.title}</span>
                  <span className="home-cinema-card-tagline">{mod.tagline}</span>
                  <span className="home-cinema-card-blurb">{mod.blurb}</span>
                  {meta && <span className="home-cinema-card-meta">{meta}</span>}
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
            {!focused.to && <span className="home-cinema-panel-soon">Próximamente</span>}
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
          {focused.to ? (
            <button
              type="button"
              className="home-cinema-cta"
              onClick={handleEnterModule}
            >
              Entrar al módulo
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          ) : (
            <div className="home-cinema-soon">
              <span>Próximamente</span>
              <strong>Se activará en una próxima versión.</strong>
            </div>
          )}
        </aside>
      </div>

      <div className="home-cinema-strip" aria-label="Ir a un módulo">
        {MODULES.map((mod, index) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.slug}
              type="button"
              className={`home-cinema-dot ${index === focusIndex ? "is-current" : ""}`}
              style={{
                ...homeModuleVars(mod),
              } as CSSProperties}
              onClick={() => focusModule(index)}
              aria-label={`Ver ${mod.title}`}
              aria-current={index === focusIndex ? "true" : undefined}
            >
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{shortModuleLabel(mod)}</span>
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

function shortModuleLabel(mod: ModuleMeta): string {
  return mod.shortLabel;
}

function useAdaptiveCinemaMetrics() {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<CinemaMetrics>(DEFAULT_CINEMA_METRICS);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;

    let frame = 0;
    const update = () => {
      const rect = deck.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = computeCinemaMetrics(rect.width, rect.height);
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
  }, []);

  return { deckRef, metrics };
}

function computeCinemaMetrics(width: number, height: number): CinemaMetrics {
  const crampedHeight = height < 220 && width < 620;
  const compact = width < 500 || crampedHeight;
  const roomy = width > 640 && height > 365;
  const density: CinemaDensity = compact ? "compact" : roomy ? "roomy" : "standard";
  const cardWidth = Math.round(clamp(width * (compact ? 0.72 : 0.5), compact ? 244 : 276, roomy ? 352 : 326));
  const cardMinHeight = Math.round(
    crampedHeight
      ? clamp(height - 16, 126, 220)
      : clamp(height - (compact ? 22 : 30), compact ? 258 : 292, roomy ? 350 : 326),
  );
  const cardStep = Math.round(clamp(width * (compact ? 0.34 : 0.32), compact ? 116 : 152, roomy ? 224 : 194));
  const cardYOffset = Math.round(clamp(height * 0.026, compact ? 4 : 7, 12));

  return {
    cardWidth,
    cardMinHeight,
    cardStep,
    cardYOffset,
    cardRotate: compact ? 2.8 : roomy ? 4.5 : 3.7,
    cardTilt: compact ? 5.5 : roomy ? 10 : 7.5,
    scaleDrop: compact ? 0.085 : roomy ? 0.105 : 0.095,
    minScale: compact ? 0.78 : 0.72,
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

// =====================================================================
// Footer — versión + autor + abrir notas + cerrar app
// =====================================================================
function HomeFooter({
  version,
  onClose,
  onOpenSettings,
}: {
  version: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <footer className="home-footer">
      <div className="home-footer-attr">
        <span>Prosecnur{version && version !== "…" ? ` · ${version}` : ""}</span>
        <span aria-hidden="true">·</span>
        <span>Hecho para el {PULSO_FULL_NAME}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="home-footer-notes"
          onClick={onOpenSettings}
        >
          <Settings2 size={11} /> Ajustes
        </button>
        <button type="button" className="home-footer-quit" onClick={onClose}>
          <Power size={11} /> Cerrar aplicación
        </button>
      </div>
    </footer>
  );
}
