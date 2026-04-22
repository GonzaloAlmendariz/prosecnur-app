import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Lock, Power, Sparkles, Map as MapIcon, Workflow,
} from "lucide-react";
import { apiShutdown } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ExitDialog } from "./ExitDialog";

// Home — menú principal de Prosecnur.
//
// Prosecnur es una suite analítica; el primer módulo que se construyó es
// "Procesamiento de XLSForm" (el flujo de 5 fases clásico). A futuro
// caben otros módulos: hojas de ruta de campo, monitoreo en vivo, etc.
//
// Por eso el Home NO es un "stepper de 5 fases" sino un menú de módulos
// de nivel superior. Al entrar al módulo de procesamiento, el Layout
// despliega el topbar con las fases internas.
//
// El Home muestra además:
//  - Progreso del procesamiento actual (si hay datos cargados) con CTA
//    "Continúa en la fase N" — no se pierde el caso de "dejé algo a
//    la mitad".
//  - Notas de la versión (qué cambió recientemente).
//  - Botón de cerrar la app con confirmación.

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
  // Siguiente paso actionable: primera no-done que esté desbloqueada.
  const next = phases.find((p) => p.unlocked && !p.done) ?? null;
  return {
    done,
    total: phases.length,
    nextLabel: next?.label ?? null,
    nextTo: next?.to ?? null,
  };
}

// ---- Catálogo de módulos --------------------------------------------
// Por ahora uno activo + uno "próximamente". Cuando haya un módulo nuevo
// real (hojas de ruta, monitoreo, etc.) se añade acá con su `to` y
// pasa a estar activo.
type ModuleMeta = {
  slug: string;
  title: string;
  blurb: string;
  icon: typeof Workflow;
  iconBg: string; // fondo del ícono (soft)
  iconFg: string; // color del ícono
  iconBorder: string; // borde del ícono
  to?: string;    // si viene, es activo; sin to = "próximamente"
};

const MODULES: ModuleMeta[] = [
  {
    slug: "procesamiento",
    title: "Procesamiento de XLSForm",
    blurb:
      "El flujo completo: carga de data, validación, codificación de respuestas abiertas, preparación analítica y generación de reportes PPT/Word.",
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
      "Genera hojas de ruta imprimibles para enumeradores: cuotas por conglomerado, rutas de visita, puntos de muestra georeferenciados.",
    icon: MapIcon,
    // Verde "emerald" soft — se diferencia del azul primary sin pelear
    // por atención. Cuando haya más módulos, seguimos rotando tonos.
    iconBg: "#ecfdf5",
    iconFg: "#059669",
    iconBorder: "#a7f3d0",
    // to: undefined — placeholder
  },
];

// ---- Notas de la versión --------------------------------------------
// Hardcoded por ahora; en una iteración siguiente podríamos traerlas del
// backend con un endpoint `/api/system/release-notes` que lea un CHANGELOG.
// Lista ordenada de más reciente a más antigua.
type ReleaseNote = {
  version: string;
  date: string; // ISO yyyy-mm-dd
  highlights: string[];
};

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.8",
    date: "2026-04-21",
    highlights: [
      "Nuevo menú principal con visión multi-módulo (Procesamiento de XLSForm + futuros).",
      "Notas de la versión visibles desde el home.",
      "Sistema de diseño unificado: tokens de status, primitivos compartidos, sin hex hardcoded en Fases 3/4/5.",
      "Confirmación al cerrar la app para no perder progreso por accidente.",
    ],
  },
  {
    version: "0.7",
    date: "2026-04-20",
    highlights: [
      "Editor de presets con color picker integrado (paletas del estudio + rueda del sistema).",
      "Textos en negrita con multi-select de chips — sin escribir tokens a mano.",
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

export default function HomePage() {
  const { version } = useSession();
  const proc = useProcesamientoState();
  const [exitOpen, setExitOpen] = useState(false);

  const hasAnyProgress = proc.done > 0 || !!proc.nextTo;

  return (
    <section
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "32px 20px 40px",
        display: "flex", flexDirection: "column", gap: 28,
      }}
    >
      {/* Hero */}
      <Hero version={version} />

      {/* Módulos */}
      <Section
        title="Módulos"
        hint="Elige qué quieres hacer hoy. La selección activa los paneles internos correspondientes."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {MODULES.map((m) => (
            <ModuleCard
              key={m.slug}
              mod={m}
              procState={m.slug === "procesamiento" ? proc : null}
            />
          ))}
        </div>
      </Section>

      {/* Notas de versión */}
      <Section
        title="Notas de la versión"
        hint="Qué es nuevo y qué cambió recientemente en Prosecnur."
      >
        <div style={{
          background: "white",
          border: "1px solid var(--pulso-border)",
          borderRadius: 10,
          overflow: "hidden",
        }}>
          {RELEASE_NOTES.map((n, i) => (
            <ReleaseNoteRow key={n.version} note={n} isLast={i === RELEASE_NOTES.length - 1} />
          ))}
        </div>
      </Section>

      {/* Footer — acciones de aplicación */}
      <footer
        style={{
          display: "flex", alignItems: "center", gap: 12,
          paddingTop: 8, flexWrap: "wrap",
          color: "var(--pulso-text-soft)", fontSize: 11,
        }}
      >
        <span>
          Prosecnur {version && version !== "…" ? `· ${version}` : ""}
          {hasAnyProgress && " · progreso guardado automáticamente en esta sesión"}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setExitOpen(true)}
          style={{
            fontSize: 12, padding: "7px 14px",
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "1px solid var(--pulso-border)",
            borderRadius: 6, background: "white",
            color: "var(--pulso-text)",
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
            e.currentTarget.style.color = "var(--pulso-text)";
            e.currentTarget.style.background = "white";
          }}
        >
          <Power size={13} /> Cerrar aplicación
        </button>
      </footer>

      {exitOpen && <ExitDialog onCancel={() => setExitOpen(false)} onConfirm={doShutdown} />}
    </section>
  );
}

