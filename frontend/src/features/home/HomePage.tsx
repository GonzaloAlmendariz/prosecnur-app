import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FileText, Power, Settings2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutPreset } from "../../lib/layoutPreference";
import { useSession } from "../../lib/SessionContext";
import { coberturaGraficos } from "../graficos/coberturaBases";
import { useProjectShell } from "../project/ProjectShell";
import { useProjectModules } from "../project/ProjectModulesContext";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_CONFIGURACION, PANEL_MODULOS } from "./panelesHome";
import { PANEL_ESTUDIO } from "../estudio/panelEstudio";
import { MissionControl, type ProcState } from "./MissionControl";
import { ModuleCarousel } from "./ModuleCarousel";
import { useNombreOficial } from "./useNombreOficial";
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
    { done: coberturaGraficos(state).hecho },
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
  const panelEstudio = usePanelDireccionable(PANEL_ESTUDIO);
  const { overview, loading, addedSlugs, addModule, removeModule } = useProjectModules();
  // El nombre oficial de la Ficha: encabeza el Home y, si falta, el pie lo avisa junto a «Ficha del estudio».
  const nombreOficial = useNombreOficial();

  const hasModules = addedSlugs.length > 0;

  const picker = useMemo(
    () => ({
      isAdded: (slug: string) => addedSlugs.includes(slug),
      onAdd: addModule,
    }),
    [addedSlugs, addModule],
  );

  // El selector de módulos es un overlay global (<ModulePickerHost/> en el
  // Layout) disparado por `?agregar=1` sobre la ruta actual. Lo abre el "+"
  // del dock de módulos del topbar, visible en toda la app; el home ya no
  // repite ese botón en una fila de cabecera propia.
  let content: ReactNode;
  if (loading && !overview) {
    content = <div className="home-suite"><MissionControlSkeleton /></div>;
  } else if (hasModules && overview) {
    content = (
      <div className="home-suite">
        <MissionControl
          nombreOficial={nombreOficial}
          overview={overview}
          proc={proc}
          addedSlugs={addedSlugs}
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
            Elige los módulos que vas a usar. Luego podrás administrarlos desde el inicio.
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
        onOpenEstudio={panelEstudio.abrir}
        faltaNombreOficial={nombreOficial === ""}
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

/** «app v0.9.6, prosecnur v0.9.6» se lee «v0.9.6» cuando las dos coinciden (5 nov 2026: el pie repetía la versión). */
export function versionLegible(version: string): string {
  const par = /^app v(\S+), prosecnur v(\S+)$/.exec(version.trim());
  return par && par[1] === par[2] ? `v${par[1]}` : version;
}

// =====================================================================
// Footer — versión + autor + abrir notas + cerrar app
// =====================================================================
function HomeFooter({
  version,
  onClose,
  onOpenSettings,
  onOpenEstudio,
  faltaNombreOficial = false,
}: {
  version: string;
  faltaNombreOficial?: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenEstudio: () => void;
}) {
  return (
    <footer className="home-footer">
      <div className="home-footer-attr">
        <span>Prosecnur{version && version !== "…" ? ` ${versionLegible(version)}` : ""}</span>
        <span className="home-footer-sep" aria-hidden="true" />
        <span>Hecho para el {PULSO_FULL_NAME}</span>
        <div style={{ flex: 1 }} />
        {/* 6 nov 2026 (Gonzalo: «es mejor que sea un pop up cuando Ficha de estudio tenga como un lunar
            amarillo» y «¿el aviso no puede estar dentro del popup?»): sin nombre oficial, el botón lleva un lunar
            amarillo y el aviso vive DENTRO de la Ficha que abre (FichaDelEstudio), donde se resuelve. */}
        <span className={`home-footer-ficha${faltaNombreOficial ? " has-aviso" : ""}`}>
          <button
            type="button"
            className="home-footer-notes"
            onClick={onOpenEstudio}
            title={faltaNombreOficial ? "Falta el nombre oficial del estudio" : undefined}
          >
            <FileText size={14} aria-hidden="true" /> Ficha del estudio
            {faltaNombreOficial ? <span className="home-footer-lunar"><span className="pulso-sr-only">Falta el nombre oficial</span></span> : null}
          </button>
        </span>
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
