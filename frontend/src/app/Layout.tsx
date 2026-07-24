import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, Database, Plus } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { useSession } from "../lib/SessionContext";
import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioBase, type EstudioPayload } from "../api/client";
import ProjectIndicator from "../features/project/ProjectIndicator";
import { useOptionalProjectShell } from "../features/project/ProjectShell";
import { useProjectModules } from "../features/project/ProjectModulesContext";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES,
  moduleChromeVars,
} from "../lib/modules";
import ModuleWarmupBoundary, { RouteLoadingFallback } from "./ModuleWarmupBoundary";
import { GlidingTabList } from "../components/GlidingTabList";
import { MultibaseReportMenu } from "../features/graficos/MultibaseReportMenu";
import { processingBaseScopePresentation } from "../features/procesamiento/baseScopeModel";

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

export function processingHeaderReportScope(
  pathname: string,
  search: string,
): "active" | "consolidated" {
  if (pathname !== "/graficos") return "active";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("scope") === "consolidado" ? "consolidated" : "active";
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
  "/bitacora",
  "/recopiladores",
  "/hojas-ruta",
  "/monitoreo",
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

// Isotipo canónico de la identidad (branding/logo/prosecnur-isotipo.svg):
// squircle navy + 4 pastillas en perfil de latido. Fuente única de la
// geometría: branding/direccion-creativa.md
function BrandMark() {
  return (
    <svg className="pulso-brand-mark" width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15.4" fill="var(--pulso-primary)" />
      <rect x="12" y="30" width="7" height="18" rx="3.5" fill="white" />
      <rect x="23" y="22" width="7" height="26" rx="3.5" fill="white" />
      <rect x="34" y="28" width="7" height="20" rx="3.5" fill="white" />
      <rect x="45" y="16" width="7" height="32" rx="3.5" fill="white" />
    </svg>
  );
}

function ProcessingPhaseDock({ items }: { items: NavItem[] }) {
  const location = useLocation();
  const activeItem = items.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  return (
    <nav
      className="pulso-phase-rail pulso-processing-phase-dock"
      aria-label="Secciones de procesamiento"
    >
      <GlidingTabList
        activeKey={activeItem?.to}
        className="pulso-phase-pillbar pulso-processing-phase-bar"
        role="tablist"
        aria-label="Secciones de procesamiento"
      >
        <ol className="pulso-phase-pill-list pulso-processing-phase-list">
          {items.map((it) => (
            <ProcessingPhaseDockItem key={it.to} it={it} active={activeItem?.to === it.to} />
          ))}
        </ol>
      </GlidingTabList>
    </nav>
  );
}

function ProcessingPhaseDockItem({ it, active }: { it: NavItem; active: boolean }) {
  const blocked = !!it.blockedReason;
  return (
    <li className="pulso-processing-phase-item">
      <NavLink
        to={it.to}
        role="tab"
        data-gliding-key={it.to}
        aria-selected={active}
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
  // Cronograma y Diseño del estudio se fusionaron en Bitácora.
  if (
    pathname === "/plan-trabajo" || pathname.startsWith("/plan-trabajo/") ||
    pathname === "/diseno-estudio" || pathname.startsWith("/diseno-estudio/")
  ) {
    return "/bitacora";
  }
  const match = MODULE_SWITCHER_ITEMS
    .filter((item) => item.to !== "/")
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return match?.to ?? "/";
}

function ModuleSwitcher() {
  const location = useLocation();
  const { addedSlugs } = useProjectModules();
  const active = activeModuleRoute(location.pathname);
  const activeItem = MODULE_SWITCHER_ITEMS.find((item) => item.to === active) ?? null;

  // El rail solo muestra los módulos agregados al proyecto. Además incluimos el
  // módulo activo aunque no esté agregado, para no perder el "dónde estás".
  const visibleItems = MODULE_SWITCHER_ITEMS.filter(
    (item) => addedSlugs.includes(item.slug) || item.to === active,
  );

  return (
    <nav
      className="pulso-module-switcher"
      aria-label="Cambiar módulo"
      title={activeItem ? `Módulo actual: ${activeItem.title}` : "Cambiar módulo"}
    >
      <div className="pulso-module-dock" role="list">
        {visibleItems.map((item) => {
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
        <NavLink
          to="/?agregar=1"
          className="pulso-module-tile pulso-module-tile-add"
          aria-label="Agregar módulo"
          title="Agregar módulo"
        >
          <span className="pulso-module-tile-icon" aria-hidden="true">
            <Plus size={16} strokeWidth={2.4} />
          </span>
          <span className="pulso-module-tile-label">Agregar</span>
        </NavLink>
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
  reportScope = "active",
}: {
  visible: boolean;
  placement?: "floating" | "row";
  reportScope?: "active" | "consolidated";
}) {
  const { state, refresh } = useSession();
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const inRow = placement === "row";
  const baseCount = state?.n_bases ?? 0;
  const baseScope = processingBaseScopePresentation(state?.estudio_processing_mode, baseCount);
  const independent = visible && baseScope.showBasePicker;
  const consolidated = independent && reportScope === "consolidated";
  const needsBasePicker = independent && !consolidated;

  async function load() {
    if (!needsBasePicker) return;
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
  }, [needsBasePicker, state?.active_base, state?.n_bases]);

  if (consolidated) {
    return (
      <div
        className="pulso-sibling-switcher is-row is-summary is-consolidated"
        aria-label={`Alcance del informe: todas las bases (${baseCount})`}
        title={`Informe compartido con ${baseCount} bases independientes`}
      >
        <div className="pulso-sibling-trigger pulso-sibling-trigger--summary" role="status">
          <span className="pulso-sibling-trigger-icon" aria-hidden="true">
            <Database size={14} />
          </span>
          <span className="pulso-sibling-trigger-copy">
            <strong>Todas las bases</strong>
          </span>
          <span className="pulso-sibling-trigger-progress" aria-hidden="true">{baseCount} fuentes</span>
        </div>
      </div>
    );
  }

  if (!needsBasePicker || !estudio) {
    if (inRow && visible && baseCount > 0) {
      const modeLabel = independent ? "Preparando selector" : baseScope.summaryLabel;
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
  const activeModule = PROSECNUR_PRIMARY_ACTIVE_MODULES.find(
    (item) => item.to === activeModuleRoute(location.pathname),
  );
  const showFases = isProcesamientoRoute(location.pathname);
  const isProcessing = isProcesamientoRoute(location.pathname);
  const isHome = location.pathname === "/";
  const policy = routePolicy(location.pathname);
  const routeMotionKey = location.pathname;
  const reportScope = processingHeaderReportScope(location.pathname, location.search);
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
            <div className="pulso-base-workbench" role="group" aria-label="Visor de bases del procesamiento">
              <SiblingWorkbenchSelector visible={showFases} placement="row" reportScope={reportScope} />
              <MultibaseReportMenu />
            </div>
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
        style={activeModule ? moduleChromeVars(activeModule) : undefined}
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
