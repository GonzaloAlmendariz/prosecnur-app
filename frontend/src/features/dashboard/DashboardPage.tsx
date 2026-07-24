import "./theme/tokens.css";

import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Eye,
  EyeOff,
  GitBranch,
  LayoutDashboard,
  Layers,
  Palette,
  Rocket,
  Settings,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { type DashboardTabId } from "../../api/client";
import { DashboardCurationGate } from "./curation/DashboardCurationGate";
import { DashboardHeader } from "./header/DashboardHeader";
import { DashboardCustomizeDialog } from "./customize/DashboardCustomizeDialog";
import "./customize/customize.css";
import { DashboardPalettesDialog } from "./palettes/DashboardPalettesDialog";
import { DashboardPublishDialog } from "./publish/DashboardPublishDialog";
import { EmptyState } from "./shared/EmptyState";
import { DashboardSourceGate } from "./source/DashboardSourceGate";
import { ResumenTab } from "./tabs/ResumenTab";
import { RelacionTab } from "./tabs/RelacionTab";
import { BaseDatosTab } from "./tabs/BaseDatosTab";
import { DimensionesTab } from "./tabs/DimensionesTab";
import { ThemeProvider } from "./theme/ThemeProvider";
import { DEFAULT_TABS_ENABLED, useDashboardAutosave, useDashboardStore } from "./store";
import { useDashboardManifest, useDashboardRecodVars } from "./useDashboardData";
import { isPublicMode } from "../../lib/runtime";
import { GlidingTabList } from "../../components/GlidingTabList";

const DASHBOARD_SECTION_ICONS: Record<DashboardTabId, LucideIcon> = {
  resumen: LayoutDashboard,
  relaciones: GitBranch,
  base_datos: Database,
  dimensiones: Layers,
};

// Página principal del Dashboard.
// Jerarquía:
//   ┌─────────────────────────────────────────────┐
//   │ Command bar editor-only                     │
//   ├─────────────────────────────────────────────┤
//   │ Rail de secciones — Resumen | Relaciones... │
//   ├─────────────────────────────────────────────┤
//   │ Workbench de la sección activa              │
//   └─────────────────────────────────────────────┘
//
// La estructura de tabs viene del manifest del paquete (NO editable).
// Las tabs no disponibles aparecen deshabilitadas con tooltip.

