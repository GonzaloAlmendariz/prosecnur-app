import "./theme/tokens.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Palette, Settings, UploadCloud } from "lucide-react";
import type { DashboardTabId } from "../../api/client";
import { DashboardCurationGate } from "./curation/DashboardCurationGate";
import { DashboardHeader } from "./header/DashboardHeader";
import { DashboardCustomizeDialog } from "./customize/DashboardCustomizeDialog";
import "./customize/customize.css";
import { DashboardPalettesDialog } from "./palettes/DashboardPalettesDialog";
import { EmptyState } from "./shared/EmptyState";
import { DashboardSourceGate } from "./source/DashboardSourceGate";
import { ResumenTab } from "./tabs/ResumenTab";
import { RelacionTab } from "./tabs/RelacionTab";
import { BaseDatosTab } from "./tabs/BaseDatosTab";
import { DimensionesTab } from "./tabs/DimensionesTab";
import { ThemeProvider } from "./theme/ThemeProvider";
import { DEFAULT_TABS_ENABLED, useDashboardAutosave, useDashboardStore } from "./store";
import { useDashboardManifest } from "./useDashboardData";

// Página principal del Dashboard.
// Layout:
//   ┌─────────────────────────────────────────────┐
//   │ Header — logo + título + Personalizar       │
//   ├─────────────────────────────────────────────┤
//   │ Tabs nav — Resumen | Relaciones | Base ...  │
//   ├─────────────────────────────────────────────┤
//   │ Tab content                                 │
//   └─────────────────────────────────────────────┘
//
// La estructura de tabs viene del manifest del paquete (NO editable).
// Las tabs no disponibles aparecen deshabilitadas con tooltip.

export default function DashboardPage() {
  useDashboardAutosave();
  const config = useDashboardStore((s) => s.config);
  const tabActiva = useDashboardStore((s) => s.tabActiva);
  const setTabActiva = useDashboardStore((s) => s.setTabActiva);
  const setSeccionActiva = useDashboardStore((s) => s.setSeccionActiva);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [palettesOpen, setPalettesOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const { loading, error, manifest, themeDefault, refresh } = useDashboardManifest();
  const hasDashboardSource = !!manifest?.estado.tiene_data;

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
    >
      <div className="dash-admin-toolbar-wrap">
        <div className="dash-admin-toolbar" role="toolbar" aria-label="Edición del dashboard">
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
      </div>

      <DashboardHeader />

      {loading && <EmptyState title="Cargando dashboard…" />}
      {error && (
        <EmptyState title="No se pudo cargar el dashboard" subtitle={error} />
      )}

      {manifest && (!manifest.estado.tiene_data || sourceOpen) && (
        <DashboardSourceGate
          compact={manifest.estado.tiene_data}
          onCancel={manifest.estado.tiene_data ? () => setSourceOpen(false) : undefined}
          onImported={() => {
            setSourceOpen(false);
            setSeccionActiva(null);
            refresh();
          }}
        />
      )}

      {manifest && manifest.estado.tiene_data && !sourceOpen && !manifest.estado.curacion_confirmed && (
        <DashboardCurationGate
          onDone={() => {
            setSeccionActiva(null);
            refresh();
          }}
        />
      )}

      {manifest && manifest.estado.tiene_data && !sourceOpen && manifest.estado.curacion_confirmed && (
        <>
          <nav aria-label="Pestañas del dashboard" style={{ marginBottom: 16 }}>
            <TabNav
              tabs={visibleTabs}
              activeId={tabActiva}
              onSelect={setTabActiva}
            />
          </nav>

          <TabContent tab={tabActiva} />
        </>
      )}

      {palettesOpen && <DashboardPalettesDialog onClose={() => setPalettesOpen(false)} />}
      {customizeOpen && <DashboardCustomizeDialog onClose={() => setCustomizeOpen(false)} />}
    </ThemeProvider>
  );
}

// Tab nav con pill animado (legacy: .navbar .nav::before con cubic-bezier).
// Mide el offsetLeft/Width del tab activo y setea CSS vars en el contenedor
// para que el ::before se posicione/anche con transición.
function TabNav({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: DashboardTabId; label: string; available: boolean; reason: string | null }[];
  activeId: DashboardTabId;
  onSelect: (id: DashboardTabId) => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>(".dash-tab.is-active");
    if (!active) {
      nav.style.setProperty("--dash-tab-pill-op", "0");
      return;
    }
    const x = active.offsetLeft;
    const y = active.offsetTop;
    const w = active.offsetWidth;
    const h = active.offsetHeight;
    nav.style.setProperty("--dash-tab-pill-x", `${x}px`);
    nav.style.setProperty("--dash-tab-pill-y", `${y}px`);
    nav.style.setProperty("--dash-tab-pill-w", `${w}px`);
    nav.style.setProperty("--dash-tab-pill-h", `${h}px`);
    nav.style.setProperty("--dash-tab-pill-op", "1");
  }, [activeId, tabs]);

  return (
    <div className="dash-tab-nav" ref={navRef}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`dash-tab ${t.id === activeId ? "is-active" : ""}`}
          disabled={!t.available}
          title={!t.available ? t.reason ?? undefined : t.label}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
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
