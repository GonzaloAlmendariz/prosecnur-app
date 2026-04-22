import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Github, Power, Sparkles,
  Map as MapIcon, Workflow, ChevronDown,
} from "lucide-react";
import { apiShutdown } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ExitDialog } from "./ExitDialog";

// Home — menú principal de Prosecnur.
//
// Prosecnur es una suite analítica; el primer módulo construido es
// "Procesamiento de XLSForm" (el flujo de 5 fases clásico). A futuro
// caben otros módulos (hojas de ruta de campo, monitoreo, etc.).
//
// Jerarquía del Home (críticamente importante):
//   1. Hero — compacto: saludo + nombre de la app + contexto. NO
//      compite con los módulos.
//   2. Módulos — PROTAGONISTAS ABSOLUTOS. Cards grandes, tipografía
//      display, hover expresivo. Es lo que el ojo ve primero después
//      del hero.
//   3. Notas de versión — panel secundario, compacto, colapsable.
//      Historial completo disponible bajo "Ver historial".
//   4. Footer — atribución del autor con link a GitHub + botón cerrar.

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
    slug: "procesamiento",
    title: "Procesamiento de XLSForm",
    blurb:
      "Flujo completo: carga de data, validación, codificación de respuestas abiertas, preparación analítica y generación de reportes PPT/Word.",
    icon: Workflow,
    iconBg: "var(--pulso-primary-soft)",
    iconFg: "var(--pulso-primary)",
    iconBorder: "var(--pulso-primary-border)",
    to: "/procesamiento",
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
  },
];

// ---- Notas de la versión --------------------------------------------
type ReleaseNote = {
  version: string;
  date: string;
  highlights: string[];
};

const RELEASE_NOTES: ReleaseNote[] = [
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

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "28px 20px 36px",
        display: "flex", flexDirection: "column", gap: 36,
      }}
    >
      {/* Hero compacto */}
      <Hero estudioNombre={state?.estudio_nombre ?? null} />

      {/* Módulos — protagonistas */}
      <ModulesGrid proc={proc} />

      {/* Footer con atribución + notas + cerrar */}
      <HomeFooter
        version={version}
        onClose={() => setExitOpen(true)}
      />

      {exitOpen && <ExitDialog onCancel={() => setExitOpen(false)} onConfirm={doShutdown} />}
    </div>
  );
}

function doShutdown() {
  apiShutdown()
    .then(() => { try { window.close(); } catch { /* ignore */ } })
    .catch(() => { try { window.close(); } catch { /* ignore */ } });
}

// =====================================================================
// Hero
// =====================================================================
function Hero({ estudioNombre }: { estudioNombre: string | null }) {
  const saludo = useSaludo();
  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: 16,
        flexWrap: "wrap",
      }}
    >
      <HeroLogo />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 260 }}>
        <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontWeight: 500 }}>
          {saludo}
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 32, fontWeight: 800, letterSpacing: -0.5,
            color: "var(--pulso-primary)", lineHeight: 1.05,
          }}
        >
          Prosecnur
        </h1>
        <span style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          Suite analítica para estudios con XLSForm.
          {estudioNombre && (
            <>
              {" · "}
              <span style={{ color: "var(--pulso-text)", fontWeight: 600 }}>
                Trabajando en "{estudioNombre}"
              </span>
            </>
          )}
        </span>
      </div>
    </header>
  );
}

function HeroLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
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
// Módulos — cards grandes y expresivas
// =====================================================================
function ModulesGrid({ proc }: { proc: ModulePhaseState }) {
  return (
    <section
      aria-label="Módulos de Prosecnur"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 20,
      }}
    >
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

