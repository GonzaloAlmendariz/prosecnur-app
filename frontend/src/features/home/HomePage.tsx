import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Github,
  Power,
  Sparkles,
  Map as MapIcon,
  Workflow,
  FilePen,
  QrCode,
  LayoutDashboard,
  Activity,
} from "lucide-react";
import { apiShutdown } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ExitDialog } from "./ExitDialog";
import {
  ReleaseNotesDrawer,
  type ReleaseNote,
} from "./ReleaseNotesDrawer";

// Home — menú principal de Prosecnur (handoff: Prosecnur Home.html).
//
// Prosecnur es una suite analítica; el primer módulo construido es
// "Procesamiento de XLSForm" (el flujo de 5 fases clásico). A futuro
// caben otros módulos (hojas de ruta de campo, monitoreo, etc.).
//
// Jerarquía del Home (críticamente importante):
//   1. Hero grande — saludo + nombre app + contexto del estudio.
//   2. Módulos — PROTAGONISTAS ABSOLUTOS. Grid 3×2 (3 columnas × 2 filas)
//      con cards iguales y hover expresivo.
//   3. Footer — atribución, botón de notas (abre drawer), cerrar.
//   4. Drawer lateral derecho — historial completo de release notes.
//
// Los estilos viven en `app/theme.css` con prefijo `.home-*` para
// mantener este archivo limpio y reutilizable.

// ---- Catálogo de módulos --------------------------------------------
type ModuleMeta = {
  slug: string;
  title: string;
  blurb: string;
  icon: typeof Workflow;
  iconBg: string;
  iconFg: string;
  iconBorder: string;
  to?: string; // con `to` → activo; sin → "próximamente"
};

const MODULES: ModuleMeta[] = [
  {
    slug: "editor-xlsform",
    title: "Editor de formularios",
    blurb:
      "Arma un formulario desde cero, importa uno existente para editarlo, o traduce automáticamente un cuestionario de SurveyMonkey.",
    icon: FilePen,
    iconBg: "#f5f3ff",
    iconFg: "#7c3aed",
    iconBorder: "#ddd6fe",
    to: "/editor-xlsform",
  },
  {
    slug: "procesamiento",
    title: "Procesamiento y reportes",
    blurb:
      "Flujo completo: carga de data, validación, codificación de respuestas abiertas, preparación analítica y generación de reportes PPT/Word.",
    icon: Workflow,
    iconBg: "var(--pulso-primary-soft)",
    iconFg: "var(--pulso-primary)",
    iconBorder: "var(--pulso-primary-border)",
    to: "/procesamiento",
  },
  {
    slug: "dashboard",
    title: "Dashboard interactivo",
    blurb:
      "Explorador interactivo del cuestionario: Resumen por sección, Relaciones (cruces) y Base de datos. Personaliza logo, paleta y título.",
    icon: LayoutDashboard,
    iconBg: "#eff6ff",
    iconFg: "#1d4ed8",
    iconBorder: "#bfdbfe",
    to: "/tablero",
  },
  {
    slug: "hojas-ruta",
    title: "Hojas de ruta para campo",
    blurb:
      "Hojas de ruta imprimibles para enumeradores: cuotas por conglomerado, rutas de visita y puntos de muestra georeferenciados.",
    icon: MapIcon,
    iconBg: "#ecfdf5",
    iconFg: "#059669",
    iconBorder: "#a7f3d0",
    to: "/hojas-ruta",
  },
  {
    slug: "recopiladores",
    title: "Generador de recopiladores",
    blurb:
      "Genera fichas imprimibles con códigos QR y enlaces personalizados a KoboCollect — una por enumerador, conglomerado o punto de muestreo para autenticar la captura.",
    icon: QrCode,
    iconBg: "#fffbeb",
    iconFg: "#d97706",
    iconBorder: "#fde68a",
    // to: undefined — placeholder "Próximamente"
  },
  {
    slug: "monitoreo",
    title: "Monitoreo de campo",
    blurb:
      "Tablero en vivo del avance de campo: cobertura por enumerador, cuotas restantes y alertas de calidad mientras la encuesta corre.",
    icon: Activity,
    iconBg: "#fef2f2",
    iconFg: "#b91c1c",
    iconBorder: "#fecaca",
    // to: undefined — "Próximamente"
  },
];

