import "./theme/tokens.css";

import { useEffect, useState } from "react";
import type { DashboardTabId } from "../../api/client";
import { DashboardCurationGate } from "./curation/DashboardCurationGate";
import { DashboardHeader } from "./header/DashboardHeader";
import { DashboardPalettesDialog } from "./palettes/DashboardPalettesDialog";
import { EmptyState } from "./shared/EmptyState";
import { DashboardSourceGate } from "./source/DashboardSourceGate";
import { ResumenTab } from "./tabs/ResumenTab";
import { ThemeProvider } from "./theme/ThemeProvider";
import { useDashboardAutosave, useDashboardStore } from "./store";
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

  const { loading, error, manifest, themeDefault, refresh } = useDashboardManifest();
  const hasDashboardSource = !!manifest?.estado.tiene_data;

  // Si la tab activa deja de estar disponible, fallback a la primera disponible.
  useEffect(() => {
    if (!manifest) return;
    const active = manifest.tabs.find((t) => t.id === tabActiva);
    if (active && active.available) return;
    const first = manifest.tabs.find((t) => t.available);
    if (first) setTabActiva(first.id);
  }, [manifest, tabActiva, setTabActiva]);

  return (
    <ThemeProvider
      paletaId={config.paleta_id}
      colorPrimarioOverride={config.color_primario_override}
      themeDefault={themeDefault ?? undefined}
    >
      <DashboardHeader
        onImportarClick={manifest ? () => setSourceOpen((v) => !v) : undefined}
        onPaletasClick={hasDashboardSource ? () => setPalettesOpen(true) : undefined}
      />

      {loading && <EmptyState title="Cargando dashboard…" />}
      {error && (
        <EmptyState title="No se pudo cargar el dashboard" subtitle={error} />
      )}

      {manifest && (!manifest.estado.tiene_data || sourceOpen) && (
        <DashboardSourceGate
          compact={manifest.estado.tiene_data}
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
            <div className="dash-tab-nav">
              {manifest.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`dash-tab ${t.id === tabActiva ? "is-active" : ""}`}
                  disabled={!t.available}
                  title={!t.available ? t.reason ?? undefined : t.label}
                  onClick={() => setTabActiva(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          <TabContent tab={tabActiva} />
        </>
      )}

      {palettesOpen && <DashboardPalettesDialog onClose={() => setPalettesOpen(false)} />}
    </ThemeProvider>
  );
}

function TabContent({ tab }: { tab: DashboardTabId }) {
  switch (tab) {
    case "resumen":
      return <ResumenTab />;
    case "relaciones":
      return (
        <EmptyState
          title="Relaciones — próximamente"
          subtitle="Esta pestaña se implementará en la próxima fase."
        />
      );
    case "base_datos":
      return (
        <EmptyState
          title="Base de datos — próximamente"
          subtitle="Esta pestaña se implementará en la próxima fase."
        />
      );
    case "dimensiones":
      return (
        <EmptyState
          title="Dimensiones — próximamente"
          subtitle="Esta pestaña se implementará en la próxima fase."
        />
      );
  }
}