function ModuleCard({ mod, procState }: { mod: ModuleMeta; procState: ModulePhaseState | null }) {
  const Icon = mod.icon;
  const isActive = !!mod.to;
  const pct = procState && procState.total > 0 ? procState.done / procState.total : 0;
  const hasProgress = procState && procState.done > 0;

  // Etiqueta del CTA final — se adapta al estado del módulo.
  const ctaLabel = !isActive
    ? "Disponible próximamente"
    : procState && procState.done === procState.total && procState.total > 0
      ? "Revisar resultados"
      : hasProgress && procState?.nextLabel
        ? `Continuar en ${procState.nextLabel}`
        : "Empezar ahora";

  const card = (
    <div
      style={{
        position: "relative",
        display: "flex", flexDirection: "column", gap: 16,
        padding: "30px 28px",
        borderRadius: 14,
        border: isActive
          ? "1px solid var(--pulso-primary-border)"
          : "1px dashed var(--pulso-border)",
        background: "white",
        minHeight: 300,
        cursor: isActive ? "pointer" : "default",
        transition: "border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
        boxShadow: isActive ? "var(--pulso-shadow-low)" : "none",
        opacity: isActive ? 1 : 0.72,
      }}
    >
      {/* Badge "Próximamente" */}
      {!isActive && (
        <span
          style={{
            position: "absolute", top: 18, right: 18,
            fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.6,
            padding: "4px 10px", borderRadius: 999,
            background: "var(--pulso-surface-2)",
            color: "var(--pulso-text-soft)",
            border: "1px solid var(--pulso-border)",
          }}
        >
          Próximamente
        </span>
      )}

      {/* Icon chip grande */}
      <span
        aria-hidden="true"
        style={{
          width: 64, height: 64, borderRadius: 16,
          background: mod.iconBg,
          color: mod.iconFg,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${mod.iconBorder}`,
          flexShrink: 0,
          boxShadow: isActive ? "var(--pulso-shadow-low)" : "none",
        }}
      >
        <Icon size={30} strokeWidth={1.8} />
      </span>

      {/* Título display */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24, fontWeight: 700,
            color: "var(--pulso-text)", letterSpacing: -0.3,
            lineHeight: 1.2,
          }}
        >
          {mod.title}
        </h2>
        <p
          style={{
            margin: 0, fontSize: 14, lineHeight: 1.6,
            color: "var(--pulso-text-soft)",
            maxWidth: 480,
          }}
        >
          {mod.blurb}
        </p>
      </div>

      {/* Progress strip para Procesamiento */}
      {procState && isActive && (
        <div
          style={{
            marginTop: "auto",
            display: "flex", flexDirection: "column", gap: 8,
            padding: "12px 14px", borderRadius: 9,
            background: hasProgress ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
            border: `1px solid ${hasProgress ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span
              style={{
                fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.5,
                color: hasProgress ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
              }}
            >
              {procState.done === 0
                ? "Sin empezar"
                : procState.done === procState.total
                  ? "Completado"
                  : `Fase ${procState.done} de ${procState.total}`}
            </span>
            <span
              style={{
                fontSize: 12, fontFamily: "ui-monospace, monospace", fontWeight: 600,
                color: hasProgress ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
              }}
            >
              {procState.done}/{procState.total}
            </span>
          </div>
          <div style={{
            height: 6, borderRadius: 3,
            background: "rgba(0, 36, 87, 0.08)",
            overflow: "hidden",
          }}>
            <div
              style={{
                height: "100%", width: `${pct * 100}%`,
                background: "var(--pulso-primary)",
                transition: "width 400ms ease",
              }}
            />
          </div>
          {procState.nextLabel && (
            <span
              style={{
                fontSize: 12, color: "var(--pulso-text-soft)",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              <Sparkles size={12} color="var(--pulso-primary)" />
              Continúa en{" "}
              <strong style={{ color: "var(--pulso-primary)" }}>{procState.nextLabel}</strong>
            </span>
          )}
        </div>
      )}

      {/* Footer del módulo — CTA */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          paddingTop: procState && isActive ? 0 : 0,
          marginTop: procState && isActive ? 0 : "auto",
          fontSize: 14, fontWeight: 700,
          color: isActive ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        }}
      >
        {ctaLabel}
        {isActive && (
          <ArrowRight
            size={16}
            style={{ transition: "transform 180ms ease" }}
            className="pulso-module-arrow"
          />
        )}
      </div>
    </div>
  );

  if (!isActive || !mod.to) return card;

  return (
    <Link
      to={mod.to}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget.firstChild as HTMLDivElement;
        el.style.borderColor = "var(--pulso-primary)";
        el.style.boxShadow = "var(--pulso-shadow-med), 0 0 0 3px var(--pulso-primary-ring)";
        el.style.transform = "translateY(-4px)";
        const arrow = el.querySelector(".pulso-module-arrow") as HTMLElement | null;
        if (arrow) arrow.style.transform = "translateX(4px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.firstChild as HTMLDivElement;
        el.style.borderColor = "var(--pulso-primary-border)";
        el.style.boxShadow = "var(--pulso-shadow-low)";
        el.style.transform = "translateY(0)";
        const arrow = el.querySelector(".pulso-module-arrow") as HTMLElement | null;
        if (arrow) arrow.style.transform = "translateX(0)";
      }}
    >
      {card}
    </Link>
  );
}