// ---- Notas de la versión --------------------------------------------
const RELEASE_NOTES: ReleaseNote[] = [
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
const AUTHOR = {
  name: "Gonzalo Almendáriz",
  github: "https://github.com/gonzaloalmendariz",
};

// ---- Estado del módulo "Procesamiento" ------------------------------
type ModulePhaseState = {
  done: number;
  total: number;
  nextLabel: string | null;
  nextTo: string | null;
};

function useProcesamientoState(): ModulePhaseState {
  const { state } = useSession();
  const phases = [
    { to: "/carga",        label: "Carga",         done: !!state?.xlsform && !!state?.data, unlocked: true },
    { to: "/validacion",   label: "Validación",    done: !!state?.auditoria_run,             unlocked: !!state?.xlsform },
    { to: "/codificacion", label: "Codificación",  done: !!state?.codif_aplicado,            unlocked: !!state?.xlsform && !!state?.data },
    { to: "/analitica",    label: "Analítica",     done: !!state?.analitica_prep_ok,         unlocked: !!state?.xlsform && !!state?.data },
    { to: "/graficos",     label: "Gráficos",      done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok, unlocked: !!state?.analitica_prep_ok },
  ];
  const done = phases.filter((p) => p.done).length;
  const next = phases.find((p) => p.unlocked && !p.done) ?? null;
  return {
    done,
    total: phases.length,
    nextLabel: next?.label ?? null,
    nextTo: next?.to ?? null,
  };
}

// ---- Saludo según hora del día --------------------------------------
function useSaludo(): string {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return "Buenas madrugadas";
    if (h < 13) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);
}

