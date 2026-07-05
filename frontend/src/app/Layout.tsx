import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, Database } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { useSession } from "../lib/SessionContext";
import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioBase, type EstudioPayload } from "../api/client";
import ProjectIndicator from "../features/project/ProjectIndicator";
import { useOptionalProjectShell } from "../features/project/ProjectShell";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES,
  moduleChromeVars,
} from "../lib/modules";
import ModuleWarmupBoundary, { RouteLoadingFallback } from "./ModuleWarmupBoundary";

// Layout global de la app. El header muestra marca, navegación, proyecto
// activo y errores de sesión solo cuando existen. El topbar local de etapas
// (Carga → Gráficos) aparece SOLO cuando
// el usuario está dentro del módulo de carga, limpieza y análisis — el
// Home (`/`) no lo muestra porque es un menú de módulos a nivel superior,
// no una fase del procesamiento.

// Rutas que forman parte del tramo de carga, limpieza, analítica y productos.
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

const MODULE_SWITCHER_ITEMS = PROSECNUR_PRIMARY_ACTIVE_MODULES;

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
  "/calc-muestra",
  "/plan-trabajo",
  "/diseno-estudio",
  "/recopiladores",
  "/hojas-ruta",
  "/monitoreo",
  "/monitoreo/comparar-territorial",
  "/monitoreo/comparar-acreditacion",
]);

function routePolicy(pathname: string): "viewport" | "legacy-scroll" {
  if (isProcesamientoRoute(pathname)) return "viewport";
  if (VIEWPORT_PATHS.has(pathname)) return "viewport";
  return "legacy-scroll";
}

type NavItem = { to: string; n: number; label: string; done?: boolean; blockedReason?: string };

function useNavItems(): NavItem[] {
  const { state } = useSession();
  const hasXlsform = !!state?.xlsform;
  const hasData = !!state?.data;
  const hasAnalitica = !!state?.analitica_prep_ok;

  return [
    { to: "/carga", n: 1, label: "Carga", done: hasXlsform && hasData },
    {
      to: "/validacion",
      n: 2,
      label: "Validación",
      done: !!state?.auditoria_run,
      blockedReason: hasXlsform ? undefined : "Bloqueada: carga un XLSForm en Carga.",
    },
    {
      to: "/codificacion",
      n: 3,
      label: "Codificación",
      done: !!state?.codif_aplicado,
      blockedReason: hasXlsform && hasData ? undefined : "Bloqueada: completa carga y consolidación.",
    },
    {
      to: "/analitica",
      n: 4,
      label: "Analítica",
      done: hasAnalitica,
      blockedReason: hasXlsform && hasData ? undefined : "Bloqueada: completa carga y consolidación.",
    },
    {
      to: "/graficos",
      n: 5,
      label: "Gráficos",
      done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok,
      blockedReason: hasAnalitica ? undefined : "Bloqueada: prepara Analítica.",
    },
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
    <svg className="pulso-brand-mark" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="var(--pulso-primary)" />
      <rect x="6"  y="11" width="2.3" height="5" rx="0.6" fill="white" />
      <rect x="9.85" y="8" width="2.3" height="8" rx="0.6" fill="white" opacity="0.85" />
      <rect x="13.7" y="5" width="2.3" height="11" rx="0.6" fill="white" opacity="0.7" />
    </svg>
  );
}

function ProcessingPhaseDock({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="pulso-phase-rail pulso-processing-phase-dock"
      aria-label="Secciones de procesamiento"
    >
      <div className="pulso-phase-pillbar pulso-processing-phase-bar">
        <ol className="pulso-phase-pill-list pulso-processing-phase-list">
          {items.map((it) => (
            <ProcessingPhaseDockItem key={it.to} it={it} />
          ))}
        </ol>
      </div>
    </nav>
  );
}

function ProcessingPhaseDockItem({ it }: { it: NavItem }) {
  const blocked = !!it.blockedReason;
  return (
    <li className="pulso-processing-phase-item">
      <NavLink
        to={it.to}
        title={it.blockedReason ?? (it.done ? `${it.label}: sección lista` : `Abrir ${it.label}`)}
        aria-label={it.blockedReason ? `${it.label}. ${it.blockedReason}` : `${it.label}. ${it.done ? "Sección lista." : "Abrir sección."}`}
        className={({ isActive }) => [
          "pulso-phase-pill",
          "pulso-processing-phase-link",
          isActive ? "is-active" : "",
          it.done ? "is-done" : "",
          blocked ? "is-blocked" : "",
        ].filter(Boolean).join(" ")}
      >
        <span className="pulso-phase-pill-circle" aria-hidden="true" />
        <span className="pulso-phase-pill-stack">
          <span className="pulso-phase-pill-label">
            <span className="pulso-phase-pill-number pulso-processing-phase-number">{it.n}</span>
            <span className="pulso-phase-pill-text">{it.label}</span>
          </span>
        </span>
      </NavLink>
    </li>
  );
}

