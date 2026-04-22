import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSession } from "../lib/SessionContext";

// Layout global de la app. El header siempre muestra el brand + session
// chip. El topbar de las 5 fases (Carga → Gráficos) aparece SOLO cuando
// el usuario está dentro del módulo "Procesamiento de XLSForm" — el
// Home (`/`) no lo muestra porque es un menú de módulos a nivel superior,
// no una fase del procesamiento.

// Rutas que forman parte del módulo "Procesamiento de XLSForm".
// Cuando la pathname actual matchea alguna, el topbar de fases se
// despliega. Estrictas (no prefix) para evitar que rutas futuras como
// `/hojas-de-ruta` arrastren el topbar por accidente.
const PROCESAMIENTO_PATHS = [
  "/procesamiento",
  "/carga",
  "/validacion",
  "/codificacion",
  "/analitica",
  "/graficos",
];

function isProcesamientoRoute(pathname: string): boolean {
  return PROCESAMIENTO_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

type NavItem = { to: string; n: number; label: string; done?: boolean; disabled?: boolean };

function useNavItems(): NavItem[] {
  const { state } = useSession();
  return [
    { to: "/carga", n: 1, label: "Carga", done: !!state?.xlsform && !!state?.data },
    { to: "/validacion", n: 2, label: "Validación", done: !!state?.auditoria_run, disabled: !state?.xlsform },
    { to: "/codificacion", n: 3, label: "Codificación", done: !!state?.codif_aplicado, disabled: !state?.xlsform || !state?.data },
    { to: "/analitica", n: 4, label: "Analítica", done: !!state?.analitica_prep_ok, disabled: !state?.xlsform || !state?.data },
    { to: "/graficos", n: 5, label: "Gráficos", done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok, disabled: !state?.analitica_prep_ok },
  ];
}

function Brand() {
  // Linkea al home — el logo siempre devuelve al menú principal.
  return (
    <NavLink
      to="/"
      title="Ir al menú principal"
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        textDecoration: "none",
        padding: "4px 8px",
        borderRadius: 6,
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--pulso-primary-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <BrandMark />
      <span style={{ fontWeight: 700, fontSize: 17, color: "var(--pulso-primary)", letterSpacing: -0.3 }}>
        Prosecnur
      </span>
    </NavLink>
  );
}

// Logo SVG compacto — círculo con chart bars embebido. Neutro para
// que funcione dentro de un header con fondo blanco/surface.
function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="var(--pulso-primary)" />
      <rect x="6"  y="11" width="2.3" height="5" rx="0.6" fill="white" />
      <rect x="9.85" y="8" width="2.3" height="8" rx="0.6" fill="white" opacity="0.85" />
      <rect x="13.7" y="5" width="2.3" height="11" rx="0.6" fill="white" opacity="0.7" />
    </svg>
  );
}

function NavItem({ it }: { it: NavItem }) {
  return (
    <NavLink
      to={it.to}
      style={({ isActive }) => {
        const active = isActive;
        const base: React.CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
          border: "1px solid transparent",
          transition: "all 120ms",
          pointerEvents: it.disabled ? "none" : "auto",
        };
        if (it.disabled) {
          return { ...base, color: "#c2c8d4", background: "transparent" };
        }
        if (active) {
          return { ...base, background: "var(--pulso-primary)", color: "#fff", boxShadow: "0 4px 10px rgba(0,36,87,0.18)" };
        }
        return { ...base, color: "var(--pulso-text)", background: "var(--pulso-surface)", border: "1px solid var(--pulso-border)" };
      }}
    >
      <span
        style={{
          minWidth: 20, height: 20, borderRadius: 999,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700,
          background: it.disabled ? "#edf0f6" : "rgba(255,255,255,0.18)",
          color: "inherit",
          border: "1px solid rgba(255,255,255,0.22)",
        }}
      >
        {it.n}
      </span>
      <span>{it.label}</span>
    </NavLink>
  );
}

function SessionChip() {
  const { sessionId, version, error } = useSession();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--pulso-text-soft)" }}>
      {version && <span>{version}</span>}
      {sessionId && (
        <span style={{ fontFamily: "ui-monospace,monospace" }}>
          sid {sessionId.slice(0, 6)}…
        </span>
      )}
      {error && <span style={{ color: "var(--pulso-danger-fg)" }}>{error}</span>}
    </div>
  );
}

export default function Layout() {
  const items = useNavItems();
  const location = useLocation();
  const showFases = isProcesamientoRoute(location.pathname);

  return (
    <div className="pulso-shell">
      <header
        style={{
          display: "flex", alignItems: "center", gap: 18,
          padding: "12px 24px",
          background: "var(--pulso-surface)",
          borderBottom: "1px solid var(--pulso-border)",
          boxShadow: "var(--pulso-shadow-low)",
          position: "sticky", top: 0, zIndex: 50,
          flexWrap: "wrap",
        }}
      >
        <Brand />
        {showFases && (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 1, height: 20,
                background: "var(--pulso-border)",
              }}
            />
            <nav
              aria-label="Fases de procesamiento"
              style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
            >
              {items.map((it, i) => (
                <div key={it.to} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <NavItem it={it} />
                  {i < items.length - 1 && <ChevronRight size={14} color="#c2c8d4" />}
                </div>
              ))}
            </nav>
          </>
        )}
        <div style={{ flex: 1 }} />
        <SessionChip />
      </header>
      <main style={{ padding: "1.75rem 2rem", maxWidth: 1440, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