export default function DashboardPage({ publicMode: publicModeProp }: { publicMode?: boolean } = {}) {
  // Modo público (deploy a HF/Fly): backend real, pero UI sin shell admin.
  // Misma desactivación de autosave (el .pulso del server es read-only;
  // no hay para dónde guardar cambios y los endpoints de mutación están
  // bloqueados). El prop tiene prioridad sobre la env var.
  const publicMode = publicModeProp ?? isPublicMode();
  const adminHidden = publicMode;
  useDashboardAutosave(!adminHidden);

  const config = useDashboardStore((s) => s.config);
  const tabActiva = useDashboardStore((s) => s.tabActiva);
  const setTabActiva = useDashboardStore((s) => s.setTabActiva);
  const setSeccionActiva = useDashboardStore((s) => s.setSeccionActiva);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [palettesOpen, setPalettesOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  // Modo "Vista previa": oculta el admin toolbar y los controles de
  // edición para que el editor pueda ver cómo se verá el dashboard
  // publicado. Solo de sesión, no se persiste.
  const [previewMode, setPreviewMode] = useState(false);

  // En vista previa cualquier diálogo abierto debe cerrarse — no son
  // parte del producto final que vería el lector.
  useEffect(() => {
    if (previewMode) {
      setSourceOpen(false);
      setPalettesOpen(false);
      setCustomizeOpen(false);
      setPublishOpen(false);
    }
  }, [previewMode]);

  // Atajo: Escape sale de vista previa cuando no hay diálogo abierto.
  useEffect(() => {
    if (!previewMode) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewMode(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewMode]);

  const { loading, error, manifest, themeDefault, refresh } = useDashboardManifest();
  const hasDashboardSource = !!manifest?.estado.tiene_data;
  const editorChromeVisible = !adminHidden && !previewMode;

  // Filtrado de tabs por config.tabs_enabled — vive en el store (editable
  // desde Personalizar → Pestañas). Los tabs deshabilitados no aparecen
  // en el nav del dashboard final.
  const tabsEnabled = useMemo(
    () => ({ ...DEFAULT_TABS_ENABLED, ...(config.tabs_enabled ?? {}) }),
    [config.tabs_enabled],
  );
  const visibleTabs = useMemo(
    () => (manifest?.tabs ?? []).filter((t) => tabsEnabled[t.id] !== false),
    [manifest, tabsEnabled],
  );
  const unavailableVisibleTabs = useMemo(
    () => visibleTabs.filter((t) => !t.available),
    [visibleTabs],
  );

  // Variables con recodificación detectadas. La decisión (original/recod)
  // por variable se configura desde el panel "Datos" — no bloqueamos el
  // dashboard, solo proveemos el dato al SourceGate. Default "original"
  // si el usuario no eligió.
  const recodVarsState = useDashboardRecodVars();

  // Si la tab activa deja de estar disponible (manifest o config), fallback
  // a la primera disponible y habilitada.
  useEffect(() => {
    if (!manifest) return;
    const active = visibleTabs.find((t) => t.id === tabActiva);
    if (active && active.available) return;
    const first = visibleTabs.find((t) => t.available);
    if (first) setTabActiva(first.id);
  }, [manifest, visibleTabs, tabActiva, setTabActiva]);

  return (
    <ThemeProvider
      paletaId={config.paleta_id}
      colorPrimarioOverride={config.color_primario_override}
      themeDefault={themeDefault ?? undefined}
      className={adminHidden || previewMode ? "dashboard-scope--reader" : "dashboard-scope--editor"}
    >
      {adminHidden || previewMode ? (
        previewMode && !adminHidden ? (
          // En vista previa (editor) solo aparece un chip flotante para
          // volver al modo edición. El deploy público nunca muestra
          // controles de edición.
          <button
            type="button"
            className="dash-preview-exit"
            onClick={() => setPreviewMode(false)}
            title="Salir de vista previa (Esc)"
            aria-label="Salir de vista previa"
          >
            <EyeOff size={13} /> Salir de vista previa
          </button>
        ) : null
      ) : (
        <div className="dash-admin-toolbar-wrap dash-editor-commandbar-wrap">
          {/* Capa de edición: interna, nunca visible en modo público. Adopta la
              banda canónica de tres zonas —contexto | edición | salida— igual
              que el resto de los módulos. La fila de secciones de más abajo NO
              la adopta a propósito: esa sí la ve el cliente del estudio y su
              aspecto es una decisión de marca aparte. */}
          <div className="pulso-command-bar dash-admin-toolbar dash-editor-commandbar" role="toolbar" aria-label="Edición del dashboard">
            <div className="dash-admin-toolbar-context">
              {config.last_deploy && (
                <span className="dash-admin-toolbar-deploy-info">
                  Última publicación{" "}
                  <a
                    href={config.last_deploy.url || config.last_deploy.app_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir Space en Hugging Face"
                  >
                    {config.last_deploy.repo_id}
                  </a>
                  {" — "}
                  <RelativeTime iso={config.last_deploy.published_at} />
                </span>
              )}
            </div>
            <div className="dash-admin-toolbar-group" aria-label="Fuente y diseño">
              <button
                type="button"
                disabled={!manifest}
                className={sourceOpen ? "is-active" : ""}
                onClick={() => setSourceOpen((v) => !v)}
                title="Cambiar XLSForm y data del dashboard"
              >
                <UploadCloud size={13} /> Datos
              </button>
              <button
                type="button"
                disabled={!hasDashboardSource}
                onClick={() => setPalettesOpen(true)}
                title="Paletas de colores por lista"
              >
                <Palette size={13} /> Paletas
              </button>
              <button
                type="button"
                disabled={!hasDashboardSource}
                onClick={() => setCustomizeOpen(true)}
                title="Personalizar marca, pestañas y vistas"
              >
                <Settings size={13} /> Personalizar
              </button>
            </div>
            <div className="dash-admin-toolbar-group is-output" aria-label="Previsualización y publicación">
              <button
                type="button"
                disabled={!hasDashboardSource}
                onClick={() => setPreviewMode(true)}
                title="Ver el dashboard como se verá publicado"
              >
                <Eye size={13} /> Vista previa
              </button>
              <button
                type="button"
                disabled={!hasDashboardSource}
                onClick={() => setPublishOpen(true)}
                title={
                  config.last_deploy
                    ? `Re-publicar a ${config.last_deploy.repo_id}`
                    : "Publicar el dashboard como Hugging Face Space"
                }
              >
                <Rocket size={13} /> {config.last_deploy ? "Re-publicar" : "Deploy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editorChromeVisible && (
        <div className="dash-editor-dashboard-divider" aria-hidden="true" />
      )}

      <DashboardHeader />
      {manifest && (
        <span
          hidden
          data-audit-ready="dashboard"
          data-audit-has-data={manifest.estado.tiene_data ? "true" : "false"}
          data-audit-has-dimensions={manifest.estado.tiene_dim ? "true" : "false"}
        />
      )}

      {loading && <EmptyState title="Cargando dashboard…" />}
      {error && (
        <EmptyState title="No se pudo cargar el dashboard" subtitle={error} />
      )}

      {manifest && !manifest.estado.tiene_data && adminHidden && (
        // En modo público el server arranca con un .pulso
        // bootstrap. Si llegamos acá sin data es un error de deploy,
        // no del visitante — empty state simple, sin SourceGate.
        <EmptyState
          title="Dashboard no disponible"
          subtitle="Este deploy no tiene datos cargados. Avisa al administrador."
        />
      )}

      {manifest && (!manifest.estado.tiene_data || sourceOpen) && !adminHidden && (
        <DashboardSourceGate
          compact={manifest.estado.tiene_data}
          onCancel={manifest.estado.tiene_data ? () => setSourceOpen(false) : undefined}
          recodVars={recodVarsState.vars}
          onImported={() => {
            setSourceOpen(false);
            setSeccionActiva(null);
            refresh();
            recodVarsState.refresh();
          }}
        />
      )}

      {manifest && manifest.estado.tiene_data && !sourceOpen && !manifest.estado.curacion_confirmed && !adminHidden && (
        <DashboardCurationGate
          onDone={() => {
            setSeccionActiva(null);
            refresh();
          }}
        />
      )}

      {manifest && manifest.estado.tiene_data && !sourceOpen && (manifest.estado.curacion_confirmed || adminHidden) && (
        <>
          <nav
            aria-label="Secciones del dashboard"
            className="dash-tab-nav-wrap dash-section-rail is-public"
          >
            <TabNav
              tabs={visibleTabs}
              activeId={tabActiva}
              onSelect={setTabActiva}
            />
          </nav>
          {unavailableVisibleTabs.length > 0 && !previewMode && !adminHidden && (
            <div className="dash-tab-blocked-hints" role="status" aria-label="Pestañas pendientes">
              {unavailableVisibleTabs.map((tab) => (
                <span key={tab.id}>
                  <strong>{tab.label}</strong>
                  {tab.reason ? `: ${tab.reason}` : ": pendiente de configuración."}
                </span>
              ))}
            </div>
          )}

          <section
            id={`dash-section-${tabActiva}`}
            className="dash-section-workspace"
            role="tabpanel"
            aria-labelledby={`dash-tab-${tabActiva}`}
          >
            <TabContent tab={tabActiva} />
          </section>
        </>
      )}

      {palettesOpen && <DashboardPalettesDialog onClose={() => setPalettesOpen(false)} />}
      {customizeOpen && <DashboardCustomizeDialog onClose={() => setCustomizeOpen(false)} />}
      {publishOpen && (
        <DashboardPublishDialog
          defaultTitle={config.titulo || "pulso-dashboard"}
          lastDeploy={config.last_deploy}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </ThemeProvider>
  );
}

function TabNav({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: DashboardTabId; label: string; available: boolean; reason: string | null }[];
  activeId: DashboardTabId;
  onSelect: (id: DashboardTabId) => void;
}) {
  return (
    <GlidingTabList className="dash-tab-nav" activeKey={activeId} role="tablist">
      {tabs.map((t) => (
        <DashboardSectionTab
          key={t.id}
          tab={t}
          active={t.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </GlidingTabList>
  );
}

function DashboardSectionTab({
  tab,
  active,
  onSelect,
}: {
  tab: { id: DashboardTabId; label: string; available: boolean; reason: string | null };
  active: boolean;
  onSelect: (id: DashboardTabId) => void;
}) {
  const Icon = DASHBOARD_SECTION_ICONS[tab.id];
  return (
    <button
      id={`dash-tab-${tab.id}`}
      type="button"
      role="tab"
      className={`dash-tab ${active ? "is-active" : ""}`}
      disabled={!tab.available}
      aria-selected={active}
      data-gliding-key={tab.id}
      aria-controls={`dash-section-${tab.id}`}
      aria-label={!tab.available && tab.reason ? `${tab.label}. ${tab.reason}` : tab.label}
      data-audit-tab={tab.id}
      data-audit-disabled-reason={!tab.available ? tab.reason ?? "No disponible" : undefined}
      title={!tab.available ? tab.reason ?? undefined : tab.label}
      onClick={() => onSelect(tab.id)}
    >
      <span className="dash-tab-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <span className="dash-tab-label">{tab.label}</span>
    </button>
  );
}

function TabContent({ tab }: { tab: DashboardTabId }) {
  switch (tab) {
    case "resumen":
      return <ResumenTab />;
    case "relaciones":
      return <RelacionTab />;
    case "base_datos":
      return <BaseDatosTab />;
    case "dimensiones":
      return <DimensionesTab />;
  }
}

// Tiempo relativo en español ("hace 5 min", "hace 2 horas", "hace 3 días").
// Para timestamps mayores a 30 días, fallback a fecha absoluta corta.
function RelativeTime({ iso }: { iso: string }) {
  const label = useMemo(() => {
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return iso;
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "hace unos segundos";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} ${diffH === 1 ? "hora" : "horas"}`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `hace ${diffD} ${diffD === 1 ? "día" : "días"}`;
    return new Date(ts).toLocaleDateString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [iso]);
  return <time dateTime={iso} title={new Date(iso).toLocaleString("es-PE")}>{label}</time>;
}
