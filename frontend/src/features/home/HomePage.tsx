import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Power, Settings2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutPreset } from "../../lib/layoutPreference";
import { useSession } from "../../lib/SessionContext";
import { useProjectShell } from "../project/ProjectShell";
import { useProjectModules } from "../project/ProjectModulesContext";
import { GlobalSettingsDialog } from "./GlobalSettingsDialog";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_CONFIGURACION, PANEL_MODULOS } from "./panelesHome";
import { MissionControl, type ProcState } from "./MissionControl";
import { ModuleCarousel } from "./ModuleCarousel";
import { RELEASE_NOTES } from "./releaseNotes";
import "./home-v2.css";

// Home — menú principal de Prosecnur.
//
// Los 8 módulos son herramientas independientes (no fases obligatorias
// de un flujo): un usuario puede usar Hojas de Ruta sin haber tocado
// Procesamiento. El layout y el peso visual reflejan esa independencia.
//
// Layout:
//   1. ModulesDeck — carrusel cinematográfico con detalle visible.
//   2. Footer — atribución, notas, cerrar.
//   3. Drawer lateral derecho — historial completo de release notes.
//
// Los estilos viven en `app/theme.css` con prefijo `.home-*`.
// El motion reusa los tokens centralizados (--motion-dur-*, --motion-ease-out).

// ---- Atribución ------------------------------------------------------
export const PULSO_FULL_NAME =
  "Instituto de Analítica Social e Inteligencia Estratégica de la Pontificia Universidad Católica del Perú (PULSO PUCP)";

// ---- Estado del módulo "Procesamiento" ------------------------------
function useProcesamientoState(): ProcState {
  const { state } = useSession();
  const phases = [
    { done: !!state?.xlsform && !!state?.data },
    { done: !!state?.auditoria_run },
    { done: !!state?.codif_aplicado },
    { done: !!state?.analitica_prep_ok },
    { done: !!state?.graficos_ppt_ok || !!state?.graficos_word_ok },
  ];
  let done = 0;
  for (const phase of phases) {
    if (!phase.done) break;
    done += 1;
  }
  // Sub-salidas de Analítica generadas (progreso característico dentro de la fase).
  const analiticaFlags = [
    state?.analitica_codebook_ok,
    state?.analitica_frecuencias_ok,
    state?.analitica_cruces_ok,
    state?.analitica_dim_ok,
    state?.analitica_panel_ok,
    state?.analitica_ficha_tecnica_ok,
    state?.analitica_spss_ok,
    state?.analitica_enumeradores_ok,
    state?.analitica_multibase_ok,
  ];
  return {
    done,
    total: phases.length,
    analiticaDone: analiticaFlags.filter(Boolean).length,
    analiticaTotal: analiticaFlags.length,
    ppt: !!state?.graficos_ppt_ok,
    word: !!state?.graficos_word_ok,
  };
}

// =====================================================================
// Componente principal
// =====================================================================
export default function HomePage() {
  const { version } = useSession();
  const { requestAppExit } = useProjectShell();
  const location = useLocation();
  const navigate = useNavigate();
  const proc = useProcesamientoState();
  const [layoutPreset] = useLayoutPreset();
  // Configuración y selector de módulos son paneles direccionables
  // (`?panel=configuracion`, `?panel=modulos`): se alcanzan por enlace, no
  // solo por click. Los `?settings=` y `?agregar=1` viejos siguen entrando
  // como alias.
  const panelConfiguracion = usePanelDireccionable(PANEL_CONFIGURACION);
  const panelModulos = usePanelDireccionable(PANEL_MODULOS);
  const { overview, loading, addedSlugs, addModule, removeModule } = useProjectModules();

  const hasModules = addedSlugs.length > 0;

  const picker = useMemo(
    () => ({
      isAdded: (slug: string) => addedSlugs.includes(slug),
      onAdd: addModule,
      onRemove: removeModule,
    }),
    [addedSlugs, addModule, removeModule],
  );

  // El selector de módulos es un overlay global (<ModulePickerHost/> en el
  // Layout) disparado por `?agregar=1` sobre la ruta actual. Desde el home la
  // ruta es `/`; preservamos los params existentes al abrirlo.
  function openPicker() {
    panelModulos.abrir();
  }

  let content: ReactNode;
  if (loading && !overview) {
    content = <div className="home-suite"><MissionControlSkeleton /></div>;
  } else if (hasModules && overview) {
    content = (
      <div className="home-suite">
        <MissionControl
          overview={overview}
          proc={proc}
          addedSlugs={addedSlugs}
          onAddModule={openPicker}
          onRemoveModule={removeModule}
        />
      </div>
    );
  } else {
    content = (
      <div className="home-setup">
        <header className="home-setup-head">
          <p className="home-setup-kicker">Nuevo proyecto</p>
          <h1>Arma tu proyecto</h1>
          <p className="home-setup-sub">
            Elige los módulos que vas a usar. Puedes sumar o quitar módulos cuando quieras.
          </p>
        </header>
        <ModuleCarousel picker={picker} />
      </div>
    );
  }

  return (
    <div className="home-wrap" data-layout-preset={layoutPreset} data-home-mode={hasModules ? "mission" : "setup"}>
      {content}

      <HomeFooter
        version={version}
        onClose={requestAppExit}
        onOpenSettings={panelConfiguracion.abrir}
      />

      <GlobalSettingsDialog
        open={panelConfiguracion.abierto}
        notes={RELEASE_NOTES}
        pulsoName={PULSO_FULL_NAME}
        onClose={panelConfiguracion.cerrar}
      />
    </div>
  );
}

// Placeholder discreto mientras resuelve el overview (solo cuando la señal
// optimista ya indicó proyecto en curso, para no parpadear al carrusel).
function MissionControlSkeleton() {
  return (
    <section className="home-mission is-loading" aria-hidden="true">
      <div className="home-mission-metrics">
        {[0, 1, 2, 3].map((i) => (
          <div className="home-mc-stat is-skeleton" key={i} />
        ))}
      </div>
      <div className="home-mission-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="home-mc-card is-skeleton" key={i} />
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Footer — versión + autor + abrir notas + cerrar app
// =====================================================================
function HomeFooter({
  version,
  onClose,
  onOpenSettings,
}: {
  version: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <footer className="home-footer">
      <div className="home-footer-attr">
        <span>Prosecnur{version && version !== "…" ? ` · ${version}` : ""}</span>
        <span aria-hidden="true">·</span>
        <span>Hecho para el {PULSO_FULL_NAME}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="home-footer-notes"
          onClick={onOpenSettings}
        >
          <Settings2 size={14} aria-hidden="true" /> Configuración
        </button>
        <button type="button" className="home-footer-quit" onClick={onClose}>
          <Power size={14} aria-hidden="true" /> Cerrar aplicación
        </button>
      </div>
    </footer>
  );
}