function SessionErrorChip() {
  const { error } = useSession();
  if (!error) return null;
  return (
    <div className="pulso-session-chip pulso-session-chip--error" role="status">
      <span className="is-error">{error}</span>
    </div>
  );
}

function activeModuleRoute(pathname: string): string {
  if (isProcesamientoRoute(pathname)) return "/procesamiento";
  if (pathname === "/plan-trabajo" || pathname.startsWith("/plan-trabajo/")) {
    return "/diseno-estudio";
  }
  const match = MODULE_SWITCHER_ITEMS
    .filter((item) => item.to !== "/")
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return match?.to ?? "/";
}

function ModuleSwitcher() {
  const location = useLocation();
  const active = activeModuleRoute(location.pathname);
  const activeItem = MODULE_SWITCHER_ITEMS.find((item) => item.to === active) ?? null;

  return (
    <nav
      className="pulso-module-switcher"
      aria-label="Cambiar módulo"
      title={activeItem ? `Módulo actual: ${activeItem.title}` : "Cambiar módulo"}
    >
      <div className="pulso-module-dock" role="list">
        {MODULE_SWITCHER_ITEMS.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.to === active;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              role="listitem"
              aria-current={isCurrent ? "page" : undefined}
              aria-label={item.title}
              title={item.title}
              style={moduleChromeVars(item)}
              className={[
                "pulso-module-tile",
                isCurrent ? "is-current" : "",
              ].filter(Boolean).join(" ")}
            >
              <span className="pulso-module-tile-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2.25} />
              </span>
              <span className="pulso-module-tile-label">{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function siblingSourceTitle(base: EstudioBase | undefined) {
  const label = String(base?.source_alias || base?.source_title || base?.nombre || "").trim();
  return label && label !== "NA" ? label : "Base";
}

function siblingLabel(base: EstudioBase | undefined) {
  const label = siblingSourceTitle(base);
  const compact = label
    .replace(/^Acreditaci[oó]n\s+/i, "")
    .replace(/\s*[-–—]\s*Encuesta\s+Egresados.*$/i, "")
    .trim();
  return compact || label;
}

function statusOn(value: unknown) {
  return value === true;
}

function SiblingWorkbenchSelector({
  visible,
  placement = "floating",
}: {
  visible: boolean;
  placement?: "floating" | "row";
}) {
  const { state, refresh } = useSession();
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const inRow = placement === "row";
  const baseCount = state?.n_bases ?? 0;
  const independent = visible &&
    state?.estudio_processing_mode === "independent_siblings" &&
    baseCount > 0;

  async function load() {
    if (!independent) return;
    try {
      setEstudio(await apiEstudioGet());
    } catch {
      setEstudio(null);
    }
  }

  useEffect(() => {
    void load();
    function onChanged() {
      void load();
    }
    window.addEventListener("pulso:active-base-changed", onChanged);
    window.addEventListener("pulso:session-changed", onChanged);
    return () => {
      window.removeEventListener("pulso:active-base-changed", onChanged);
      window.removeEventListener("pulso:session-changed", onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [independent, state?.active_base, state?.n_bases]);

  if (!independent || !estudio) {
    if (inRow && visible && baseCount > 0) {
      const modeLabel = independent ? "Preparando selector" : baseCount === 1 ? "Base única" : "Bases combinadas";
      return (
        <div
          className="pulso-sibling-switcher is-row is-summary"
          aria-label={`${modeLabel}: ${baseCount} ${baseCount === 1 ? "base" : "bases"}`}
          title={`${modeLabel}: ${baseCount} ${baseCount === 1 ? "base" : "bases"}`}
        >
          <div className="pulso-sibling-trigger pulso-sibling-trigger--summary" role="status">
            <span className="pulso-sibling-trigger-icon" aria-hidden="true">
              <Database size={14} />
            </span>
            <span className="pulso-sibling-trigger-copy">
              <strong>{baseCount} {baseCount === 1 ? "base" : "bases"}</strong>
            </span>
            <span className="pulso-sibling-trigger-progress" aria-hidden="true">{modeLabel}</span>
          </div>
        </div>
      );
    }
    return null;
  }
  const bases = Object.values(estudio.bases ?? {});
  const active = estudio.active_base || state?.active_base || bases[0]?.nombre || "";
  const activeBase = bases.find((base) => base.nombre === active) ?? bases[0];
  const s = activeBase?.status ?? {};
  const steps = [
    ["Carga", statusOn(s.imported)],
    ["Val", statusOn(s.validacion)],
    ["Cod", statusOn(s.codificacion)],
    ["Ana", statusOn(s.analitica)],
    ["Gráf", statusOn(s.graficos)],
  ] as const;
  const done = steps.filter(([, ok]) => ok).length;
  const activeBaseLabel = siblingLabel(activeBase);
  const progressLabel = `${done} de ${steps.length} etapas listas`;

  async function changeActive(next: string) {
    if (!next || next === active || switching) return;
    setSwitching(true);
    try {
      const result = await apiEstudioActiveBaseSet(next);
      setOpen(false);
      await refresh();
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: result.active, processing_mode: result.processing_mode },
      }));
      void load();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Select.Root
      value={active}
      disabled={switching}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(next) => void changeActive(next)}
    >
      <div
        className={`pulso-sibling-switcher ${inRow ? "is-row" : "is-compact"} is-progress-${done}${open ? " is-open" : ""}`}
        aria-label="Base activa"
        title={`Base activa: ${activeBaseLabel} · ${progressLabel}`}
        data-progress={`${done}/${steps.length}`}
      >
        <div className="pulso-sibling-switcher-top">
          <span>Base activa</span>
          <strong>{done}/{steps.length}</strong>
        </div>
        <Select.Trigger
          className="pulso-sibling-trigger"
          disabled={switching}
          aria-label={`Seleccionar base activa: ${activeBaseLabel}. ${progressLabel}`}
          title="Cambiar base activa"
        >
          <span className="pulso-sibling-trigger-icon" aria-hidden="true">
            <Database size={14} />
          </span>
          <span className="pulso-sibling-trigger-copy">
            <strong>{activeBaseLabel}</strong>
          </span>
          <span className="pulso-sibling-trigger-progress" aria-hidden="true">{done}/{steps.length}</span>
          <Select.Icon asChild>
            <ChevronDown size={14} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <span className="pulso-sibling-tooltip" role="tooltip">
          <strong>{activeBaseLabel}</strong>
          <span>{progressLabel}</span>
          <small>Clic para cambiar base</small>
        </span>
      </div>
      <Select.Portal>
        <Select.Content
          className="pulso-sibling-menu"
          position="popper"
          side={inRow ? "bottom" : "top"}
          align={inRow ? "end" : "start"}
          sideOffset={8}
          collisionPadding={10}
        >
          <Select.Viewport className="pulso-sibling-menu-viewport">
            {bases.map((base) => {
              const baseSteps = [
                ["Carga", statusOn(base.status?.imported)],
                ["Val", statusOn(base.status?.validacion)],
                ["Cod", statusOn(base.status?.codificacion)],
                ["Ana", statusOn(base.status?.analitica)],
                ["Gráf", statusOn(base.status?.graficos)],
              ] as const;
              const baseDone = baseSteps.filter(([, ok]) => ok).length;
              return (
                <Select.Item
                  key={base.nombre}
                  value={base.nombre}
                  textValue={siblingLabel(base)}
                  className="pulso-sibling-option"
                  title={siblingSourceTitle(base)}
                >
                  <span className="pulso-sibling-option-copy">
                    <Select.ItemText>
                      <strong>{siblingLabel(base)}</strong>
                    </Select.ItemText>
                    <small>{baseDone}/{baseSteps.length} etapas listas</small>
                  </span>
                  <span className="pulso-sibling-option-dots" aria-label={`${baseDone} de ${baseSteps.length} etapas listas`}>
                    {baseSteps.map(([label, ok]) => (
                      <i key={label} className={ok ? "is-done" : ""} title={label} />
                    ))}
                  </span>
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function Layout() {
  const items = useNavItems();
  const location = useLocation();
  const showFases = isProcesamientoRoute(location.pathname);
  const isProcessing = isProcesamientoRoute(location.pathname);
  const isHome = location.pathname === "/";
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
  const projectShell = useOptionalProjectShell();

  useEffect(() => {
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="pulso-shell">
      <header className="pulso-app-header">
        <div className="pulso-nav-cluster" aria-label="Navegación principal">
          <Brand />
          <ModuleSwitcher />
        </div>
        <div className="pulso-app-header-spacer" />
        <div className="pulso-app-header-actions">
          {projectShell ? (
            <ProjectIndicator
              project={projectShell.project}
              onOpenProjectViewer={projectShell.openProjectViewer}
              onRequestSelector={projectShell.requestProjectSelector}
            />
          ) : null}
          <SessionErrorChip />
        </div>
      </header>
      {showFases && (
        <div className="pulso-processing-phase-row">
          <ProcessingPhaseDock items={items} />
          <div className="pulso-processing-phase-side pulso-processing-phase-side--right">
            <SiblingWorkbenchSelector visible={showFases} placement="row" />
          </div>
        </div>
      )}
      <main
        className={[
          "pulso-main",
          `pulso-main--${policy}`,
          isHome ? "pulso-main--home" : "",
          isProcessing ? "pulso-main--processing" : "",
        ].filter(Boolean).join(" ")}
        data-route-policy={policy}
      >
        <div className="pulso-main-inner">
          <div
            key={routeMotionKey}
            className="pulso-route-surface"
            data-route-motion={routeMotion}
          >
            <ModuleWarmupBoundary>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Outlet />
              </Suspense>
            </ModuleWarmupBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
