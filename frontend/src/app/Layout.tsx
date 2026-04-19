import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../lib/SessionContext";
import { apiShutdown } from "../api/client";

type NavItem = { to: string; label: string; done?: boolean; disabled?: boolean };

function useNavItems(): NavItem[] {
  const { state } = useSession();
  return [
    { to: "/carga", label: "1. Carga", done: !!state?.xlsform && !!state?.data },
    { to: "/validacion", label: "2. Validación", done: !!state?.auditoria_run, disabled: !state?.xlsform },
    { to: "/codificacion", label: "3. Codificación", done: !!state?.codif_aplicado, disabled: !state?.xlsform || !state?.data },
    { to: "/analitica", label: "4. Analítica", done: !!state?.analitica_prep_ok, disabled: !state?.xlsform || !state?.data },
    { to: "/graficos", label: "5. Gráficos", done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok, disabled: !state?.analitica_prep_ok },
    { to: "/dashboard", label: "6. Dashboard", disabled: true },
  ];
}

function SessionBadge() {
  const { sessionId, version, error } = useSession();
  return (
    <div style={{ fontSize: 12, color: "#666", marginBottom: "1rem" }}>
      <div><strong>Pulso Report</strong></div>
      <div style={{ color: "#999" }}>{version}</div>
      {sessionId && (
        <div style={{ color: "#aaa", marginTop: 4, fontFamily: "ui-monospace,monospace", fontSize: 11 }}>
          sid: {sessionId.slice(0, 8)}…
        </div>
      )}
      {error && <div style={{ color: "#c00", marginTop: 4 }}>⚠ {error}</div>}
    </div>
  );
}

export default function Layout() {
  const items = useNavItems();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", fontFamily: "system-ui,sans-serif" }}>
      <aside style={{ background: "#f6f6f8", borderRight: "1px solid #e3e3e8", padding: "1.25rem 1rem" }}>
        <SessionBadge />
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              style={({ isActive }) => ({
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                textDecoration: "none",
                color: it.disabled ? "#bbb" : isActive ? "#fff" : "#333",
                background: isActive ? "#0066cc" : "transparent",
                pointerEvents: it.disabled ? "none" : "auto",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              })}
            >
              <span>{it.label}</span>
              {it.done && <span style={{ color: "#10b981", fontSize: 12 }}>✓</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "2rem", fontSize: 12 }}>
          <button
            onClick={() => apiShutdown().then(() => window.close()).catch(() => {})}
            style={{ width: "100%", padding: "0.5rem", fontSize: 12 }}
          >
            Cerrar aplicación
          </button>
        </div>
      </aside>
      <main style={{ padding: "2rem 2.5rem", maxWidth: 1100 }}>
        <Outlet />
      </main>
    </div>
  );
}
