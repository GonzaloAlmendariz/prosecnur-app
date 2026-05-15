import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/SessionContext";
import ProjectIndicator from "../features/project/ProjectIndicator";
import { useProjectShell } from "../features/project/ProjectShell";

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

function procesamientoIndex(pathname: string): number | null {
  const index = PROCESAMIENTO_PATHS.findIndex(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  return index === -1 ? null : index;
}

const VIEWPORT_PATHS = new Set([
  "/",
  "/carga",
  "/validacion",
  "/codificacion",
  "/analitica",
  "/graficos",
  "/editor-xlsform",
  "/tablero",
  "/hojas-ruta",
  "/monitoreo",
]);

function routePolicy(pathname: string): "viewport" | "legacy-scroll" {
  if (isProcesamientoRoute(pathname)) return "viewport";
  if (VIEWPORT_PATHS.has(pathname)) return "viewport";
  return "legacy-scroll";
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
      className="pulso-brand-link"
      title="Ir al menú principal"
    >
      <BrandMark />
      <span className="pulso-brand-wordmark">
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
    <li className="pulso-phase-pill-item">
      <NavLink
        to={it.to}
        aria-disabled={it.disabled || undefined}
        tabIndex={it.disabled ? -1 : undefined}
        onClick={(event) => {
          if (it.disabled) event.preventDefault();
        }}
        className={({ isActive }) => [
          "pulso-phase-pill",
          isActive ? "is-active" : "",
          it.done ? "is-done" : "",
          it.disabled ? "is-disabled" : "",
        ].filter(Boolean).join(" ")}
      >
        <span className="pulso-phase-pill-circle" aria-hidden="true" />
        <span className="pulso-phase-pill-stack">
          <span className="pulso-phase-pill-label">
            <span className="pulso-phase-pill-number">{it.n}</span>
            <span>{it.label}</span>
          </span>
          <span className="pulso-phase-pill-label-hover" aria-hidden="true">
            <span className="pulso-phase-pill-number">{it.n}</span>
            <span>{it.label}</span>
          </span>
        </span>
      </NavLink>
    </li>
  );
}

function SessionChip() {
  const { sessionId, version, error } = useSession();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--pulso-text-soft)" }}>
      {version && <span>{version}</span>}
      {typeof sessionId === "string" && sessionId.length > 0 && (
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
  const policy = routePolicy(location.pathname);
  const routeMotionKey = location.pathname;
  const previousPathRef = useRef(location.pathname);
  const previousPhaseIndex = procesamientoIndex(previousPathRef.current);
  const currentPhaseIndex = procesamientoIndex(location.pathname);
  const routeMotion =
    previousPhaseIndex != null && currentPhaseIndex != null && previousPhaseIndex !== currentPhaseIndex
      ? currentPhaseIndex > previousPhaseIndex
        ? "forward"
        : "back"
      : "default";
  const { project, openStartModal } = useProjectShell();

  useEffect(() => {
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="pulso-shell">
      <header className="pulso-app-header">
        <Brand />
        {showFases && (
          <div className="pulso-phase-rail" aria-label="Contexto de procesamiento">
            <span className="pulso-phase-separator" aria-hidden="true" />
            <nav
              aria-label="Fases de procesamiento"
              className="pulso-phase-pillbar"
            >
              <ul className="pulso-phase-pill-list">
                {items.map((it) => (
                  <NavItem key={it.to} it={it} />
                ))}
              </ul>
            </nav>
          </div>
        )}
        <div className="pulso-app-header-spacer" />
        <ProjectIndicator project={project} onRequestStartModal={openStartModal} />
        <SessionChip />
      </header>
      <main
        className={`pulso-main pulso-main--${policy}`}
        data-route-policy={policy}
      >
        <div className="pulso-main-inner">
          <div
            key={routeMotionKey}
            className="pulso-route-surface"
            data-route-motion={routeMotion}
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