// =====================================================================
// Footer — versión + autor + cerrar + notas
// =====================================================================
function HomeFooter({
  version, onClose,
}: {
  version: string;
  onClose: () => void;
}) {
  return (
    <footer
      style={{
        display: "flex", flexDirection: "column", gap: 18,
        paddingTop: 22,
        borderTop: "1px solid var(--pulso-border)",
      }}
    >
      <ReleaseNotesPanel />

      <div
        style={{
          display: "flex", alignItems: "center", gap: 14,
          flexWrap: "wrap",
          fontSize: 11, color: "var(--pulso-text-soft)",
        }}
      >
        <span>
          Prosecnur{version && version !== "…" ? ` · ${version}` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Hecho por{" "}
          <a
            href={AUTHOR.github}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--pulso-text-soft)",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 4,
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--pulso-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--pulso-text-soft)"; }}
            title="Ver el perfil del autor en GitHub"
          >
            {AUTHOR.name}
            <Github size={11} />
          </a>
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 11, padding: "6px 12px",
            display: "inline-flex", alignItems: "center", gap: 5,
            border: "1px solid var(--pulso-border)",
            borderRadius: 6, background: "white",
            color: "var(--pulso-text-soft)",
            cursor: "pointer",
            transition: "border-color 120ms ease, color 120ms ease, background 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-danger-border)";
            e.currentTarget.style.color = "var(--pulso-danger-fg)";
            e.currentTarget.style.background = "var(--pulso-danger-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--pulso-border)";
            e.currentTarget.style.color = "var(--pulso-text-soft)";
            e.currentTarget.style.background = "white";
          }}
        >
          <Power size={11} /> Cerrar aplicación
        </button>
      </div>
    </footer>
  );
}

// =====================================================================
// Notas de versión — compactas y colapsables
// =====================================================================
function ReleaseNotesPanel() {
  const [expanded, setExpanded] = useState(false);
  const latest = RELEASE_NOTES[0];
  const older = RELEASE_NOTES.slice(1);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      {/* Línea compacta con última versión */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.6,
            padding: "3px 9px", borderRadius: 999,
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-primary)",
            border: "1px solid var(--pulso-primary-border)",
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
          }}
        >
          v{latest.version} · {formatDate(latest.date)}
        </span>
        <ul
          style={{
            margin: 0, padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 3,
            flex: 1, minWidth: 240,
          }}
        >
          {latest.highlights.slice(0, 3).map((h, i) => (
            <li
              key={i}
              style={{
                fontSize: 12, color: "var(--pulso-text-soft)",
                lineHeight: 1.5,
                display: "flex", gap: 6, alignItems: "flex-start",
              }}
            >
              <Check size={12} style={{ color: "var(--pulso-success-fg)", flexShrink: 0, marginTop: 3 }} />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        {older.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              fontSize: 11, fontWeight: 500,
              padding: "3px 8px",
              border: "none", background: "transparent",
              color: "var(--pulso-text-soft)",
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
              whiteSpace: "nowrap",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--pulso-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--pulso-text-soft)"; }}
          >
            {expanded ? "Ocultar historial" : `Ver historial (${older.length})`}
            <ChevronDown
              size={12}
              style={{ transition: "transform 180ms ease", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
            />
          </button>
        )}
      </div>

      {/* Historial expandido */}
      {expanded && older.length > 0 && (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 10,
            paddingLeft: 14,
            borderLeft: "2px solid var(--pulso-border)",
            marginLeft: 4,
          }}
        >
          {older.map((n) => (
            <div key={n.version} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 10, fontWeight: 700,
                  color: "var(--pulso-text-soft)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: 0.3,
                }}
              >
                v{n.version} · {formatDate(n.date)}
              </span>
              <ul
                style={{
                  margin: 0, padding: 0, listStyle: "none",
                  display: "flex", flexDirection: "column", gap: 3,
                }}
              >
                {n.highlights.map((h, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 11, color: "var(--pulso-text-soft)",
                      lineHeight: 1.5,
                      display: "flex", gap: 6, alignItems: "flex-start",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        width: 4, height: 4, borderRadius: "50%",
                        background: "var(--pulso-text-soft)",
                        marginTop: 7, flexShrink: 0,
                      }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}
