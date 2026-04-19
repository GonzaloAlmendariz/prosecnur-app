import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../lib/SessionContext";
import { apiShutdown } from "../api/client";

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
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--pulso-primary)", letterSpacing: -0.3 }}>
        Pulso Report
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace,monospace" }}>
        prosecnur
      </div>
    </div>
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
      {it.done && <span style={{ fontSize: 11 }}>✓</span>}
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
      {error && <span style={{ color: "#b91c1c" }}>⚠ {error}</span>}
    </div>
  );
}

export default function Layout() {
  const items = useNavItems();
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
        }}
      >
        <Brand />
        <nav style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {items.map((it, i) => (
            <div key={it.to} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NavItem it={it} />
              {i < items.length - 1 && <span style={{ color: "#c2c8d4", fontSize: 13 }}>›</span>}
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <SessionChip />
        <button onClick={() => apiShutdown().then(() => window.close()).catch(() => {})} style={{ fontSize: 12 }}>
          Cerrar
        </button>
      </header>
      <main style={{ padding: "1.75rem 2rem", maxWidth: 1440, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