function doShutdown() {
  apiShutdown()
    .then(() => { try { window.close(); } catch { /* ignore */ } })
    .catch(() => { /* si falla el server, intenta cerrar igual */ try { window.close(); } catch { /* ignore */ } });
}

// ---- Hero ------------------------------------------------------------

function Hero({ version }: { version: string }) {
  return (
    <header style={{
      display: "flex", flexDirection: "column", gap: 10,
      paddingBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <HeroLogo />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 800,
            letterSpacing: -0.6,
            color: "var(--pulso-primary)",
            lineHeight: 1,
          }}>
            Prosecnur
          </h1>
          <span style={{ fontSize: 13, color: "var(--pulso-text-soft)", fontWeight: 500 }}>
            Suite analítica para estudios con XLSForm
          </span>
        </div>
        {version && version !== "…" && (
          <span
            title={version}
            style={{
              marginLeft: "auto", alignSelf: "flex-start",
              fontSize: 11, fontFamily: "ui-monospace, monospace",
              color: "var(--pulso-text-soft)",
              padding: "4px 10px", borderRadius: 999,
              background: "var(--pulso-surface-2)",
              border: "1px solid var(--pulso-border)",
            }}
          >
            {version}
          </span>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 680,
        color: "var(--pulso-text-soft)",
      }}>
        Una suite de herramientas para operar estudios completos a partir de
        un XLSForm. Desde la ingesta de data hasta el reporte final en
        PowerPoint y Word, sin salir de un solo lugar.
      </p>
    </header>
  );
}

function HeroLogo() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="prosecnur-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--pulso-primary)" />
          <stop offset="100%" stopColor="#013371" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#prosecnur-logo-grad)" />
      <g>
        <rect x="16" y="34" width="6" height="14" rx="1.5" fill="white" opacity="0.95" />
        <rect x="26" y="26" width="6" height="22" rx="1.5" fill="white" opacity="0.85" />
        <rect x="36" y="18" width="6" height="30" rx="1.5" fill="white" opacity="0.75" />
        <rect x="46" y="22" width="6" height="26" rx="1.5" fill="white" opacity="0.65" />
      </g>
    </svg>
  );
}

// ---- Section wrapper -------------------------------------------------

