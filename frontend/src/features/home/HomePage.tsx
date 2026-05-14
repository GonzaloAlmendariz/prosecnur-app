import { useMemo, useState } from "react";
import {
  FilePlus2,
  FolderOpen,
  Github,
  Power,
  Map as MapIcon,
  Workflow,
  FilePen,
  QrCode,
  LayoutDashboard,
  Activity,
  Folder,
  Clock,
} from "lucide-react";
import { IconHero } from "../../lib/icons";
import { apiShutdown, type SessionState } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useProjectShell } from "../project/ProjectShell";
import type { RecentProject } from "../project/types";
import type { UseProjectReturn } from "../project/useProject";
import { ExitDialog } from "./ExitDialog";
import { ModuleDetail } from "./ModuleDetail";
import { ModuleTile } from "./ModuleTile";
import {
  ReleaseNotesDrawer,
  type ReleaseNote,
} from "./ReleaseNotesDrawer";

// Home — menú principal de Prosecnur.
//
// Los 6 módulos son herramientas independientes (no fases obligatorias
// de un flujo): un usuario puede usar Hojas de Ruta sin haber tocado
// Procesamiento. El layout y el peso visual reflejan esa independencia.
//
// Layout:
//   1. Hero compacto — logo mini + wordmark + saludo + contexto.
//   2. ModulesGrid 2×3 — tiles flotantes rounded-square.
//   3. Footer — atribución, notas, cerrar.
//   4. Drawer lateral derecho — historial completo de release notes.
//
// Los estilos viven en `app/theme.css` con prefijo `.home-*`.
// El motion reusa los tokens centralizados (--motion-dur-*, --motion-ease-out).