// =====================================================================
// Componente principal
// =====================================================================
export default function HomePage() {
  const { state, version } = useSession();
  const proc = useProcesamientoState();
  const [exitOpen, setExitOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <div className="home-wrap">
      <Hero estudioNombre={state?.estudio_nombre ?? null} />
      <ModulesGrid proc={proc} />
      <HomeFooter
        version={version}
        onClose={() => setExitOpen(true)}
        onOpenNotes={() => setNotesOpen(true)}
      />

      <ReleaseNotesDrawer
        open={notesOpen}
        notes={RELEASE_NOTES}
        onClose={() => setNotesOpen(false)}
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
// Hero — escala del handoff (logo 88px, wordmark 56px)
// =====================================================================
function Hero({ estudioNombre }: { estudioNombre: string | null }) {
  const saludo = useSaludo();
  return (
    <header className="home-hero">
      <HeroLogo />
      <div className="home-hero-body">
        <span className="home-hero-eyebrow">
          {saludo} · Suite analítica para estudios con XLSForm
        </span>
        <h1 className="home-hero-wordmark">Prosecnur</h1>
        {estudioNombre && (
          <span className="home-hero-context">
            Trabajando en <strong>"{estudioNombre}"</strong>
          </span>
        )}
      </div>
    </header>
  );
}

function HeroLogo() {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="prosecnur-hero-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--pulso-primary)" />
          <stop offset="100%" stopColor="#013371" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#prosecnur-hero-grad)" />
      <g>
        <rect x="16" y="34" width="6" height="14" rx="1.5" fill="white" opacity="0.95" />
        <rect x="26" y="26" width="6" height="22" rx="1.5" fill="white" opacity="0.85" />
        <rect x="36" y="18" width="6" height="30" rx="1.5" fill="white" opacity="0.75" />
        <rect x="46" y="22" width="6" height="26" rx="1.5" fill="white" opacity="0.65" />
      </g>
    </svg>
  );
}

// =====================================================================
// ModulesGrid — 3×2 con cards de altura igual
// =====================================================================
function ModulesGrid({ proc }: { proc: ModulePhaseState }) {
  return (
    <section aria-label="Módulos de Prosecnur" className="home-modules">
      {MODULES.map((m) => (
        <ModuleCard
          key={m.slug}
          mod={m}
          procState={m.slug === "procesamiento" ? proc : null}
        />
      ))}
    </section>
  );
}

function ModuleCard({
  mod,
  procState,
}: {
  mod: ModuleMeta;
  procState: ModulePhaseState | null;
}) {
  const Icon = mod.icon;
  const isActive = !!mod.to;
  const pct = procState && procState.total > 0 ? procState.done / procState.total : 0;
  const hasProgress = procState && procState.done > 0;

  const ctaLabel = !isActive
    ? "Disponible próximamente"
    : procState && procState.done === procState.total && procState.total > 0
      ? "Revisar resultados"
      : hasProgress && procState?.nextLabel
        ? `Continuar en ${procState.nextLabel}`
        : "Empezar ahora";

  const card = (
    <div className={`home-mod-card ${isActive ? "is-active" : "is-soon"}`}>
      {!isActive && <span className="home-mod-soon-badge">Próximamente</span>}

      <span
        aria-hidden="true"
        className="home-mod-icon"
        style={{
          background: mod.iconBg,
          color: mod.iconFg,
          border: `1px solid ${mod.iconBorder}`,
        }}
      >
        <Icon size={30} strokeWidth={1.8} />
      </span>

      <div className="home-mod-body">
        <h2 className="home-mod-title">{mod.title}</h2>
        <p className="home-mod-blurb">{mod.blurb}</p>
      </div>

      {procState && isActive && (
        <div className={`home-mod-progress ${hasProgress ? "has-progress" : ""}`}>
          <div className="home-mod-progress-head">
            <span className="home-mod-progress-label">
              {procState.done === 0
                ? "Sin empezar"
                : procState.done === procState.total
                  ? "Completado"
                  : `Fase ${procState.done} de ${procState.total}`}
            </span>
            <span className="home-mod-progress-count">
              {procState.done}/{procState.total}
            </span>
          </div>
          <div className="home-mod-progress-bar">
            <div
              className="home-mod-progress-fill"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          {procState.nextLabel && (
            <span className="home-mod-progress-next">
              <Sparkles size={12} />
              Continúa en <strong>{procState.nextLabel}</strong>
            </span>
          )}
        </div>
      )}

      <div className={`home-mod-cta ${isActive ? "is-active" : ""}`}>
        {ctaLabel}
        {isActive && (
          <ArrowRight size={16} className="home-mod-cta-arrow" />
        )}
      </div>
    </div>
  );

  if (!isActive || !mod.to) return card;

  return (
    <Link to={mod.to} className="home-mod-link">
      {card}
    </Link>
  );
}

// =====================================================================
// Footer — versión + autor + abrir notas + cerrar app
// =====================================================================
function HomeFooter({
  version,
  onClose,
  onOpenNotes,
}: {
  version: string;
  onClose: () => void;
  onOpenNotes: () => void;
}) {
  return (
    <footer className="home-footer">
      <div className="home-footer-attr">
        <span>Prosecnur{version && version !== "…" ? ` · ${version}` : ""}</span>
        <span aria-hidden="true">·</span>
        <span>
          Hecho por{" "}
          <a
            href={AUTHOR.github}
            target="_blank"
            rel="noopener noreferrer"
            className="home-footer-author"
            title="Ver el perfil del autor en GitHub"
          >
            {AUTHOR.name}
            <Github size={11} />
          </a>
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="home-footer-notes"
          onClick={onOpenNotes}
        >
          Notas de versión
        </button>
        <button type="button" className="home-footer-quit" onClick={onClose}>
          <Power size={11} /> Cerrar aplicación
        </button>
      </div>
    </footer>
  );
}