function Section({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.8,
          color: "var(--pulso-text-soft)",
        }}>
          {title}
        </h2>
        {hint && (
          <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// ---- Module card -----------------------------------------------------

function ModuleCard({ mod, procState }: { mod: ModuleMeta; procState: ModulePhaseState | null }) {
  const Icon = mod.icon;
  const isActive = !!mod.to;
  const pct = procState && procState.total > 0 ? procState.done / procState.total : 0;

  const card = (
    <div
      style={{
        position: "relative",
        display: "flex", flexDirection: "column", gap: 12,
        padding: 20, borderRadius: 12,
        border: "1px solid var(--pulso-border)",
        background: "white",
        minHeight: 200,
        cursor: isActive ? "pointer" : "default",
        transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        opacity: isActive ? 1 : 0.7,
      }}
    >
      {/* Badge "Próximamente" para módulos placeholder */}
      {!isActive && (
        <span
          style={{
            position: "absolute", top: 16, right: 16,
            fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.5,
            padding: "3px 8px", borderRadius: 999,
            background: "var(--pulso-surface-2)",
            color: "var(--pulso-text-soft)",
            border: "1px solid var(--pulso-border)",
          }}
        >
          Próximamente
        </span>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: mod.iconBg,
            color: mod.iconFg,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${mod.iconBorder}`,
          }}
        >
          <Icon size={20} />
        </span>
        <h3 style={{
          margin: 0, fontSize: 17, fontWeight: 700,
          color: "var(--pulso-text)", lineHeight: 1.25,
        }}>
          {mod.title}
        </h3>
      </div>

      <p style={{
        margin: 0, fontSize: 12, lineHeight: 1.55,
        color: "var(--pulso-text-soft)", flex: 1,
      }}>
        {mod.blurb}
      </p>

      {procState && isActive && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 6,
          padding: "10px 12px", borderRadius: 8,
          background: procState.done > 0 ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
          border: `1px solid ${procState.done > 0 ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.5,
              color: procState.done > 0 ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            }}>
              {procState.done === 0
                ? "Sin empezar"
                : procState.done === procState.total
                  ? "Completado"
                  : `Fase ${procState.done} de ${procState.total}`}
            </span>
            <span style={{
              fontSize: 11, fontFamily: "ui-monospace, monospace",
              color: procState.done > 0 ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            }}>
              {procState.done}/{procState.total}
            </span>
          </div>
          <div style={{
            height: 4, borderRadius: 2,
            background: "rgba(0, 36, 87, 0.08)",
            overflow: "hidden",
          }}>
            <div
              style={{
                height: "100%", width: `${pct * 100}%`,
                background: "var(--pulso-primary)",
                transition: "width 360ms ease",
              }}
            />
          </div>
          {procState.nextLabel && (
            <span style={{
              fontSize: 11, color: "var(--pulso-text-soft)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <Sparkles size={11} color="var(--pulso-primary)" />
              Continúa en <strong style={{ color: "var(--pulso-primary)" }}>{procState.nextLabel}</strong>
            </span>
          )}
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center",
        fontSize: 12, fontWeight: 600,
        color: isActive ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
      }}>
        {isActive
          ? (procState && procState.done === procState.total && procState.total > 0
              ? "Revisar"
              : procState && procState.done > 0
                ? `Continuar en ${procState.nextLabel}`
                : "Empezar")
          : "Disponible próximamente"}
        {isActive && <ArrowRight size={13} style={{ marginLeft: 4 }} />}
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
        el.style.boxShadow = "var(--pulso-shadow-med)";
        el.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.firstChild as HTMLDivElement;
        el.style.borderColor = "var(--pulso-border)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {card}
    </Link>
  );
}

// ---- Release note row ------------------------------------------------

function ReleaseNoteRow({ note, isLast }: { note: ReleaseNote; isLast: boolean }) {
  const dateLabel = useMemo(() => {
    try {
      return new Date(note.date + "T00:00:00").toLocaleDateString("es-PE", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return note.date;
    }
  }, [note.date]);

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 14, padding: "14px 18px",
        borderBottom: isLast ? "none" : "1px solid var(--pulso-border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "var(--pulso-primary)",
          fontFamily: "ui-monospace, monospace",
        }}>
          v{note.version}
        </span>
        <span style={{
          fontSize: 11, color: "var(--pulso-text-soft)",
          textTransform: "capitalize",
        }}>
          {dateLabel}
        </span>
      </div>
      <ul style={{
        margin: 0, padding: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {note.highlights.map((h, i) => (
          <li
            key={i}
            style={{
              display: "flex", gap: 8,
              fontSize: 12, color: "var(--pulso-text)", lineHeight: 1.55,
            }}
          >
            <Check size={13} style={{ color: "var(--pulso-success-fg)", flexShrink: 0, marginTop: 3 }} />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

// Re-export usado por el module-card para completar el lint cuando Lock
// no aparece en el árbol (lo mantenemos importado para futuro uso en
// "bloqueado por razón X").
export { Lock };