// ---- Catálogo de módulos --------------------------------------------
export type ModuleMeta = {
  slug: string;
  title: string;
  tagline: string;
  blurb: string;
  features: string[];
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
    tagline: "Diseña, importa o traduce tu cuestionario",
    blurb:
      "Arma un formulario desde cero, importa uno existente para editarlo, o traduce automáticamente un cuestionario de SurveyMonkey al formato XLSForm.",
    features: [
      "Crear desde cero con asistente visual",
      "Importar XLSX existente y editar celdas",
      "Traducir cuestionarios de SurveyMonkey",
      "Wizard de lógica y saltos condicionales",
      "Diagnósticos del formulario en vivo",
    ],
    icon: FilePen,
    iconBg: "#f5f3ff",
    iconFg: "#7c3aed",
    iconBorder: "#ddd6fe",
    to: "/editor-xlsform",
  },
  {
    slug: "procesamiento",
    title: "Procesamiento y reportes",
    tagline: "Pipeline completo en 5 fases",
    blurb:
      "Flujo completo de 5 fases: carga de data, validación, codificación de abiertas, preparación analítica y generación de reportes PPT/Word listos para entregar.",
    features: [
      "Carga y normalización de data + XLSForm",
      "Validación con reglas y limpieza personalizada",
      "Codificación de respuestas abiertas",
      "Frecuencias, cruces y dimensiones",
      "Reportes en PowerPoint y Word",
    ],
    icon: Workflow,
    iconBg: "var(--pulso-primary-soft)",
    iconFg: "var(--pulso-primary)",
    iconBorder: "var(--pulso-primary-border)",
    to: "/procesamiento",
  },
  {
    slug: "dashboard",
    title: "Dashboard interactivo",
    tagline: "Explora cruces, relaciones y base de datos",
    blurb:
      "Dashboard interactivo del cuestionario para entregar a tu cliente: resumen por sección, relaciones (cruces) y base de datos. Personaliza logo, paleta y título.",
    features: [
      "Resumen por sección del cuestionario",
      "Cruces 2D filtrados con semáforo",
      "Base de datos descargable",
      "Personaliza logo, paleta y título",
      "Exporta como HTML autosuficiente (WebR)",
    ],
    icon: LayoutDashboard,
    iconBg: "#eff6ff",
    iconFg: "#1d4ed8",
    iconBorder: "#bfdbfe",
    to: "/tablero",
  },
  {
    slug: "hojas-ruta",
    title: "Hojas de ruta para campo",
    tagline: "Cuotas, rutas y mapas para enumeradores",
    blurb:
      "Genera hojas de ruta imprimibles para enumeradores: cuotas por conglomerado, rutas de visita y puntos de muestra georeferenciados. Entrega un ZIP listo para impresión.",
    features: [
      "Cuotas por conglomerado (UMP)",
      "Rutas de visita imprimibles",
      "Puntos de muestra georeferenciados",
      "Validación de territorio (UBIGEO Lima)",
      "ZIP con PDFs listos para imprimir",
    ],
    icon: MapIcon,
    iconBg: "#ecfdf5",
    iconFg: "#059669",
    iconBorder: "#a7f3d0",
    to: "/hojas-ruta",
  },
  {
    slug: "recopiladores",
    title: "Generador de recopiladores",
    tagline: "Fichas QR + enlaces a KoboCollect",
    blurb:
      "Genera fichas imprimibles con códigos QR y enlaces personalizados a KoboCollect — una por enumerador, conglomerado o punto de muestreo para autenticar la captura.",
    features: [
      "Una ficha por enumerador, conglomerado o punto",
      "QR + enlace personalizado a KoboCollect",
      "Autenticación de captura en campo",
      "Layout imprimible y compartible",
    ],
    icon: QrCode,
    iconBg: "#fffbeb",
    iconFg: "#d97706",
    iconBorder: "#fde68a",
    // to: undefined — placeholder "Próximamente"
  },
  {
    slug: "monitoreo",
    title: "Monitoreo de campo",
    tagline: "Tablero en vivo del avance de campo",
    blurb:
      "Tablero en vivo del avance de campo: cobertura por enumerador, cuotas restantes y alertas de calidad mientras la encuesta corre.",
    features: [
      "Cobertura por enumerador en tiempo real",
      "Cuotas restantes vs. objetivo",
      "Alertas de calidad y outliers",
      "Vista web responsiva (desktop + mobile)",
    ],
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
    case "recopiladores":
    case "monitoreo":
      return "Próximamente";
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const activeMod = activeSlug
    ? MODULES.find((m) => m.slug === activeSlug) ?? null
    : null;

  return (
    <div className="home-wrap">
      <Hero estudioNombre={state?.estudio_nombre ?? null} />
      <ProjectBar project={project} />
      <ModulesGrid
        state={state}
        proc={proc}
        onOpenModule={(slug) => setActiveSlug(slug)}
      />
      <HomeFooter
        version={version}
        onClose={() => setExitOpen(true)}
        onOpenNotes={() => setNotesOpen(true)}
      />

      {activeMod && (
        <ModuleDetail mod={activeMod} onClose={() => setActiveSlug(null)} />
      )}

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
    <section className="home-projbar" aria-label="Proyecto y recientes">
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
        <IconHero size={22} strokeWidth={1.8} />
      </div>
      <div className="home-proj-body">
        <span className="home-proj-name">¿Empezamos un proyecto?</span>
        <span className="home-proj-meta">
          Crea uno nuevo o abre un <code>.pulso</code> existente para arrancar.
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
// Hero compacto — saludo + tagline + contexto del estudio.
// El wordmark y logo viven en el BrandMark del header global; no se
// repiten aquí.
// =====================================================================
function Hero({ estudioNombre }: { estudioNombre: string | null }) {
  const saludo = useSaludo();
  return (
    <header className="home-hero">
      <h1 className="home-hero-greeting">{saludo}</h1>
      <p className="home-hero-tagline">Suite analítica para estudios con XLSForm</p>
      {estudioNombre && (
        <p className="home-hero-context">
          Trabajando en <strong>"{estudioNombre}"</strong>
        </p>
      )}
    </header>
  );
}

// =====================================================================
// ModulesGrid — 2×3 de cards medianas (click abre ModuleDetail)
// =====================================================================
function ModulesGrid({
  state,
  proc,
  onOpenModule,
}: {
  state: SessionState | null;
  proc: ModulePhaseState;
  onOpenModule: (slug: string) => void;
}) {
  return (
    <section aria-label="Módulos de Prosecnur" className="home-modules">
      {MODULES.map((mod) => (
        <ModuleTile
          key={mod.slug}
          mod={mod}
          meta={computeMeta(mod.slug, state, proc)}
          onOpen={() => onOpenModule(mod.slug)}
        />
      ))}
    </section>
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
