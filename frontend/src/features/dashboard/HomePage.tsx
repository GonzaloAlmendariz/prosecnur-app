import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Lock,
  FileUp, ShieldCheck, Tags, BarChart2, Presentation,
} from "lucide-react";
import { useSession } from "../../lib/SessionContext";

// Home — menú principal de la app. Entrada por la ruta `/`.
//
// La app tiene 5 fases secuenciales (Carga → Validación → Codificación →
// Analítica → Gráficos). Algunas requieren que la anterior esté lista
// antes de habilitarse. Acá mostramos el progreso global del estudio
// como tarjetas grandes, cada una con su estado visual:
//
//   ✓ done     — completada en la sesión actual.
//   →           — habilitada y lista para trabajar.
//   🔒 bloqueada — falta cumplir un prerequisito (ej. cargar XLSForm).
//
// Click en cualquier tarjeta habilitada navega a su ruta. El layout
// global sigue mostrándose para que el analista pueda saltar a
// cualquier fase desde el header también.

type Phase = {
  to: string;
  n: number;
  title: string;
  blurb: string;
  icon: typeof FileUp;
  done: boolean;
  disabled: boolean;
  disabledReason?: string;
};

export default function HomePage() {
  const { state, version } = useSession();

  const phases: Phase[] = [
    {
      to: "/carga",
      n: 1,
      title: "Carga",
      blurb: "Sube el XLSForm y la base de datos. Punto de partida de cualquier estudio.",
      icon: FileUp,
      done: !!state?.xlsform && !!state?.data,
      disabled: false,
    },
    {
      to: "/validacion",
      n: 2,
      title: "Validación",
      blurb: "Audita la data contra reglas y detecta inconsistencias antes de analizar.",
      icon: ShieldCheck,
      done: !!state?.auditoria_run,
      disabled: !state?.xlsform,
      disabledReason: "Carga un XLSForm primero",
    },
    {
      to: "/codificacion",
      n: 3,
      title: "Codificación",
      blurb: "Agrupa respuestas abiertas (SO/SM con 'Otros') y asigna códigos.",
      icon: Tags,
      done: !!state?.codif_aplicado,
      disabled: !state?.xlsform || !state?.data,
      disabledReason: "Requiere XLSForm + data",
    },
    {
      to: "/analitica",
      n: 4,
      title: "Analítica",
      blurb: "Prepara reportes de frecuencias, cruces, codebook, enumeradores y bases.",
      icon: BarChart2,
      done: !!state?.analitica_prep_ok,
      disabled: !state?.xlsform || !state?.data,
      disabledReason: "Requiere XLSForm + data",
    },
    {
      to: "/graficos",
      n: 5,
      title: "Gráficos",
      blurb: "Diseña el plan de slides y exporta el reporte final en PowerPoint y Word.",
      icon: Presentation,
      done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok,
      disabled: !state?.analitica_prep_ok,
      disabledReason: "Termina Analítica primero",
    },
  ];

  const nDone = phases.filter((p) => p.done).length;
  const firstActionable = phases.find((p) => !p.disabled && !p.done);

  return (
    <section
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 40px",
        display: "flex", flexDirection: "column", gap: 28,
      }}
    >
      {/* Brand / Hero */}
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{
            margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: -0.5,
            color: "var(--pulso-primary)",
          }}>
            Pulso Report
          </h1>
          <span style={{
            fontSize: 12, fontFamily: "ui-monospace, monospace",
            color: "var(--pulso-text-soft)",
          }}>
            prosecnur
          </span>
          {version && version !== "…" && (
            <span style={{
              fontSize: 11, color: "var(--pulso-text-soft)",
              padding: "2px 8px", borderRadius: 999,
              background: "var(--pulso-surface-2)",
              border: "1px solid var(--pulso-border)",
              marginLeft: "auto",
            }}>
              {version}
            </span>
          )}
        </div>
        <p style={{
          margin: 0, fontSize: 14, lineHeight: 1.55,
          color: "var(--pulso-text-soft)", maxWidth: 640,
        }}>
          Convierte un XLSForm + una base de datos en un reporte analítico completo.
          Un flujo lineal en 5 fases — cada una abre la siguiente cuando está lista.
        </p>
      </header>

      {/* Resumen de progreso */}
      <div
        aria-label="Progreso del estudio"
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 18px",
          background: "var(--pulso-primary-soft)",
          border: "1px solid var(--pulso-primary-border)",
          borderRadius: 10,
          flexWrap: "wrap",
        }}
      >
        <ProgressRing done={nDone} total={phases.length} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pulso-primary)" }}>
            {nDone === 0 && "Arranca cargando tu estudio"}
            {nDone > 0 && nDone < phases.length && `${nDone} de ${phases.length} fases completadas`}
            {nDone === phases.length && "Estudio completo"}
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>
            {firstActionable
              ? `Siguiente paso: ${firstActionable.title}.`
              : nDone === phases.length
                ? "Puedes volver a cualquier fase para ajustar."
                : "Revisa los requisitos de las fases bloqueadas."}
          </div>
        </div>
        {firstActionable && (
          <Link
            to={firstActionable.to}
            className="pulso-primary"
            style={{
              fontSize: 12, padding: "8px 14px",
              display: "inline-flex", alignItems: "center", gap: 6,
              textDecoration: "none",
            }}
          >
            Continuar con {firstActionable.title} <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {/* Grid de fases */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {phases.map((p) => <PhaseCard key={p.to} phase={p} />)}
      </div>
    </section>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 54, height: 54, flexShrink: 0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} fill="none" stroke="var(--pulso-border)" strokeWidth="4" />
        <circle
          cx="27" cy="27" r={r} fill="none"
          stroke="var(--pulso-primary)" strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 27 27)"
          style={{ transition: "stroke-dashoffset 360ms ease" }}
        />
      </svg>
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "var(--pulso-primary)",
        }}
      >
        {done}/{total}
      </div>
    </div>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  const Icon = phase.icon;
  const content = (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: 18, borderRadius: 10,
        border: "1px solid var(--pulso-border)",
        background: "white",
        height: "100%", minHeight: 160,
        position: "relative",
        cursor: phase.disabled ? "not-allowed" : "pointer",
        transition: "border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
        opacity: phase.disabled ? 0.65 : 1,
      }}
    >
      {/* Badge de estado en la esquina superior derecha */}
      <div style={{ position: "absolute", top: 14, right: 14 }}>
        {phase.done ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
            padding: "3px 8px 3px 6px", borderRadius: 999,
            background: "var(--pulso-success-bg)",
            color: "var(--pulso-success-fg)",
            border: "1px solid var(--pulso-success-border)",
          }}>
            <Check size={11} /> Listo
          </span>
        ) : phase.disabled ? (
          <span
            title={phase.disabledReason}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 0.4,
              padding: "3px 8px 3px 6px", borderRadius: 999,
              background: "var(--pulso-surface-2)",
              color: "var(--pulso-text-soft)",
              border: "1px solid var(--pulso-border)",
            }}
          >
            <Lock size={10} /> Bloqueada
          </span>
        ) : null}
      </div>

      {/* Header de la card */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 38, height: 38, borderRadius: 9,
            background: phase.done ? "var(--pulso-success-bg)" : "var(--pulso-primary-soft)",
            color: phase.done ? "var(--pulso-success-fg)" : "var(--pulso-primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
            color: "var(--pulso-text-soft)",
          }}>
            Fase {phase.n}
          </span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--pulso-text)" }}>
            {phase.title}
          </h3>
        </div>
      </div>

      <p style={{
        margin: 0, fontSize: 12, lineHeight: 1.5,
        color: "var(--pulso-text-soft)", flex: 1,
      }}>
        {phase.blurb}
      </p>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, fontWeight: 600,
        color: phase.disabled ? "var(--pulso-text-soft)" : "var(--pulso-primary)",
      }}>
        {phase.disabled ? (phase.disabledReason ?? "Bloqueada") : phase.done ? "Revisar" : "Empezar"}
        {!phase.disabled && <ArrowRight size={13} />}
      </div>
    </div>
  );

  if (phase.disabled) return content;

  return (
    <Link
      to={phase.to}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget.firstChild as HTMLDivElement;
        el.style.borderColor = "var(--pulso-primary)";
        el.style.boxShadow = "var(--pulso-shadow-med)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.firstChild as HTMLDivElement;
        el.style.borderColor = "var(--pulso-border)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {content}
    </Link>
  );
}
