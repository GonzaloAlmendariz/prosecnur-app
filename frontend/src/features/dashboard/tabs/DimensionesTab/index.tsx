import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Accessibility,
  BarChart3,
  Blocks,
  BookOpen,
  Building2,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  HandHeart,
  Info,
  Award,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Target,
  Grid3x3,
  ScatterChart,
  type LucideIcon,
  UsersRound,
} from "lucide-react";
import type {
  DashboardDimFodaCuadrante,
  DashboardDimFodaItem,
  DashboardDimFodaPayload,
  DashboardDimMatrizPayload,
  DashboardDimPayload,
  DashboardDimSeccionesPayload,
  DashboardFiltro,
} from "../../../../api/client";
import { apiDashboardDimPayload } from "../../../../api/client";
import {
  DEFAULT_FODA_VIEWS,
  useDashboardStore,
  type DashboardDimVisualMode,
} from "../../store";
import {
  useDimCatalogo,
  useDimCategoriasVar,
  useDimFoda,
  useDimMatriz,
  useDimPayload,
  useDimSeccionesVars,
} from "../../useDashboardData";
import { EmptyState } from "../../shared/EmptyState";
import { FiltrosMultiRow } from "../ResumenTab/FiltrosMultiRow";
import { PlotlyChart } from "../../shared/PlotlyChart";
import {
  FullscreenButton,
  FullscreenScope,
  useFullscreen,
} from "../../shared/FullscreenWrapper";
import {
  colorOfScore as semColorOfScore,
  plotlyColorscale,
  semaforoFromConfig,
} from "../../shared/semaforo";
import "./dimensiones.css";
import "./foda.css";
import { IndicadorAssembly } from "./IndicadorAssembly";
import { MatrizUnidadesView } from "./MatrizUnidadesView";

// Tab Dimensiones — heatmap semáforo + barras / radar / FODA en un único
// visualizador con segmented control. Sidebar consolidado a 2 cards
// (Configuración con segmented Vista/Comparación/Iterar + Filtros).


export function DimensionesTab() {
  const filtros = useDashboardStore((s) => s.filtros);
  const setFiltros = useDashboardStore((s) => s.setFiltros);
  const dim = useDashboardStore((s) => s.dimensiones);
  const fodaIconosEnabled = useDashboardStore((s) => s.config.foda_iconos_enabled ?? true);
  const fodaIconTint = useDashboardStore((s) => s.config.foda_icon_tint ?? "#FFFFFF");
  const fodaIconSize = useDashboardStore((s) => s.config.foda_icon_size ?? 1);
  const fodaIconLegend = useDashboardStore((s) => s.config.foda_icon_legend ?? true);
  const fodaScoreMin = useDashboardStore((s) => s.config.foda_score_min ?? 60);
  const fodaScoreMax = useDashboardStore((s) => s.config.foda_score_max ?? 100);
  const fodaShowTotal = useDashboardStore((s) => s.config.foda_show_total ?? true);
  const fodaSpacing = useDashboardStore((s) => s.config.foda_spacing ?? 1.15);
  const fodaGridIntensity = useDashboardStore((s) => s.config.foda_grid_intensity ?? 0.42);
  const fodaVista = useDashboardStore((s) => s.config.foda_vista ?? "conductores");
  const fodaViews = useDashboardStore((s) => s.config.foda_views ?? DEFAULT_FODA_VIEWS);
  const fodaAliases = useDashboardStore((s) => s.config.foda_aliases ?? {});
  const fodaServiceIcons = useDashboardStore((s) => s.config.foda_service_icons ?? {});
  const desgloseLayout = useDashboardStore((s) => s.config.dim_desglose_layout ?? "paginado");
  const matrizVarColor = useDashboardStore((s) => s.config.matriz_var_color ?? "");
  const matrizVarNombre = useDashboardStore((s) => s.config.matriz_var_nombre ?? "");
  const setDim = useDashboardStore((s) => s.setDimensiones);

  const { loading: loadingCat, error: errCat, payload: catalogo } = useDimCatalogo();
  const { payload: seccionesVars } = useDimSeccionesVars();
  // Colapso manual del sidebar (chevron). En Construcción el sidebar se
  // oculta sin importar este flag. En los demás modos, el usuario puede
  // alternar para ganar espacio horizontal del visualizador.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Construcción es una vista pedagógica plana: no permite comparación,
  // filtros ni iteración. El sidebar entero se oculta en este modo.
  const isConstruccion = dim.visualMode === "construccion";

  // El sidebar entero queda fuera del flujo en Construcción (se oculta sin
  // dejar columna vacía en el grid) o cuando el usuario lo colapsó.
  const sidebarOpen = !isConstruccion && !sidebarCollapsed;

  const objetivos = useMemo(() => {
    if (!catalogo) return [];
    return dim.modo === "general" ? catalogo.general : catalogo.indicadores;
  }, [catalogo, dim.modo]);

  // Auto-seleccionar primer objetivo del modo activo si vacío.
  useEffect(() => {
    if (!objetivos.length) return;
    if (dim.objetivo && objetivos.some((o) => o.id === dim.objetivo)) return;
    setDim({ objetivo: objetivos[0].id });
  }, [objetivos, dim.objetivo, setDim]);

  const filtrosActivos = !isConstruccion && dim.filtrosOn ? filtros : [];
  const iter = !isConstruccion && dim.iterarOn && dim.iterarVar
    ? { var: dim.iterarVar, level: dim.iterarLevel || undefined }
    : null;
  // En Construcción anulamos también cruce/incluirTotal aunque el store los
  // tenga seteados de una vista previa (Heatmap/Barras/etc).
  const cruceEfectivo = isConstruccion ? "" : dim.cruce;
  const incluirTotalEfectivo = isConstruccion ? false : dim.incluirTotal;
  const fodaConfig = useMemo(() => ({
    foda_iconos_enabled: fodaIconosEnabled,
    foda_icon_tint: fodaIconTint,
    foda_icon_size: fodaIconSize,
    foda_icon_legend: fodaIconLegend,
    foda_score_min: fodaScoreMin,
    foda_score_max: fodaScoreMax,
    foda_show_total: fodaShowTotal,
    foda_spacing: fodaSpacing,
    foda_grid_intensity: fodaGridIntensity,
    foda_vista: fodaVista,
    foda_views: fodaViews,
    foda_aliases: fodaAliases,
    foda_service_icons: fodaServiceIcons,
  }), [
    fodaIconosEnabled,
    fodaIconTint,
    fodaIconSize,
    fodaIconLegend,
    fodaScoreMin,
    fodaScoreMax,
    fodaShowTotal,
    fodaSpacing,
    fodaGridIntensity,
    fodaVista,
    fodaViews,
    fodaAliases,
    fodaServiceIcons,
  ]);

  const { loading, error, payload } = useDimPayload({
    modo: dim.modo,
    objetivo: dim.objetivo,
    cruce: cruceEfectivo,
    incluirTotal: incluirTotalEfectivo,
    iter,
    filtros: filtrosActivos,
  });

  const matrizQuery = useDimMatriz({
    enabled: dim.visualMode === "matriz" && Boolean(dim.objetivo) && Boolean(matrizVarColor),
    modo: dim.modo,
    objetivo: dim.objetivo,
    varColor: matrizVarColor,
    varNombre: matrizVarNombre,
    filtros: filtrosActivos,
  });

  const fodaQuery = useDimFoda({
    // "lectura" es una vista virtual del FODA (pedagógica, sin datos
    // reales). No fetcheamos al backend en ese caso — evita re-fetches
    // innecesarios y posibles errores si R no reconoce el slug.
    enabled: dim.visualMode === "foda" && Boolean(dim.objetivo) && fodaVista !== "lectura",
    modo: dim.modo,
    objetivo: dim.objetivo,
    cruce: cruceEfectivo,
    incluirTotal: incluirTotalEfectivo,
    iter,
    filtros: filtrosActivos,
    fodaConfig,
  });

  if (catalogo && !catalogo.ready) {
    return (
      <EmptyState
        title="Genera dimensiones primero"
        subtitle="Esta pestaña requiere índices y subíndices construidos. Ve a Analítica → Dimensiones."
      />
    );
  }

  return (
    <div className="dash-resumen-layout" data-sidebar={sidebarOpen ? "open" : "closed"}>
      {/* ───── Sidebar unificado ─────
          Un solo card con secciones apiladas y header propio (incluye el
          toggle de colapso). Reemplaza el viejo split en dos cards
          (ConfiguracionCard + Filtros) que se sentía como islas. */}
      <aside className="dash-sidebar" aria-hidden={!sidebarOpen}>
        <DimensionesSidebar
          dim={dim}
          setDim={setDim}
          objetivos={objetivos}
          loadingCat={loadingCat}
          errCat={errCat}
          secciones={seccionesVars?.secciones ?? []}
          filtros={filtros}
          setFiltros={setFiltros}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      </aside>

      {/* ───── Main — VisualizadorCard ───── */}
      <main>
        {/* Botón flotante para reabrir el sidebar cuando el usuario lo
            cerró manualmente. No aparece en Construcción (ahí el sidebar
            se oculta por diseño y no hay nada que reabrir). */}
        {!isConstruccion && !sidebarOpen && (
          <button
            type="button"
            className="dash-dim-sidebar-reopen"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Mostrar panel lateral"
            title="Mostrar panel lateral"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
        {!dim.objetivo ? (
          <EmptyState
            icon={<Target size={32} aria-hidden="true" />}
            title="Selecciona un indicador"
            subtitle="Elige un índice o subíndice del panel lateral para ver las dimensiones."
          />
        ) : (
          <VisualizadorCard
            dim={dim}
            setDim={setDim}
            payload={payload}
            payloadLoading={loading}
            payloadError={error}
            foda={fodaQuery.payload}
            fodaLoading={fodaQuery.loading}
            fodaError={fodaQuery.error}
            matriz={matrizQuery.payload}
            matrizLoading={matrizQuery.loading}
            matrizError={matrizQuery.error}
            matrizVarColor={matrizVarColor}
            desgloseLayout={desgloseLayout}
            filtrosActivos={filtrosActivos}
            cruceEfectivo={cruceEfectivo}
            incluirTotalEfectivo={incluirTotalEfectivo}
          />
        )}
        <div style={{ height: 48 }} aria-hidden="true" />
      </main>
    </div>
  );
}

// =============================================================================
// Sidebar unificado — un solo card con secciones apiladas
// =============================================================================
// Reemplaza el viejo ConfiguracionCard (que abría 3 paneles tipo tab) +
// la card de Filtros separada. Ahora todo vive en un solo card vertical
// con header propio (título + chevron de colapso) y secciones que se
// activan progresivamente: ① Indicador → ② Comparar → ③ Desglosar → ④ Filtrar.
// El switch de cada sección hace de propio título cuando aplica (no hay
// doble encabezado, como pasaba en Filtros).

function DimensionesSidebar({
  dim,
  setDim,
  objetivos,
  loadingCat,
  errCat,
  secciones,
  filtros,
  setFiltros,
  onCollapse,
}: {
  dim: ReturnType<typeof useDashboardStore.getState>["dimensiones"];
  setDim: (p: Partial<typeof dim>) => void;
  objetivos: { id: string; label: string; n_axes: number }[];
  loadingCat: boolean;
  errCat: string | null;
  secciones: DashboardDimSeccionesPayload["secciones"];
  filtros: DashboardFiltro[];
  setFiltros: (f: DashboardFiltro[]) => void;
  onCollapse: () => void;
}) {
  const hasCruce = dim.cruce.length > 0;

  return (
    <section className="dash-cardbox dash-dim-sidebar-card">
      <div className="dash-dim-sidebar-head">
        <div className="dash-dim-sidebar-head-text">
          <h2 className="dash-cardbox-title">Configuración</h2>
          <p className="dash-dim-sidebar-head-help">
            Ajusta qué se muestra y cómo comparar.
          </p>
        </div>
        <button
          type="button"
          className="dash-dim-sidebar-collapse"
          onClick={onCollapse}
          aria-label="Ocultar panel lateral"
          title="Ocultar panel"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* ── ① Indicador ── */}
      <SidebarSection
        title="Indicador"
        helper="Qué quieres ver."
      >
        <PanelVista
          modo={dim.modo}
          objetivo={dim.objetivo}
          objetivos={objetivos}
          loading={loadingCat}
          error={errCat}
          onModo={(m) =>
            setDim({
              modo: m,
              objetivo: "",
              // Construcción solo aplica a modo general — si pasamos a
              // indicadores estando en construcción, fallback a heatmap.
              ...(m === "indicadores" && dim.visualMode === "construccion"
                ? { visualMode: "heatmap" as const }
                : {}),
            })
          }
          onObjetivo={(id) => setDim({ objetivo: id })}
        />
      </SidebarSection>

      {/* ── ② Comparar grupos ── */}
      <SidebarSection
        title="Comparar grupos"
        helper="Divide el resultado por una variable (ej. distrito o servicio)."
        toggle={{
          on: hasCruce,
          onChange: (on) => {
            if (!on) {
              // Apagar comparación arrastra apagar también el desglose,
              // que solo tiene sentido como segundo nivel.
              setDim({ cruce: "", iterarOn: false, iterarVar: "", iterarLevel: "" });
            }
          },
          ariaLabel: "Activar comparación",
          // Apagar el toggle es siempre OK; encender requiere elegir variable
          // primero (no abrimos el toggle solo, dejamos que el select lo
          // active al elegir un valor).
          allowToggleOn: false,
        }}
      >
        <PanelComparacion
          secciones={secciones}
          cruce={dim.cruce}
          incluirTotal={dim.incluirTotal}
          onCruce={(v) => {
            // Si quitan el cruce, también limpian iteración (no hay segundo
            // nivel sin primer nivel).
            if (!v) {
              setDim({ cruce: "", iterarOn: false, iterarVar: "", iterarLevel: "" });
            } else {
              setDim({ cruce: v });
            }
          }}
          onIncluirTotal={(b) => setDim({ incluirTotal: b })}
        />
      </SidebarSection>

      {/* ── ③ Desglosar (segundo nivel) ── */}
      <SidebarSection
        title="Desglosar por"
        helper={
          hasCruce
            ? "Agrega un segundo corte sobre la comparación."
            : "Disponible cuando hayas elegido una variable para comparar."
        }
        disabled={!hasCruce}
        toggle={{
          on: dim.iterarOn,
          onChange: (on) =>
            setDim({
              iterarOn: on,
              ...(on ? {} : { iterarVar: "", iterarLevel: "" }),
            }),
          ariaLabel: "Activar segundo nivel",
          allowToggleOn: hasCruce,
        }}
      >
        {dim.iterarOn && (
          <PanelIterar
            secciones={secciones}
            enabled={dim.iterarOn}
            variable={dim.iterarVar}
            level={dim.iterarLevel}
            excludeVar={dim.cruce}
            onToggle={(on) => setDim({ iterarOn: on })}
            onVariable={(v) => setDim({ iterarVar: v, iterarLevel: "" })}
            onLevel={(l) => setDim({ iterarLevel: l })}
          />
        )}
      </SidebarSection>

      {/* ── ④ Filtrar muestra ── */}
      <SidebarSection
        title="Filtrar muestra"
        helper="Limita los datos a un subgrupo."
        toggle={{
          on: dim.filtrosOn,
          onChange: (on) => setDim({ filtrosOn: on }),
          ariaLabel: "Activar filtros",
          allowToggleOn: true,
        }}
      >
        {dim.filtrosOn && (
          <FiltrosMultiRow
            secciones={secciones.map((s) => ({
              nombre: s.nombre,
              vars: s.vars.map((v) => ({ name: v.name, label: v.label, tipo: "so" as const })),
            }))}
            // El switch de filtros vive en el header de la sección, no
            // queremos que FiltrosMultiRow renderee su propio toggle ni
            // su título. Le pasamos enabled=true y un onToggle no-op para
            // que solo muestre las filas (el componente ya es así cuando
            // headless={true}).
            enabled
            onToggleEnabled={() => undefined}
            onChange={setFiltros}
            headless
          />
        )}
      </SidebarSection>
    </section>
  );
}

// SidebarSection — un bloque del sidebar con título, helper opcional y
// switch propio. Reemplaza el patrón viejo "card aparte con su propio
// header". Cuando hay toggle, el título incluye el switch a la derecha.
function SidebarSection({
  title,
  helper,
  toggle,
  disabled,
  children,
}: {
  title: string;
  helper?: string;
  toggle?: {
    on: boolean;
    onChange: (on: boolean) => void;
    ariaLabel: string;
    /** Si false, el toggle se muestra pero no permite encender desde
     * cero (típico cuando encender requiere elegir algo primero, p.ej.
     * "Comparar" se enciende cuando seleccionas una variable, no cuando
     * tocas el switch). Apagar siempre se permite. */
    allowToggleOn: boolean;
  };
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`dash-dim-sidebar-section ${disabled ? "is-disabled" : ""} ${toggle?.on ? "is-on" : ""}`}
    >
      <div className="dash-dim-sidebar-section-head">
        <div className="dash-dim-sidebar-section-head-text">
          <h3 className="dash-dim-sidebar-section-title">{title}</h3>
          {helper && <p className="dash-dim-sidebar-section-help">{helper}</p>}
        </div>
        {toggle && (
          <label className="dash-switch" title={toggle.ariaLabel}>
            <input
              type="checkbox"
              checked={toggle.on}
              disabled={disabled || (!toggle.on && !toggle.allowToggleOn)}
              onChange={(e) => toggle.onChange(e.target.checked)}
              aria-label={toggle.ariaLabel}
            />
            <span className="dash-switch-slider" />
          </label>
        )}
      </div>
      {children && <div className="dash-dim-sidebar-section-body">{children}</div>}
    </div>
  );
}

function PanelVista({
  modo,
  objetivo,
  objetivos,
  loading,
  error,
  onModo,
  onObjetivo,
}: {
  modo: "general" | "indicadores";
  objetivo: string;
  objetivos: { id: string; label: string; n_axes: number }[];
  loading: boolean;
  error: string | null;
  onModo: (m: "general" | "indicadores") => void;
  onObjetivo: (id: string) => void;
}) {
  return (
    <>
      <label className="dash-dim-label">Modo</label>
      <div className="dash-source-segments" role="tablist" aria-label="Modo de vista">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "general"}
          className={`dash-source-segment ${modo === "general" ? "is-active" : ""}`}
          onClick={() => onModo("general")}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "indicadores"}
          className={`dash-source-segment ${modo === "indicadores" ? "is-active" : ""}`}
          onClick={() => onModo("indicadores")}
        >
          Indicadores
        </button>
      </div>
      <label htmlFor="dim-objetivo" className="dash-dim-label" style={{ marginTop: 12 }}>
        Objetivo
      </label>
      {loading ? (
        <p className="dash-cardbox-help">Cargando catálogo…</p>
      ) : error ? (
        <p className="dash-cardbox-help">{error}</p>
      ) : !objetivos.length ? (
        <p className="dash-cardbox-help">Sin objetivos en este modo.</p>
      ) : (
        <select
          id="dim-objetivo"
          className="dash-select"
          value={objetivo}
          onChange={(e) => onObjetivo(e.target.value)}
        >
          {objetivos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.n_axes} ejes)
            </option>
          ))}
        </select>
      )}
    </>
  );
}

function PanelComparacion({
  secciones,
  cruce,
  incluirTotal,
  onCruce,
  onIncluirTotal,
}: {
  secciones: DashboardDimSeccionesPayload["secciones"];
  cruce: string;
  incluirTotal: boolean;
  onCruce: (v: string) => void;
  onIncluirTotal: (b: boolean) => void;
}) {
  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of secciones) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [secciones]);

  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[cruce] || (secciones[0]?.nombre ?? "");
  const seccionActiva = secciones.find((s) => s.nombre === seccion);

  if (!secciones.length) {
    return <p className="dash-cardbox-help">Sin variables de cruce.</p>;
  }

  return (
    <>
      <label htmlFor="dim-cmp-seccion" className="dash-dim-label">Sección</label>
      <select
        id="dim-cmp-seccion"
        className="dash-select"
        value={seccion}
        onChange={(e) => {
          setSeccionLocal(e.target.value);
          onCruce("");
        }}
      >
        {secciones.map((s) => (
          <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
        ))}
      </select>
      <label htmlFor="dim-cmp-var" className="dash-dim-label" style={{ marginTop: 8 }}>
        Variable
      </label>
      <select
        id="dim-cmp-var"
        className="dash-select"
        value={cruce}
        onChange={(e) => onCruce(e.target.value)}
      >
        <option value="">Selecciona una…</option>
        {seccionActiva?.vars.map((v) => (
          <option key={v.name} value={v.name}>{v.label}</option>
        ))}
      </select>
      <label className="dash-switch-row">
        <span className="dash-switch-row-text">
          Mostrar también el promedio total
        </span>
        <span className="dash-switch">
          <input
            type="checkbox"
            checked={incluirTotal}
            onChange={(e) => onIncluirTotal(e.target.checked)}
            aria-label="Mostrar también el promedio total"
          />
          <span className="dash-switch-slider" />
        </span>
      </label>
    </>
  );
}

function PanelIterar({
  secciones,
  enabled,
  variable,
  level,
  excludeVar,
  onToggle,
  onVariable,
  onLevel,
}: {
  secciones: DashboardDimSeccionesPayload["secciones"];
  enabled: boolean;
  variable: string;
  level: string;
  excludeVar: string;
  onToggle: (on: boolean) => void;
  onVariable: (v: string) => void;
  onLevel: (l: string) => void;
}) {
  const seccionesElegibles = useMemo(
    () => secciones.map((s) => ({
      ...s,
      vars: s.vars.filter((v) => v.name !== excludeVar),
    })).filter((s) => s.vars.length > 0),
    [secciones, excludeVar],
  );

  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of seccionesElegibles) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [seccionesElegibles]);

  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[variable] || (seccionesElegibles[0]?.nombre ?? "");
  const seccionActiva = seccionesElegibles.find((s) => s.nombre === seccion);

  const { valores: niveles } = useDimCategoriasVar(enabled && variable ? variable : null);

  useEffect(() => {
    if (!enabled || !variable) return;
    if (level && niveles.some((n) => n.value === level)) return;
    if (niveles.length) onLevel(niveles[0].value);
  }, [enabled, variable, level, niveles, onLevel]);

  // El toggle "Activar iteración" ahora vive en el header de la sección
  // (DimensionesSidebar). Aquí solo renderizamos el contenido cuando está
  // habilitada — el switch externo controla `enabled`.
  return (
    <>
      {enabled && (
        <>
          <label htmlFor="dim-it-seccion" className="dash-dim-label">Sección</label>
          <select
            id="dim-it-seccion"
            className="dash-select"
            value={seccion}
            onChange={(e) => {
              setSeccionLocal(e.target.value);
              onVariable("");
            }}
          >
            {seccionesElegibles.map((s) => (
              <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
            ))}
          </select>
          <label htmlFor="dim-it-var" className="dash-dim-label" style={{ marginTop: 8 }}>
            Variable
          </label>
          <select
            id="dim-it-var"
            className="dash-select"
            value={variable}
            onChange={(e) => onVariable(e.target.value)}
          >
            <option value="">Selecciona una…</option>
            {seccionActiva?.vars.map((v) => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
          {variable && niveles.length > 0 && (
            <DimIterLevelControl niveles={niveles} level={level} onLevel={onLevel} />
          )}
        </>
      )}
    </>
  );
}

function DimIterLevelControl({
  niveles,
  level,
  onLevel,
}: {
  niveles: { value: string; label: string; base?: number }[];
  level: string;
  onLevel: (l: string) => void;
}) {
  const idx = Math.max(0, niveles.findIndex((n) => n.value === level));
  const current = niveles[idx] ?? niveles[0];
  const prev = niveles[(idx - 1 + niveles.length) % niveles.length];
  const next = niveles[(idx + 1) % niveles.length];

  return (
    <div className="dash-dim-iter-level" aria-label="Nivel de iteración">
      <label htmlFor="dim-it-level" className="dash-dim-label">
        Nivel
      </label>
      <div className="dash-iter-stepper is-sidebar" role="group">
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onLevel(prev.value)}
          aria-label={`Anterior: ${prev.label}`}
          title={`Anterior: ${prev.label}`}
        >
          <ChevronLeft size={14} />
        </button>
        <select
          id="dim-it-level"
          className="dash-iter-stepper-select"
          value={current.value}
          onChange={(e) => onLevel(e.target.value)}
        >
          {niveles.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label} (n={Math.round(n.base ?? 0)})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onLevel(next.value)}
          aria-label={`Siguiente: ${next.label}`}
          title={`Siguiente: ${next.label}`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// VisualizadorCard — header con segmented [Heatmap | Barras | Radar | FODA]
// + body que renderiza el modo activo. Reúne lo que antes eran HeatmapCard
// y MainPlotCard en un solo container.
// =============================================================================

// Payload mínimo para que FodaView pueda renderizar la sub-vista "Lectura"
// (que no consume datos reales) aún cuando el backend no haya devuelto un
// payload de FODA. Mantiene los memos internos contentos sin disparar gates
// de loading o error.
const FODA_LECTURA_FALLBACK_PAYLOAD: DashboardDimFodaPayload = {
  ready: true,
  items: [],
  cortes: { score: 80, sd: 0 },
};

function VisualizadorCard({
  dim,
  setDim,
  payload,
  payloadLoading,
  payloadError,
  foda,
  fodaLoading,
  fodaError,
  matriz,
  matrizLoading,
  matrizError,
  matrizVarColor,
  desgloseLayout,
  filtrosActivos,
  cruceEfectivo,
  incluirTotalEfectivo,
}: {
  dim: ReturnType<typeof useDashboardStore.getState>["dimensiones"];
  setDim: (p: Partial<typeof dim>) => void;
  payload: DashboardDimPayload | null;
  payloadLoading: boolean;
  payloadError: string | null;
  foda: DashboardDimFodaPayload | null;
  fodaLoading: boolean;
  fodaError: string | null;
  matriz: DashboardDimMatrizPayload | null;
  matrizLoading: boolean;
  matrizError: string | null;
  matrizVarColor: string;
  desgloseLayout: "paginado" | "apilado";
  filtrosActivos: DashboardFiltro[];
  cruceEfectivo: string;
  incluirTotalEfectivo: boolean;
}) {
  const visualMode: DashboardDimVisualMode = dim.visualMode;
  const isApilado =
    desgloseLayout === "apilado" &&
    dim.iterarOn &&
    Boolean(dim.iterarVar) &&
    visualMode !== "construccion" &&
    visualMode !== "foda" &&
    visualMode !== "matriz";
  const fodaVista = useDashboardStore((s) => s.config.foda_vista ?? "conductores");
  const fodaVistaIsLectura = fodaVista === "lectura";
  const fs = useFullscreen();
  const maxed = fs.maxed;
  const fsTitle =
    visualMode === "heatmap"
      ? "Heatmap"
      : visualMode === "barras"
      ? "Scores por dimensión"
      : visualMode === "radar"
      ? "Radar de dimensiones"
      : visualMode === "construccion"
      ? "Construcción del indicador"
      : visualMode === "matriz"
      ? "Matriz por unidad"
      : "Matriz FODA";

  return (
    <section className="dash-cardbox dash-dim-vis">
      <div className="dash-dim-vis-header">
        <div className="dash-dim-vis-title">
          <h2 className="dash-cardbox-title">
            {visualMode === "heatmap"
              ? "Heatmap"
              : visualMode === "radar"
              ? "Radar de dimensiones"
              : visualMode === "foda"
              ? "Matriz FODA"
              : visualMode === "matriz"
              ? "Matriz por unidad"
              : visualMode === "construccion"
              ? "Construcción del indicador"
              : "Scores por dimensión"}
          </h2>
          {payload && payload.ready && !isApilado && <SubtituloDim payload={payload} />}
          {!isApilado && dim.iterarOn && dim.iterarVar && (
            <IterStepper
              variable={dim.iterarVar}
              level={dim.iterarLevel}
              onLevel={(l) => setDim({ iterarLevel: l })}
            />
          )}
        </div>
        <div className="dash-dim-vis-segmented" role="tablist" aria-label="Modo de visualización">
          {dim.modo === "general" && (
            <SegmentedItem
              active={visualMode === "construccion"}
              onClick={() => setDim({ visualMode: "construccion" })}
              icon={<Blocks size={13} />}
              label="Construcción"
            />
          )}
          <SegmentedItem
            active={visualMode === "heatmap"}
            onClick={() => setDim({ visualMode: "heatmap" })}
            icon={<Grid3x3 size={13} />}
            label="Heatmap"
          />
          <SegmentedItem
            active={visualMode === "barras"}
            onClick={() => setDim({ visualMode: "barras" })}
            icon={<BarChart3 size={13} />}
            label="Barras"
          />
          <SegmentedItem
            active={visualMode === "radar"}
            onClick={() => setDim({ visualMode: "radar" })}
            icon={<Compass size={13} />}
            label="Radar"
          />
          <SegmentedItem
            active={visualMode === "foda"}
            onClick={() => setDim({ visualMode: "foda" })}
            icon={<ScatterChart size={13} />}
            label="FODA"
          />
          <SegmentedItem
            active={visualMode === "matriz"}
            onClick={() => setDim({ visualMode: "matriz" })}
            icon={<Grid3x3 size={13} />}
            label="Matriz"
          />
          <FullscreenButton ctx={fs} />
        </div>
      </div>

      <FullscreenScope ctx={fs} title={fsTitle}>
        <div
          key={visualMode}
          className={`dash-dim-vis-body ${maxed ? "dash-dim-fullscreen-content" : ""}`}
        >
          {isApilado ? (
            <StackedDesglose
              variable={dim.iterarVar}
              visualMode={visualMode}
              modo={dim.modo}
              objetivo={dim.objetivo}
              cruce={cruceEfectivo}
              incluirTotal={incluirTotalEfectivo}
              filtros={filtrosActivos}
              maxed={maxed}
            />
          ) : visualMode === "matriz" ? (
            // Matriz por unidad — fetch independiente, igual que FODA. Si
            // el usuario no eligió aún variables en Personalizar, mostramos
            // un empty state con CTA en vez de un error críptico.
            !matrizVarColor ? (
              <EmptyState
                title="Configura la Matriz"
                subtitle="Ve a Personalizar → Matriz para elegir la variable de color (ej. Servicio) y opcionalmente la de nombre (ej. Municipio)."
              />
            ) : matrizLoading && !matriz ? (
              <DimSkeleton mode="heatmap" />
            ) : matrizError ? (
              <EmptyState title="No se pudo calcular la matriz" subtitle={matrizError} />
            ) : !matriz || !matriz.ready ? (
              <DimSkeleton mode="heatmap" />
            ) : matriz.error ? (
              <EmptyState title="Sin datos para la matriz" subtitle={matriz.error} />
            ) : (
              <MatrizUnidadesView payload={matriz} />
            )
          ) : visualMode === "foda" ? (
            // Lectura es una vista pedagógica que NO depende del payload
            // del backend — cortocircuitamos los gates de loading/error
            // para que se renderice instantáneamente al hacer click.
            fodaVistaIsLectura ? (
              <FodaView payload={foda ?? FODA_LECTURA_FALLBACK_PAYLOAD} maxed={maxed} />
            ) : fodaLoading && !foda ? (
              <DimSkeleton mode="foda" />
            ) : fodaError ? (
              <EmptyState title="No se pudo calcular FODA" subtitle={fodaError} />
            ) : !foda || !foda.ready ? (
              <DimSkeleton mode="foda" />
            ) : foda.error ? (
              <EmptyState title="Sin datos para FODA" subtitle={foda.error} />
            ) : (
              <FodaView payload={foda} maxed={maxed} />
            )
          ) : payloadLoading && !payload ? (
            <DimSkeleton mode={visualMode} />
          ) : payloadError ? (
            <EmptyState title="No se pudieron calcular las dimensiones" subtitle={payloadError} />
          ) : !payload || !payload.ready ? (
            <DimSkeleton mode={visualMode} />
          ) : payload.error ? (
            <EmptyState title="Sin datos para esta vista" subtitle={payload.error} />
          ) : visualMode === "construccion" ? (
            // Construcción es estrictamente plana: pasamos los valores
            // EFECTIVOS (cruce/incluirTotal/iter neutralizados) desde el
            // padre vía props, NO los del store crudo. Esto evita que el
            // state olvidado de Heatmap/Barras (p.ej. un cruce activo)
            // contamine la vista pedagógica.
            <IndicadorAssembly
              payload={payload}
              modo={dim.modo}
              cruce=""
              incluirTotal={false}
              maxed={maxed}
            />
          ) : visualMode === "heatmap" ? (
            <HeatmapView payload={payload} />
          ) : (
            <MainPlotView payload={payload} visualMode={visualMode} maxed={maxed} />
          )}
        </div>
      </FullscreenScope>
    </section>
  );
}

// Stepper compacto prev/next del nivel actual de iteración. Reemplaza
// la fricción de tener que ir al sidebar para cambiar de nivel.
function IterStepper({
  variable,
  level,
  onLevel,
}: {
  variable: string;
  level: string;
  onLevel: (l: string) => void;
}) {
  const { valores } = useDimCategoriasVar(variable || null);
  const idx = Math.max(0, valores.findIndex((v) => v.value === level));
  const prev = valores[(idx - 1 + Math.max(1, valores.length)) % Math.max(1, valores.length)];
  const next = valores[(idx + 1) % Math.max(1, valores.length)];
  const current = valores[idx];

  // Shortcut Alt+← / Alt+→ para ciclar niveles desde cualquier sitio.
  useEffect(() => {
    if (!valores.length) return;
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onLevel(prev.value);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onLevel(next.value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [valores, prev, next, onLevel]);

  if (!valores.length) return null;
  return (
    <div className="dash-iter-stepper" role="group" aria-label="Cambiar nivel de iteración">
      <button
        type="button"
        className="dash-iter-stepper-btn"
        onClick={() => onLevel(prev.value)}
        aria-label={`Anterior: ${prev.label}`}
        title={`Anterior: ${prev.label}`}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="dash-iter-stepper-info">
        <span className="dash-iter-stepper-label">{current?.label ?? "—"}</span>
        <span className="dash-iter-stepper-meta">
          {idx + 1} / {valores.length}
          {current?.base ? ` · n=${Math.round(current.base)}` : ""}
        </span>
      </div>
      <button
        type="button"
        className="dash-iter-stepper-btn"
        onClick={() => onLevel(next.value)}
        aria-label={`Siguiente: ${next.label}`}
        title={`Siguiente: ${next.label}`}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Desglose apilado — todos los niveles uno debajo del otro, lazy.
// Cada bloque solo dispara su fetch al backend cuando entra al viewport,
// para no martillar al R API con N requests simultáneos en datasets con
// muchas categorías (ej. 20+ distritos).
// ──────────────────────────────────────────────────────────────────────────

function StackedDesglose({
  variable,
  visualMode,
  modo,
  objetivo,
  cruce,
  incluirTotal,
  filtros,
  maxed,
}: {
  variable: string;
  visualMode: DashboardDimVisualMode;
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  filtros: DashboardFiltro[];
  maxed: boolean;
}) {
  const { valores, loading } = useDimCategoriasVar(variable || null);
  if (loading && !valores.length) {
    return <DimSkeleton mode={visualMode} />;
  }
  if (!valores.length) {
    return (
      <EmptyState
        title="Sin valores para desglosar"
        subtitle="La variable seleccionada no tiene categorías para mostrar."
      />
    );
  }
  return (
    <div className="dash-dim-stacked">
      {valores.map((v) => (
        <LazyDesgloseLevelBlock
          key={v.value}
          variable={variable}
          level={v.value}
          label={v.label}
          base={v.base}
          visualMode={visualMode}
          modo={modo}
          objetivo={objetivo}
          cruce={cruce}
          incluirTotal={incluirTotal}
          filtros={filtros}
          maxed={maxed}
        />
      ))}
    </div>
  );
}

// Wrapper lazy: monta DesgloseLevelBlock (que sí hace el fetch) solo cuando
// el placeholder entra al viewport. Una vez visible, se queda montado
// (`once`) para no re-disparar requests al hacer scroll.
function LazyDesgloseLevelBlock(props: {
  variable: string;
  level: string;
  label: string;
  base?: number;
  visualMode: DashboardDimVisualMode;
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  filtros: DashboardFiltro[];
  maxed: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: si el browser no soporta IO, montamos directamente.
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <section ref={ref} className="dash-dim-stacked-block">
      <header className="dash-dim-stacked-block-header">
        <h3 className="dash-dim-stacked-block-title">{props.label}</h3>
        {typeof props.base === "number" && props.base > 0 && (
          <span className="dash-dim-stacked-block-meta">n={Math.round(props.base)}</span>
        )}
      </header>
      {visible ? (
        <DesgloseLevelBlock {...props} />
      ) : (
        <div className="dash-dim-stacked-block-placeholder" aria-hidden="true">
          <DimSkeleton mode={props.visualMode} />
        </div>
      )}
    </section>
  );
}

function DesgloseLevelBlock({
  variable,
  level,
  visualMode,
  modo,
  objetivo,
  cruce,
  incluirTotal,
  filtros,
  maxed,
}: {
  variable: string;
  level: string;
  label: string;
  base?: number;
  visualMode: DashboardDimVisualMode;
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  filtros: DashboardFiltro[];
  maxed: boolean;
}) {
  const { loading, error, payload } = useDimPayload({
    modo,
    objetivo,
    cruce,
    incluirTotal,
    iter: { var: variable, level },
    filtros,
  });

  if (loading && !payload) return <DimSkeleton mode={visualMode} />;
  if (error) return <EmptyState title="No se pudo calcular este nivel" subtitle={error} />;
  if (!payload || !payload.ready) return <DimSkeleton mode={visualMode} />;
  if (payload.error) return <EmptyState title="Sin datos" subtitle={payload.error} />;
  if (visualMode === "heatmap") return <HeatmapView payload={payload} />;
  if (visualMode === "barras" || visualMode === "radar") {
    return <MainPlotView payload={payload} visualMode={visualMode} maxed={maxed} />;
  }
  return null;
}

function SegmentedItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`dash-dim-vis-segment ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// =============================================================================
// HeatmapView — sigue mostrando matriz semáforo, pero ahora dentro del
// VisualizadorCard. Misma lógica de antes.
// =============================================================================

function HeatmapView({ payload }: { payload: DashboardDimPayload }) {
  const heat = payload.score_heat ?? [];
  const semaforo = payload.semaforo!;
  const config = useDashboardStore((s) => s.config);
  const sem = useMemo(
    () =>
      semaforoFromConfig(config, {
        red_color: semaforo.red_color,
        amber_color: semaforo.amber_color,
        green_color: semaforo.green_color,
        red_max: semaforo.red_max,
        amber_max: semaforo.amber_max,
      }),
    [config, semaforo],
  );

  const { traces, layout, axes } = useMemo(() => {
    if (!heat.length) {
      return { traces: [] as unknown[], layout: {}, axes: { x: [] as string[], y: [] as string[] } };
    }
    const xVals = uniqueOrdered(heat.map((r) => r.grupo));
    const yVals = payload.axis_order_heat?.length
      ? [...payload.axis_order_heat]
      : uniqueOrdered(heat.map((r) => r.axis_label));

    const z: (number | null)[][] = yVals.map((axis) =>
      xVals.map((g) => {
        const row = heat.find((r) => r.axis_label === axis && r.grupo === g);
        return row?.score_round ?? null;
      }),
    );
    const text: string[][] = z.map((row) =>
      row.map((v) => (v == null ? "—" : String(Math.round(v)))),
    );

    // Colorscale unificado vía helper compartido (modo y umbrales del config).
    const cs = plotlyColorscale(sem);

    const traces = [
      {
        type: "heatmap" as const,
        x: xVals,
        y: yVals,
        z,
        text,
        texttemplate: "%{text}",
        // Texto blanco con sombra para garantizar contraste sobre ámbar
        // (legibilidad WCAG AA aunque el color base no llegue a ratio puro).
        textfont: { color: "#fff", size: 12, family: "system-ui, sans-serif" },
        hovertemplate:
          "<b>%{y}</b><br>%{x}: %{z:.0f}<extra></extra>",
        zmin: 0,
        zmax: 100,
        colorscale: cs,
        showscale: false,
        xgap: 2,
        ygap: 2,
      },
    ];
    const layout = {
      xaxis: { side: "top", tickfont: { size: 11 }, automargin: true, fixedrange: true },
      yaxis: { autorange: "reversed", tickfont: { size: 11 }, automargin: true, fixedrange: true },
      margin: { t: 40, r: 16, b: 16, l: 16 },
    };
    return { traces, layout, axes: { x: xVals, y: yVals } };
  }, [heat, payload.axis_order_heat, sem]);

  if (!heat.length) {
    return <p className="dash-cardbox-help">Sin datos para mostrar.</p>;
  }

  const altura = Math.min(560, Math.max(280, axes.y.length * 36 + 80));

  return (
    <>
      <PlotlyChart
        data={traces}
        layout={layout}
        height={altura}
        ariaLabel="Heatmap semáforo de dimensiones"
      />
      <div className="dash-dim-heat-legend" aria-label="Leyenda semáforo">
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.red }} />
          0–{sem.redMax - 1} bajo
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.amber }} />
          {sem.redMax}–{sem.amberMax - 1} medio
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.green }} />
          {sem.amberMax}–100 alto
        </span>
      </div>
    </>
  );
}

// =============================================================================
// MainPlotView — barras horizontales o radar.
// =============================================================================

function MainPlotView({
  payload,
  visualMode,
  maxed = false,
}: {
  payload: DashboardDimPayload;
  visualMode: "barras" | "radar";
  maxed?: boolean;
}) {
  const rows = payload.score_plot ?? [];
  const groups = useMemo(() => uniqueOrdered(rows.map((r) => r.grupo)), [rows]);

  // En modo barras: ordenar ejes por score descendente del primer grupo
  // (el grupo de referencia, típicamente "Total"). En modo radar: respetar
  // el orden del payload para no romper la simetría angular.
  const axes = useMemo(() => {
    const fallback = payload.axis_order_plot?.length
      ? [...payload.axis_order_plot]
      : uniqueOrdered(rows.map((r) => r.axis_label));
    if (visualMode !== "barras") return fallback;
    const refGroup = groups[0];
    if (!refGroup) return fallback;
    const scoreByAxis = new Map<string, number>();
    for (const axis of fallback) {
      const row = rows.find((r) => r.axis_label === axis && r.grupo === refGroup);
      scoreByAxis.set(axis, row?.score_round ?? -Infinity);
    }
    // Sort desc por score; los axes sin score (-Infinity) van al final.
    return [...fallback].sort((a, b) => (scoreByAxis.get(b)! - scoreByAxis.get(a)!));
  }, [rows, payload.axis_order_plot, groups, visualMode]);

  const groupColors = payload.group_colors ?? {};
  const semaforo = payload.semaforo;
  const config = useDashboardStore((s) => s.config);
  const radarMin = config.radar_min ?? 0;
  const radarMax = config.radar_max ?? 100;
  const radarGridshape = config.radar_gridshape ?? "linear";
  const radarModo = config.radar_modo ?? "uno";
  const radarAnimado = config.radar_animado ?? true;
  const barrasOrientacion = config.barras_orientacion ?? "horizontal";
  const barrasXMin = config.barras_x_min ?? 0;
  const barrasXMax = config.barras_x_max ?? 100;
  const viewportH = typeof window === "undefined" ? 900 : window.innerHeight;
  // Para modo radar "alternante": índice del grupo activo (cicla entre grupos).
  const [alternanteIdx, setAlternanteIdx] = useState(0);

  // Color del semáforo según el score (cortes/gradiente y umbrales del
  // config personalizable). Helper compartido que también usan heatmap y FODA.
  const colorOfScore = useMemo(() => {
    const sem = semaforoFromConfig(config, semaforo
      ? {
          red_color: semaforo.red_color,
          amber_color: semaforo.amber_color,
          green_color: semaforo.green_color,
          red_max: semaforo.red_max,
          amber_max: semaforo.amber_max,
        }
      : null);
    return (v: number | null | undefined) => semColorOfScore(v, sem);
  }, [config, semaforo]);

  if (!rows.length) {
    return <p className="dash-cardbox-help">Sin datos para graficar.</p>;
  }

  // ── Modo BARRAS ────────────────────────────────────────────────────────
  if (visualMode === "barras") {
    if (barrasOrientacion === "facet") {
      // Facet: divide los axes en dos mitades y renderiza dos filas
      // horizontales (mitad arriba / mitad abajo).
      const half = Math.ceil(axes.length / 2);
      const left = axes.slice(0, half);
      const right = axes.slice(half);
      const facetHeight = maxed ? Math.max(320, (viewportH - 170) / 2) : undefined;
      return (
        <div className="dash-dim-bars-facet">
          <BarrasPlot
            axes={left}
            groups={groups}
            rows={rows}
            groupColors={groupColors}
            orientation="horizontal"
            xMin={barrasXMin}
            xMax={barrasXMax}
            colorOfScore={colorOfScore}
            ariaLabel="Barras facet superior"
            heightOverride={facetHeight}
            showLegend={false}
          />
          <BarrasPlot
            axes={right}
            groups={groups}
            rows={rows}
            groupColors={groupColors}
            orientation="horizontal"
            xMin={barrasXMin}
            xMax={barrasXMax}
            colorOfScore={colorOfScore}
            ariaLabel="Barras facet inferior"
            heightOverride={facetHeight}
            showLegend
          />
        </div>
      );
    }
    return (
      <BarrasPlot
        axes={axes}
        groups={groups}
        rows={rows}
        groupColors={groupColors}
        orientation={barrasOrientacion}
        xMin={barrasXMin}
        xMax={barrasXMax}
        colorOfScore={colorOfScore}
        ariaLabel="Barras de scores"
        heightOverride={maxed ? Math.max(520, viewportH - 130) : undefined}
      />
    );
  }

  // ── Modo RADAR ─────────────────────────────────────────────────────────
  // Si está animado, ordenar axes por score desc del primer grupo (Total).
  const radarAxes = (() => {
    const fallback = payload.axis_order_plot?.length
      ? [...payload.axis_order_plot]
      : uniqueOrdered(rows.map((r) => r.axis_label));
    if (!radarAnimado) return fallback;
    const refGroup = groups[0];
    const scoreByAxis = new Map<string, number>();
    for (const axis of fallback) {
      const row = rows.find((r) => r.axis_label === axis && r.grupo === refGroup);
      scoreByAxis.set(axis, row?.score_round ?? -Infinity);
    }
    return [...fallback].sort((a, b) => (scoreByAxis.get(b)! - scoreByAxis.get(a)!));
  })();

  if (radarModo === "facet" && groups.length > 1) {
    return (
      <div className="dash-dim-radar-facet">
        {groups.map((g) => (
          <RadarPlot
            key={g}
            axes={radarAxes}
            groups={[g]}
            rows={rows}
            groupColors={groupColors}
            radarMin={radarMin}
            radarMax={radarMax}
            gridshape={radarGridshape}
            animado={radarAnimado}
            title={g}
            height={maxed ? 460 : 360}
          />
        ))}
      </div>
    );
  }

  if (radarModo === "alternante" && groups.length > 1) {
    const safeIdx = ((alternanteIdx % groups.length) + groups.length) % groups.length;
    const activeGroup = groups[safeIdx];
    return (
      <>
        <RadarAlternanteToolbar
          groups={groups}
          activeIdx={safeIdx}
          onIdx={setAlternanteIdx}
          colors={groupColors}
        />
        <RadarPlot
          axes={radarAxes}
          groups={[activeGroup]}
          rows={rows}
          groupColors={groupColors}
          radarMin={radarMin}
          radarMax={radarMax}
          gridshape={radarGridshape}
          animado={radarAnimado}
          height={maxed ? Math.max(620, viewportH - 180) : 560}
        />
      </>
    );
  }

  return (
    <RadarPlot
      axes={radarAxes}
      groups={groups}
      rows={rows}
      groupColors={groupColors}
      radarMin={radarMin}
      radarMax={radarMax}
      gridshape={radarGridshape}
      animado={radarAnimado}
      height={maxed ? Math.max(640, viewportH - 140) : 600}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente Barras (h | v) con chip rectangular del semáforo.
// ─────────────────────────────────────────────────────────────────────────────
function BarrasPlot({
  axes,
  groups,
  rows,
  groupColors,
  orientation,
  xMin,
  xMax,
  colorOfScore,
  ariaLabel,
  heightOverride,
  showLegend,
}: {
  axes: string[];
  groups: string[];
  rows: { grupo: string; axis_label: string; score_round: number | null }[];
  groupColors: Record<string, string>;
  orientation: "horizontal" | "vertical";
  xMin: number;
  xMax: number;
  colorOfScore: (v: number | null | undefined) => string | null;
  ariaLabel: string;
  heightOverride?: number;
  showLegend?: boolean;
}) {
  const isV = orientation === "vertical";
  const shouldShowLegend = showLegend ?? groups.length > 1;
  const traces = groups.map((g) => {
    const vals = axes.map((a) => {
      const row = rows.find((x) => x.grupo === g && x.axis_label === a);
      return row?.score_round ?? null;
    });
    return isV
      ? {
          type: "bar" as const,
          name: g,
          orientation: "v" as const,
          x: axes,
          y: vals,
          marker: { color: groupColors[g] ?? undefined },
          hovertemplate: `${g}<br>%{x}: %{y:.0f}<extra></extra>`,
        }
      : {
          type: "bar" as const,
          name: g,
          orientation: "h" as const,
          x: vals,
          y: axes,
          marker: { color: groupColors[g] ?? undefined },
          hovertemplate: `${g}<br>%{y}: %{x:.0f}<extra></extra>`,
        };
  });

  // Chips semáforo al final de cada barra. Plotly barmode="group":
  // ancho_barra = (1 - bargap) / n, offset = (gi - (n-1)/2) * ancho.
  const annotations: unknown[] = [];
  const nGroups = Math.max(1, groups.length);
  const bargap = 0.2;
  const widthPerBar = (1 - bargap) / nGroups;
  for (let gi = 0; gi < groups.length; gi++) {
    const offset = (gi - (nGroups - 1) / 2) * widthPerBar;
    for (let ai = 0; ai < axes.length; ai++) {
      const row = rows.find((r) => r.grupo === groups[gi] && r.axis_label === axes[ai]);
      const v = row?.score_round ?? null;
      if (v == null) continue;
      const color = colorOfScore(v) ?? "#5f6b7a";
      annotations.push({
        x: isV ? ai + offset : v,
        y: isV ? v : ai + offset,
        xref: "x",
        yref: "y",
        text: `<b>${Math.round(v)}</b>`,
        showarrow: false,
        xanchor: isV ? "center" : "left",
        yanchor: isV ? "bottom" : "middle",
        xshift: isV ? 0 : 5,
        yshift: isV ? 4 : 0,
        font: { color: "#fff", size: 10, family: "system-ui, sans-serif" },
        bgcolor: color,
        bordercolor: color,
        borderpad: 3,
        borderwidth: 0,
        opacity: 0.96,
      });
    }
  }

  // Buffer al final del eje numérico para que quepan los chips.
  const buffer = (xMax - xMin) * 0.12;
  const numericRange: [number, number] = [xMin, xMax + buffer];
  const numericTicks = computeTicks(xMin, xMax);

  const layout = isV
    ? {
        barmode: "group",
        xaxis: {
          tickfont: { size: 11 },
          automargin: true,
          tickmode: "array" as const,
          tickvals: axes,
          ticktext: axes,
        },
        yaxis: { range: numericRange, fixedrange: true, tickfont: { size: 11 }, tickvals: numericTicks },
        showlegend: shouldShowLegend,
        legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18 },
        margin: { t: 16, r: 24, b: shouldShowLegend ? 80 : 34, l: 40 },
        annotations,
        bargap: 0.2,
        bargroupgap: 0,
      }
    : {
        barmode: "group",
        xaxis: { range: numericRange, fixedrange: true, tickfont: { size: 11 }, tickvals: numericTicks },
        yaxis: {
          autorange: "reversed",
          tickfont: { size: 11 },
          automargin: true,
          tickmode: "array" as const,
          tickvals: axes,
          ticktext: axes,
        },
        showlegend: shouldShowLegend,
        legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18 },
        margin: { t: 16, r: 24, b: shouldShowLegend ? 50 : 24, l: 24 },
        annotations,
        bargap: 0.2,
        bargroupgap: 0,
      };

  const altura = isV
    ? Math.max(380, axes.length * Math.max(40, groups.length * 22 + 14) * 0.6 + 120)
    : Math.max(360, axes.length * Math.max(40, groups.length * 22 + 14) + 100);

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      height={heightOverride ?? altura}
      ariaLabel={ariaLabel}
    />
  );
}

// Calcula tick values bonitos en un rango [min, max].
function computeTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span <= 30 ? 5 : span <= 60 ? 10 : 20;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  if (!out.length || out[out.length - 1] !== max) out.push(max);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente RadarPlot.
// ─────────────────────────────────────────────────────────────────────────────
function RadarPlot({
  axes,
  groups,
  rows,
  groupColors,
  radarMin,
  radarMax,
  gridshape,
  animado,
  title,
  height = 600,
}: {
  axes: string[];
  groups: string[];
  rows: { grupo: string; axis_label: string; score_round: number | null }[];
  groupColors: Record<string, string>;
  radarMin: number;
  radarMax: number;
  gridshape: "linear" | "circular";
  animado: boolean;
  title?: string;
  height?: number;
}) {
  const traces = groups.map((g) => {
    const r = axes.map((a) => {
      const row = rows.find((x) => x.grupo === g && x.axis_label === a);
      return row?.score_round ?? null;
    });
    const closedTheta = [...axes, axes[0]];
    const closedR = [...r, r[0]];
    const color = groupColors[g] ?? "#0E3B74";
    return {
      type: "scatterpolar" as const,
      mode: "lines+markers",
      name: g,
      theta: closedTheta,
      r: closedR,
      fill: "toself",
      fillcolor: colorToRgba(color, 0.1),
      opacity: 1,
      line: { color, width: 3.2, shape: "linear" as const },
      marker: { color, size: 7, line: { color: "#fff", width: 1.2 } },
      hovertemplate: `<b>${g}</b><br>%{theta}: %{r:.0f}<extra></extra>`,
    };
  });

  const layout = {
    polar: {
      radialaxis: {
        range: [radarMin, radarMax],
        tickfont: { size: 10 },
        fixedrange: true,
        showline: false,
        gridcolor: "rgba(15, 23, 42, 0.08)",
      },
      angularaxis: {
        tickfont: { size: 11 },
        fixedrange: true,
        gridcolor: "rgba(15, 23, 42, 0.08)",
      },
      gridshape,
      bgcolor: "rgba(0,0,0,0)",
    },
    showlegend: groups.length > 1,
    legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.08 },
    margin: { t: title ? 36 : 24, r: 24, b: 50, l: 24 },
    title: title ? { text: title, font: { size: 12 }, x: 0.5, xanchor: "center", y: 0.97 } : undefined,
    transition: animado
      ? { duration: 500, easing: "cubic-in-out" }
      : undefined,
  };

  return (
    <div className={animado ? "dash-dim-radar dash-dim-radar-animado" : "dash-dim-radar"}>
      <PlotlyChart
        data={traces}
        layout={layout}
        height={height}
        ariaLabel={title ? `Radar ${title}` : "Radar de dimensiones"}
      />
    </div>
  );
}

// Toolbar para modo radar alternante: chips clickeables para cada grupo.
function RadarAlternanteToolbar({
  groups,
  activeIdx,
  onIdx,
  colors,
}: {
  groups: string[];
  activeIdx: number;
  onIdx: (i: number) => void;
  colors: Record<string, string>;
}) {
  return (
    <div className="dash-dim-radar-alt-toolbar" role="tablist" aria-label="Alternar grupo del radar">
      {groups.map((g, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dash-dim-radar-alt-chip ${active ? "is-active" : ""}`}
            onClick={() => onIdx(i)}
            style={active && colors[g] ? { ["--alt-accent" as string]: colors[g] } : undefined}
          >
            <span
              className="dash-dim-radar-alt-dot"
              style={{ background: colors[g] ?? "var(--dash-primario)" }}
            />
            {g}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// FodaView — matriz 2×2 + scatter de dispersión, con sub-segmented.
// =============================================================================

const CUADRANTE_LABELS: Record<DashboardDimFodaCuadrante, string> = {
  fortaleza: "Fortalezas",
  oportunidad: "Oportunidades",
  debilidad: "Debilidades",
  amenaza: "Amenazas",
};

const CUADRANTE_DESC: Record<DashboardDimFodaCuadrante, string> = {
  fortaleza: "Score alto · variabilidad baja",
  oportunidad: "Score alto · variabilidad alta",
  debilidad: "Score bajo · variabilidad baja",
  amenaza: "Score bajo · variabilidad alta",
};

function FodaView({
  payload,
  maxed = false,
}: {
  payload: DashboardDimFodaPayload;
  maxed?: boolean;
}) {
  const items = payload.items ?? [];
  const showTotal = useDashboardStore((s) => s.config.foda_show_total ?? true);
  const fodaVista = useDashboardStore((s) => s.config.foda_vista ?? "conductores");
  const fodaViews = useDashboardStore((s) => s.config.foda_views ?? DEFAULT_FODA_VIEWS);
  const setFodaVista = useDashboardStore((s) => s.setFodaVista);
  const activeView = useMemo(
    () => fodaViews.find((view) => view.id === fodaVista) ?? fodaViews[0] ?? DEFAULT_FODA_VIEWS[0],
    [fodaViews, fodaVista],
  );
  const itemKind = payload.item_kind ?? fodaVista ?? "conductores";
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");
  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      if (!showTotal && isFodaTotalItem(it)) continue;
      const label = it.grupo || "Total";
      const key = it.grupo_key || label;
      if (!seen.has(key)) seen.set(key, label);
    }
    const options = [...seen.entries()].map(([key, label]) => ({ key, label }));
    return options.length > 1 ? options : [];
  }, [items, showTotal]);
  useEffect(() => {
    if (!groupOptions.length) setSelectedGroup("__all__");
    if (selectedGroup === "__all__") return;
    if (groupOptions.some((g) => g.key === selectedGroup)) return;
    setSelectedGroup("__all__");
  }, [groupOptions, selectedGroup]);
  const fodaItems = useMemo(
    () => items.filter((it) => {
      if (!showTotal && isFodaTotalItem(it)) return false;
      return true;
    }),
    [items, showTotal],
  );
  const activeItems = useMemo(
    () => fodaItems.filter((it) => {
      if (selectedGroup === "__all__") return true;
      return (it.grupo_key || it.grupo || "Total") === selectedGroup;
    }),
    [fodaItems, selectedGroup],
  );
  const counts = useMemo(
    () => countFodaQuadrants(activeItems),
    [activeItems],
  );

  const isLectura = fodaVista === "lectura";

  return (
    <div className={`dash-foda ${maxed ? "is-fullscreen" : ""}`}>
      <div className="dash-foda-toolbar">
        <div className="dash-foda-view-switch" role="tablist" aria-label="Vista FODA">
          {/* "Lectura" — vista virtual pedagógica que enseña a leer la
              matriz. Va primero para que el usuario nuevo entienda los
              cuadrantes antes de entrar a los datos reales. */}
          <button
            type="button"
            role="tab"
            aria-selected={isLectura}
            className={`dash-source-segment ${isLectura ? "is-active" : ""}`}
            onClick={() => setFodaVista("lectura")}
            title="Cómo leer esta matriz"
          >
            <BookOpen size={12} aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Lectura
          </button>
          {fodaViews.map((view) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={fodaVista === view.id}
              className={`dash-source-segment ${fodaVista === view.id ? "is-active" : ""}`}
              onClick={() => setFodaVista(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
        {!isLectura && (
          <>
            <div className="dash-foda-cortes" aria-label="Cortes FODA">
              <span><strong>Corte score:</strong> {payload.cortes?.score ?? 80}</span>
              <span className="dash-foda-cortes-sep">·</span>
              <span><strong>Corte SD:</strong> {payload.cortes?.sd ?? 0}</span>
            </div>
            {groupOptions.length > 1 && (
              <FodaGroupNav
                options={groupOptions}
                selected={selectedGroup}
                onSelect={setSelectedGroup}
              />
            )}
            <FodaCounts counts={counts} payload={payload} />
          </>
        )}
      </div>
      {isLectura ? (
        <FodaLectura />
      ) : (
        <FodaDispersion
          items={fodaItems}
          payload={payload}
          selectedGroup={selectedGroup}
        />
      )}
    </div>
  );
}

// =============================================================================
// FodaLectura — vista pedagógica antes de entrar a los datos reales.
// =============================================================================
// Anima un avatar que recorre los 4 cuadrantes en C invertida (Fortaleza →
// Oportunidad → Amenaza → Debilidad → loop) explicando qué significa cada
// posición. El recorrido enseña que el eje Y es puntaje (alto = bueno) y el
// eje X es consistencia (izquierda = todos coinciden), de modo que un
// servicio "consistentemente alto" vive arriba-izquierda y uno
// "consistentemente bajo" vive abajo-izquierda.

type FodaLecturaStop = {
  id: DashboardDimFodaCuadrante;
  label: string;
  hint: string;
  // Posición del avatar dentro del board (porcentajes).
  top: number;
  left: number;
};

const FODA_LECTURA_STOPS: FodaLecturaStop[] = [
  {
    id: "fortaleza",
    label: "Fortaleza",
    hint: "Puntaje alto y todos opinan parecido. Es terreno sólido.",
    top: 26,
    left: 26,
  },
  {
    id: "oportunidad",
    label: "Oportunidad",
    hint: "Puntaje alto pero hay grupos que opinan distinto. Espacio para destacar.",
    top: 26,
    left: 74,
  },
  {
    id: "amenaza",
    label: "Amenaza",
    hint: "Puntaje bajo y opiniones divididas. Riesgo a vigilar.",
    top: 74,
    left: 74,
  },
  {
    id: "debilidad",
    label: "Debilidad",
    hint: "Puntaje bajo y consistente. Área a mejorar de forma sistemática.",
    top: 74,
    left: 26,
  },
];

const FODA_LECTURA_INTERVAL_MS = 2400;

function FodaLectura() {
  const [stopIdx, setStopIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setStopIdx((i) => (i + 1) % FODA_LECTURA_STOPS.length);
    }, FODA_LECTURA_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const stop = FODA_LECTURA_STOPS[stopIdx];

  return (
    <div className="dash-foda-lectura">
      <div className="dash-foda-lectura-intro">
        <span className="dash-foda-lectura-eyebrow">Cómo leer la matriz</span>
        <p className="dash-foda-lectura-lead">
          La altura del punto es el <strong>puntaje</strong>: arriba está mejor evaluado.
          La distancia horizontal es la <strong>consistencia</strong>: a la izquierda todos opinan parecido, a la derecha hay desacuerdo.
        </p>
      </div>

      <div className="dash-foda-lectura-frame">
        {/* Banda eje Y — vertical, a la izquierda del board. */}
        <div className="dash-foda-lectura-yaxis" aria-hidden="true">
          <span className="dash-foda-lectura-yaxis-label">Puntaje</span>
          <span className="dash-foda-lectura-yaxis-arrows">
            <span className="dash-foda-lectura-yaxis-pole">Mejor</span>
            <span className="dash-foda-lectura-yaxis-line" />
            <span className="dash-foda-lectura-yaxis-pole">Peor</span>
          </span>
        </div>

        <div
          className="dash-foda-lectura-board"
          role="img"
          aria-label={`Cuadrante activo: ${stop.label}. ${stop.hint}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {FODA_LECTURA_STOPS.map((s, i) => (
            <div
              key={s.id}
              className={`dash-foda-lectura-quad is-${s.id} ${i === stopIdx ? "is-active" : ""}`}
            >
              <span className="dash-foda-lectura-quad-name">{s.label}</span>
            </div>
          ))}
          <div className="dash-foda-lectura-cut is-vertical" aria-hidden="true" />
          <div className="dash-foda-lectura-cut is-horizontal" aria-hidden="true" />

          {/* Trazo C invertida que conecta los 4 stops. SVG sobre el board. */}
          <svg
            className="dash-foda-lectura-path"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M 26 26 H 74 V 74 H 26" />
          </svg>

          {/* Avatar — se mueve entre stops con transition CSS. */}
          <span
            className="dash-foda-lectura-avatar"
            style={{ top: `${stop.top}%`, left: `${stop.left}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Banda eje X — horizontal, debajo del board. */}
        <div className="dash-foda-lectura-xaxis" aria-hidden="true">
          {/* Spacer para alinear con la banda Y de la izquierda. */}
          <span />
          <span className="dash-foda-lectura-xaxis-track">
            <span className="dash-foda-lectura-xaxis-pole">Todos coinciden</span>
            <span className="dash-foda-lectura-xaxis-line" />
            <span className="dash-foda-lectura-xaxis-pole">Opiniones divididas</span>
          </span>
        </div>
        <div className="dash-foda-lectura-xaxis-title">Consistencia entre quienes responden</div>
      </div>

      <div className="dash-foda-lectura-caption">
        <span className="dash-foda-lectura-caption-label">{stop.label}</span>
        <span className="dash-foda-lectura-caption-hint">{stop.hint}</span>
        <div className="dash-foda-lectura-dots" role="tablist" aria-label="Cuadrante en foco">
          {FODA_LECTURA_STOPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === stopIdx}
              className={`dash-foda-lectura-dot ${i === stopIdx ? "is-active" : ""}`}
              onClick={() => setStopIdx(i)}
              aria-label={`Ver ${s.label}`}
              title={s.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Navegador de grupos del FODA — modo doble:
// - Si hay ≤4 grupos: chips horizontales con scroll (no se tapan).
// - Si hay >4 grupos: stepper [‹] [grupo · idx/total] [›] como el de
//   iteración para que no se solapen.
function FodaGroupNav({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const ALL: { key: string; label: string } = { key: "__all__", label: "Todos" };
  const all = [ALL, ...options];
  const useStepper = options.length > 3 || options.some((o) => o.label.length > 18);

  if (useStepper) {
    const idx = Math.max(0, all.findIndex((o) => o.key === selected));
    const prev = all[(idx - 1 + all.length) % all.length];
    const next = all[(idx + 1) % all.length];
    const current = all[idx];
    return (
      <div className="dash-iter-stepper" role="group" aria-label="Cambiar grupo del FODA">
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onSelect(prev.key)}
          aria-label={`Anterior: ${prev.label}`}
          title={`Anterior: ${prev.label}`}
        >
          <ChevronLeft size={14} />
        </button>
        <div className="dash-iter-stepper-info">
          <span className="dash-iter-stepper-label">{current.label}</span>
          <span className="dash-iter-stepper-meta">
            {idx + 1} / {all.length}
          </span>
        </div>
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onSelect(next.key)}
          aria-label={`Siguiente: ${next.label}`}
          title={`Siguiente: ${next.label}`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="dash-foda-group-filter" aria-label="Filtrar FODA por grupo">
      <span>Ver</span>
      <button
        type="button"
        className={selected === "__all__" ? "is-active" : ""}
        onClick={() => onSelect("__all__")}
      >
        Todos
      </button>
      {options.map((g) => (
        <button
          key={g.key}
          type="button"
          className={selected === g.key ? "is-active" : ""}
          onClick={() => onSelect(g.key)}
          title={g.label}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

// Mini-leyenda con counts por cuadrante (reemplaza el header de la matriz).
function FodaCounts({
  counts,
  payload,
}: {
  counts: Record<DashboardDimFodaCuadrante, number>;
  payload: DashboardDimFodaPayload;
}) {
  const semaforo = payload.semaforo!;
  const accent: Record<DashboardDimFodaCuadrante, string> = {
    fortaleza: semaforo.green_color,
    oportunidad: "#1B679D",
    debilidad: semaforo.amber_color,
    amenaza: semaforo.red_color,
  };
  const orden: DashboardDimFodaCuadrante[] = ["fortaleza", "oportunidad", "debilidad", "amenaza"];
  return (
    <div className="dash-foda-counts" aria-label="Conteo por cuadrante">
      {orden.map((q) => (
        <span key={q} className="dash-foda-count-chip">
          <span
            className="dash-foda-count-dot"
            style={{ background: accent[q] }}
            aria-hidden="true"
          />
          <span className="dash-foda-count-label">{CUADRANTE_LABELS[q]}</span>
          <strong>{counts[q] ?? 0}</strong>
        </span>
      ))}
    </div>
  );
}

function FodaDispersion({
  items,
  payload,
  selectedGroup,
}: {
  items: DashboardDimFodaItem[];
  payload: DashboardDimFodaPayload;
  selectedGroup: string;
}) {
  const semaforo = payload.semaforo!;
  const corteScore = payload.cortes?.score ?? 80;
  const corteSd = payload.cortes?.sd ?? 0;
  const config = useDashboardStore((s) => s.config);
  const fodaIconosEnabled = config.foda_iconos_enabled ?? true;
  const fodaIconTint = config.foda_icon_tint ?? "#FFFFFF";
  const fodaIconSize = config.foda_icon_size ?? 1;
  const fodaIconLegend = config.foda_icon_legend ?? true;
  const fodaScoreMin = config.foda_score_min ?? 60;
  const fodaScoreMax = config.foda_score_max ?? 100;
  const fodaSpacing = config.foda_spacing ?? 1.15;
  const fodaGridIntensity = config.foda_grid_intensity ?? 0.42;

  // Card seleccionada por click — abre el popup persistente con detalle
  // expandido (chips agregados + dispersión + n). Cierra con Esc o
  // click fuera del popup.
  const [clickedCard, setClickedCard] = useState<DashboardDimFodaItem | null>(null);
  useEffect(() => {
    if (!clickedCard) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setClickedCard(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clickedCard]);
  const sem = useMemo(
    () => semaforoFromConfig(config, {
      red_color: semaforo.red_color,
      amber_color: semaforo.amber_color,
      green_color: semaforo.green_color,
      red_max: semaforo.red_max,
      amber_max: semaforo.amber_max,
    }),
    [config, semaforo],
  );

  const plot = useMemo(
    () => buildFodaLegacyPlot(
      items,
      payload.group_colors ?? {},
      corteScore,
      corteSd,
      fodaScoreMin,
      fodaScoreMax,
      fodaSpacing,
    ),
    [items, payload.group_colors, corteScore, corteSd, fodaScoreMin, fodaScoreMax, fodaSpacing],
  );
  const iconScale = Math.max(0.5, Math.min(1.8, fodaIconSize));
  const gridAlpha = (0.012 + Math.max(0, Math.min(1, fodaGridIntensity)) * 0.045).toFixed(3);
  const iconLegend = useMemo(
    () => buildFodaIconLegend(items, payload.icon_legend ?? []),
    [items, payload.icon_legend],
  );

  if (!items.length) {
    return <p className="dash-cardbox-help">Sin datos para la dispersión.</p>;
  }

  // Ticks Y: 3 valores (max, corteScore, min) — alineados con la posición
  // del panel. plot.cutY (en %) coincide con corteScore.
  const yTickHigh = Math.round(fodaScoreMax);
  const yTickMid = Math.round(corteScore);
  const yTickLow = Math.round(fodaScoreMin);

  return (
    <>
      <div className="dash-foda-legacy" role="img" aria-label="Dispersión FODA de puntaje y variabilidad">
        <div className="dash-foda-axis-note is-y-high">Mayor puntaje</div>
        <div className="dash-foda-axis-note is-y-low">Menor puntaje</div>
        <div className="dash-foda-yaxis" aria-hidden="true">
          <span className="dash-foda-ytick" style={{ top: "0%" }}>{yTickHigh}</span>
          <span className="dash-foda-ytick" style={{ top: `${plot.cutY}%` }}>{yTickMid}</span>
          <span className="dash-foda-ytick" style={{ top: "100%" }}>{yTickLow}</span>
        </div>
        <div
          className="dash-foda-legacy-panel"
          style={{ ["--dash-foda-grid-alpha" as string]: gridAlpha }}
        >
          <div className="dash-foda-legacy-area-label is-fortaleza">Fortaleza</div>
          <div className="dash-foda-legacy-area-label is-oportunidad">Oportunidad</div>
          <div className="dash-foda-legacy-area-label is-debilidad">Debilidad</div>
          <div className="dash-foda-legacy-area-label is-amenaza">Amenaza</div>
          <div
            className="dash-foda-legacy-cut is-vertical"
            style={{ left: `${plot.cutX}%` }}
            aria-hidden="true"
          />
          <div
            className="dash-foda-legacy-cut is-horizontal"
            style={{ top: `${plot.cutY}%` }}
            aria-hidden="true"
          />
          {plot.points.map((p) => {
            const groupKey = p.grupo_key || p.grupo || "Total";
            const isFiltered = selectedGroup !== "__all__";
            const isActive = !isFiltered || groupKey === selectedGroup;
            const isMuted = isFiltered && !isActive;
            const scoreText = formatFodaMetric(p.score_mean);
            const sdText = formatFodaMetric(p.score_sd);
            const pointKind = p.item_kind ?? payload.item_kind ?? "conductores";
            const cardMode = p.card_mode ?? payload.card_mode ?? (pointKind === "municipios" ? "alias" : "iconos");
            const usePointIcon = fodaIconosEnabled && cardMode !== "alias";
            const cardLabel = (p.card_label || "").trim() || shortAxisLabel(p.axis_label);
            const showGroup = Boolean(p.grupo) && p.grupo_key !== pointKind && p.grupo !== payload.item_label;
            return (
              <div
                key={p.key}
                className={[
                  "dash-foda-legacy-card",
                  !usePointIcon ? "is-alias-card" : "",
                  isFodaTotalItem(p) ? "is-total" : "",
                  isFiltered ? (isActive ? "is-selected-group" : "is-muted-group") : "",
                ].filter(Boolean).join(" ")}
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  background: p.color,
                  ["--dash-foda-icon-scale" as string]: iconScale,
                  ["--dash-foda-card-scale" as string]: iconScale,
                }}
                // En modo cruce, los boxes muted (de otros niveles) no son
                // interactivos: ni hover ni click ni focus. Sin esto el
                // tooltip aparecería sobre boxes que el lector explícitamente
                // filtró, contradiciendo la selección visual.
                tabIndex={isMuted ? -1 : 0}
                aria-hidden={isMuted}
                aria-label={isMuted ? undefined : `${p.axis_label}${showGroup ? `, ${p.grupo}` : ""}. Puntaje ${scoreText}. Desviación ${sdText}. n ${p.n_valid}.`}
                onClick={isMuted ? undefined : () => setClickedCard(p)}
                onKeyDown={isMuted ? undefined : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setClickedCard(p);
                  }
                }}
              >
                <span className="dash-foda-legacy-title">
                  {usePointIcon ? (
                    <FodaAxisIcon
                      label={p.axis_label}
                      src={p.icono_url}
                      tint={fodaIconTint}
                      scale={iconScale}
                    />
                  ) : (
                    cardLabel
                  )}
                </span>
                <span
                  className="dash-foda-legacy-score"
                  style={{ background: semColorOfScore(p.score_mean, sem) ?? sem.green }}
                >
                  {Math.round(p.score_mean)}
                </span>
                <span className="dash-foda-hover-card" role="tooltip">
                  <span className="dash-foda-hover-title">{p.axis_label}</span>
                  {showGroup && (
                    <span className="dash-foda-hover-group">{p.grupo}</span>
                  )}
                  <span className="dash-foda-hover-row">
                    <span>Puntaje</span>
                    <strong>{scoreText}</strong>
                  </span>
                  <span className="dash-foda-hover-row">
                    <span>Desviación</span>
                    <strong>{sdText}</strong>
                  </span>
                  <span className="dash-foda-hover-row">
                    <span>n</span>
                    <strong>{p.n_valid}</strong>
                  </span>
                  <span className="dash-foda-hover-hint">Click para ver detalle</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="dash-foda-axis-note is-x-low">Menor dispersión</div>
        <div className="dash-foda-axis-note is-x-high">Mayor dispersión</div>
        <div className="dash-foda-legacy-xaxis">
          <span>0</span>
          <span>{formatFodaTick(corteSd)}</span>
          <span>{formatFodaTick(plot.xMax)}</span>
        </div>
        <div className="dash-foda-legacy-xtitle">Variabilidad</div>
      </div>
      {plot.groups.length > 1 && (
        <div className="dash-foda-group-legend" aria-label="Leyenda por comparación">
          {plot.groups.map((g) => (
            <span key={g.label} className="dash-foda-group-legend-item">
              <span style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      )}
      {fodaIconosEnabled && fodaIconLegend && Boolean(iconLegend.length) && (() => {
        // Detectar si la vista usa aliases (cards de texto, p.ej. Municipios)
        // en vez de íconos. En ese modo, la leyenda muestra los aliases como
        // chips de texto, NO íconos genéricos del fallback.
        const itemKind = payload.item_kind ?? "conductores";
        const cardMode = payload.card_mode ?? (itemKind === "municipios" ? "alias" : "iconos");
        const useAlias = cardMode === "alias";
        return (
          <div
            className={`dash-foda-icon-legend ${useAlias ? "is-alias" : ""}`}
            aria-label="Leyenda de iconos FODA"
          >
            {iconLegend.map((it) => (
              <span key={it.var} className="dash-foda-icon-legend-item">
                {useAlias ? null : (
                  <FodaAxisIcon
                    label={it.label}
                    src={it.icono_url}
                    tint="var(--dash-primario)"
                    scale={0.75}
                  />
                )}
                <span className="dash-foda-icon-legend-text">{it.label}</span>
              </span>
            ))}
          </div>
        );
      })()}
      {clickedCard && (
        <FodaCardDetailPopup
          item={clickedCard}
          showGroup={!!selectedGroup && !!clickedCard.grupo}
          onClose={() => setClickedCard(null)}
        />
      )}
    </>
  );
}

// Popup persistente que aparece al hacer click en una card del FODA.
// Espejo del hover-card pero modal: vive sobre un backdrop semi-opaco,
// se cierra con Esc, click fuera o el botón ✕. Muestra los chips/items
// que componen el promedio para explicar el puntaje y la dispersión.
function FodaCardDetailPopup({
  item,
  showGroup,
  onClose,
}: {
  item: DashboardDimFodaItem;
  showGroup: boolean;
  onClose: () => void;
}) {
  const score = Number.isFinite(item.score_mean) ? item.score_mean.toFixed(1) : "—";
  const sd = Number.isFinite(item.score_sd) ? item.score_sd.toFixed(1) : "—";
  // Lista de chips agregados — viene del payload (`chips_detail`) si el
  // backend lo expone. Fallback: lista vacía con mensaje pedagógico.
  const chips = (item as { chips_detail?: { label: string; score: number }[] }).chips_detail ?? [];
  return (
    <div
      className="dash-foda-detail-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="dash-foda-detail-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="foda-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dash-foda-detail-head">
          <div>
            <h3 id="foda-detail-title">{item.axis_label}</h3>
            {showGroup && (
              <p className="dash-foda-detail-group">{item.grupo}</p>
            )}
          </div>
          <button
            type="button"
            className="dash-foda-detail-close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ×
          </button>
        </header>
        <div className="dash-foda-detail-metrics">
          <div className="dash-foda-detail-metric">
            <span>Puntaje promedio</span>
            <strong>{score}</strong>
          </div>
          <div className="dash-foda-detail-metric">
            <span>Desviación</span>
            <strong>{sd}</strong>
          </div>
          <div className="dash-foda-detail-metric">
            <span>Respuestas</span>
            <strong>{item.n_valid}</strong>
          </div>
        </div>
        {chips.length > 0 ? (
          <>
            <h4 className="dash-foda-detail-section-title">
              Componentes del promedio ({chips.length})
            </h4>
            <ul className="dash-foda-detail-chips">
              {chips.map((c, i) => (
                <li key={`${c.label}-${i}`}>
                  <span>{c.label}</span>
                  <strong>{c.score.toFixed(1)}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="dash-foda-detail-help">
            El puntaje es el promedio de las preguntas que componen este indicador
            ({item.n_valid} respuestas válidas). La desviación mide qué tan dispersas
            están esas puntuaciones: más alta significa menos consenso entre quienes
            respondieron.
          </p>
        )}
      </div>
    </div>
  );
}

type FodaIconLegendUiItem = {
  var: string;
  label: string;
  icono_url?: string;
};

const FODA_FALLBACK_ICONS: Record<string, LucideIcon> = {
  trato: HandHeart,
  tiempo: Clock3,
  informacion: Info,
  accesibilidad: Accessibility,
  ambiente: Building2,
  ule: Building2,
  ciam: UsersRound,
  demuna: ShieldCheck,
  omaped: Accessibility,
  upsep: BriefcaseBusiness,
  confianza: ShieldCheck,
  comunicacion: MessageCircle,
  calidad: Award,
  default: Target,
};

function FodaAxisIcon({
  label,
  src,
  tint,
  scale,
}: {
  label: string;
  src?: string;
  tint: string;
  scale: number;
}) {
  if (src) return <img src={src} alt="" />;
  const Icon = FODA_FALLBACK_ICONS[fodaIconKey(label)] ?? FODA_FALLBACK_ICONS.default;
  const size = Math.round(18 + Math.max(0.6, Math.min(1.8, scale)) * 8);
  return (
    <Icon
      className="dash-foda-fallback-icon"
      color={tint}
      size={size}
      strokeWidth={2.35}
      aria-hidden="true"
    />
  );
}

function buildFodaIconLegend(
  items: DashboardDimFodaItem[],
  payloadLegend: NonNullable<DashboardDimFodaPayload["icon_legend"]>,
): FodaIconLegendUiItem[] {
  const iconByVar = new Map(payloadLegend.map((it) => [it.var, it.icono_url]));
  // Dedup por axis_label (case-insensitive). Cuando el FODA se cruza con
  // un grupo (ej. Servicios × Municipios), cada combinación llega con
  // `var` distinto (p.ej. `ciam_ate`, `ciam_rimac`...) pero el label de
  // servicio es el mismo ("CIAM"). Si dedupiéramos por var saldrían 6×5
  // entradas en la leyenda — usamos el label que es lo que el lector ve.
  const out = new Map<string, FodaIconLegendUiItem>();
  for (const it of items) {
    const key = (it.axis_label || it.var).toLowerCase().trim();
    if (!key || out.has(key)) continue;
    out.set(key, {
      var: it.var,
      label: it.axis_label,
      icono_url: it.icono_url ?? iconByVar.get(it.var),
    });
  }
  return [...out.values()];
}

function fodaIconKey(label: string): string {
  const s = normalizeSearchText(label);
  if (/trato|atencion|servicio|amabilidad|respeto|personal/.test(s)) return "trato";
  if (/tiempo|espera|rapidez|demora|horario|puntual/.test(s)) return "tiempo";
  if (/info|informacion|comunicacion|orientacion|claridad/.test(s)) return "informacion";
  if (/acces|facil|discap|inclusion|tramite/.test(s)) return "accesibilidad";
  if (/ambi|ambiente|infra|espacio|local|instalac|comodidad/.test(s)) return "ambiente";
  if (/\bule\b|unidad local|empadron/.test(s)) return "ule";
  if (/\bciam\b|adulto mayor|mayor/.test(s)) return "ciam";
  if (/\bdemuna\b|nina|nino|adolesc|familia/.test(s)) return "demuna";
  if (/\bomaped\b|discapacidad|conadis/.test(s)) return "omaped";
  if (/\bupsep\b|empleo|trabajo|bolsa/.test(s)) return "upsep";
  if (/confianza|seguridad|transparen|cumpl/.test(s)) return "confianza";
  if (/calidad|satisf|resultado|efectiv/.test(s)) return "calidad";
  return "default";
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isFodaTotalItem(it: Pick<DashboardDimFodaItem, "grupo" | "grupo_key" | "is_total_global">): boolean {
  return Boolean(it.is_total_global) || it.grupo_key === "__total__" || (it.grupo || "").toLowerCase() === "total";
}

function countFodaQuadrants(items: DashboardDimFodaItem[]): Record<DashboardDimFodaCuadrante, number> {
  const counts: Record<DashboardDimFodaCuadrante, number> = {
    fortaleza: 0,
    oportunidad: 0,
    debilidad: 0,
    amenaza: 0,
  };
  for (const it of items) {
    if (it.cuadrante) counts[it.cuadrante] += 1;
  }
  return counts;
}

function buildFodaLegacyPlot(
  items: DashboardDimFodaItem[],
  groupColors: Record<string, string>,
  corteScore: number,
  corteSd: number,
  scoreMin: number,
  scoreMax: number,
  spacing: number,
) {
  const maxSd = Math.max(...items.map((it) => it.score_sd), corteSd, 1);
  const xMax = Math.max(1, maxSd * 1.22, corteSd * 2.05);
  const yMin = Math.max(0, Math.min(95, scoreMin));
  const yMax = Math.max(yMin + 5, Math.min(140, scoreMax));
  const clampPct = (v: number) => Math.max(5, Math.min(95, v));
  const groupLabels = uniqueOrdered(items.map((it) => it.grupo || "Total"));
  const groups = groupLabels.map((label) => {
    const item = items.find((it) => (it.grupo || "Total") === label);
    return { label, color: groupColors[label] ?? item?.color ?? "#2F4A66" };
  });
  const rawPoints = items.map((it, i) => {
    // Sin jitter — la coordenada Y refleja el puntaje exacto y la X la
    // desviación exacta. Aceptamos que dos boxes con métricas casi idénticas
    // se solapen (es mejor que ver un punto >80 dibujado debajo de la
    // línea de corte por culpa del ruido pseudo-aleatorio).
    const left = clampPct((it.score_sd / xMax) * 100);
    const top = clampPct(100 - ((it.score_mean - yMin) / (yMax - yMin)) * 100);
    const group = it.grupo || "Total";
    return {
      ...it,
      key: `${it.var}-${it.grupo_key ?? group}-${i}`,
      left,
      top,
      color: groupColors[group] ?? it.color ?? "#2F4A66",
    };
  });
  // Sin repulsión — el user pidió precisión sobre evitar overlap.
  const points = rawPoints;
  void spacing;
  void repelFodaPoints;
  return {
    xMax,
    cutX: clampPct((corteSd / xMax) * 100),
    cutY: clampPct(100 - ((corteScore - yMin) / (yMax - yMin)) * 100),
    groups,
    points,
  };
}

function repelFodaPoints<T extends { left: number; top: number; cuadrante?: DashboardDimFodaCuadrante | null }>(
  points: T[],
  spacing: number,
): T[] {
  const out = points.map((p) => ({ ...p }));
  const minX = 7.5;
  const maxX = 92.5;
  const minY = 7;
  const maxY = 93;
  const k = Math.max(0.7, Math.min(1.8, spacing));
  const minDistX = 7.6 + k * 3.2;
  const minDistY = 5.2 + k * 2.6;
  for (let iter = 0; iter < 34 + Math.round(k * 12); iter += 1) {
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const dx = out[j].left - out[i].left;
        const dy = out[j].top - out[i].top;
        if (Math.abs(dx) >= minDistX || Math.abs(dy) >= minDistY) continue;
        const pushX = (minDistX - Math.abs(dx)) / 2;
        const pushY = (minDistY - Math.abs(dy)) / 2;
        const sx = dx >= 0 ? 1 : -1;
        const sy = dy >= 0 ? 1 : -1;
        out[i].left -= sx * pushX * 0.46;
        out[j].left += sx * pushX * 0.46;
        out[i].top -= sy * pushY * 0.52;
        out[j].top += sy * pushY * 0.52;
        out[i].left = Math.max(minX, Math.min(maxX, out[i].left));
        out[j].left = Math.max(minX, Math.min(maxX, out[j].left));
        out[i].top = Math.max(minY, Math.min(maxY, out[i].top));
        out[j].top = Math.max(minY, Math.min(maxY, out[j].top));
      }
    }
  }
  return laneFodaPoints(out, minDistX, minDistY, minX, maxX, minY, maxY);
}

function laneFodaPoints<T extends { left: number; top: number; cuadrante?: DashboardDimFodaCuadrante | null }>(
  points: T[],
  minDistX: number,
  minDistY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): T[] {
  const out = points.map((p) => ({ ...p }));
  const quadrants: Array<DashboardDimFodaCuadrante | "none"> = [
    "fortaleza",
    "oportunidad",
    "debilidad",
    "amenaza",
    "none",
  ];
  for (const q of quadrants) {
    const members = out
      .map((p) => ({ p }))
      .filter(({ p }) => (p.cuadrante ?? "none") === q)
      .sort((a, b) => (a.p.top - b.p.top) || (a.p.left - b.p.left));
    const placed: Array<{ left: number; top: number }> = [];
    for (const { p } of members) {
      let tries = 0;
      while (
        tries < 24 &&
        placed.some((prev) => Math.abs(prev.left - p.left) < minDistX && Math.abs(prev.top - p.top) < minDistY)
      ) {
        const lane = Math.ceil((tries + 1) / 2) * (tries % 2 === 0 ? 1 : -1);
        p.left = Math.max(minX, Math.min(maxX, p.left + lane * minDistX * 0.34));
        p.top = Math.max(minY, Math.min(maxY, p.top + ((tries % 3) - 1) * minDistY * 0.28));
        tries += 1;
      }
      placed.push({ left: p.left, top: p.top });
    }
  }
  return out;
}

function shortAxisLabel(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length === 1) return clean.slice(0, 4).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function semaforoColor(score: number, semaforo: NonNullable<DashboardDimPayload["semaforo"]>): string {
  if (score < semaforo.red_max) return semaforo.red_color;
  if (score < semaforo.amber_max) return semaforo.amber_color;
  return semaforo.green_color;
}

function colorToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split("").map((x) => parseInt(`${x}${x}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) {
    const n = parseInt(full[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `rgba(14, 59, 116, ${alpha})`;
}

function formatFodaTick(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (v >= 10) return String(Math.round(v));
  return v.toFixed(1).replace(/\.0$/, "");
}

function formatFodaMetric(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return v.toFixed(1).replace(/\.0$/, "");
}

// =============================================================================
// Subtítulo dinámico con chip badges.
// =============================================================================

function SubtituloDim({ payload }: { payload: DashboardDimPayload }) {
  const parts: { label: string; value?: string; chip?: boolean }[] = [];
  if (payload.principal_label) parts.push({ label: "Cruce", value: payload.principal_label });
  if (payload.iter_active && payload.iter_var_label && payload.iter_level_label) {
    parts.push({ label: payload.iter_var_label, value: payload.iter_level_label });
  }
  if ((payload.principal_hidden ?? 0) > 0) {
    parts.push({ label: `+${payload.principal_hidden} categorías ocultas`, chip: true });
  }
  if ((payload.iter_hidden_levels ?? 0) > 0) {
    parts.push({ label: `+${payload.iter_hidden_levels} niveles ocultos`, chip: true });
  }
  if (!parts.length) return null;
  return (
    <div className="dash-dim-subtitle">
      {parts.map((p, i) => (
        <span
          key={i}
          className={`dash-dim-subtitle-item ${p.chip ? "is-chip" : ""}`}
        >
          {p.value ? (
            <>
              <span className="dash-dim-subtitle-key">{p.label}:</span>
              <span>{p.value}</span>
            </>
          ) : (
            p.label
          )}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Skeleton loader con shimmer.
// =============================================================================

function DimSkeleton({ mode }: { mode: DashboardDimVisualMode }) {
  if (mode === "foda") {
    return (
      <div className="dash-dim-skeleton dash-dim-skeleton-foda">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-dim-skel-block" />
        ))}
      </div>
    );
  }
  if (mode === "radar") {
    return (
      <div className="dash-dim-skeleton">
        <div className="dash-dim-skel-circle" />
      </div>
    );
  }
  // heatmap o barras: 5 barras horizontales.
  return (
    <div className="dash-dim-skeleton">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="dash-dim-skel-bar"
          style={{ width: `${60 + (i * 7) % 35}%` }}
        />
      ))}
    </div>
  );
}

function uniqueOrdered<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// =============================================================================
// ConstruccionView — Sunburst radial Índice → Dimensiones → Subcriterios
// =============================================================================
// Anillos concéntricos: el indicador raíz al centro, las dimensiones en el
// anillo medio y los subcriterios en el externo. Cada arco coloreado según
// el semáforo (rojo / ámbar / verde) sobre su score; el área refleja la
// cantidad de subcriterios contenidos. Click en un anillo hace drill-down
// nativo de Plotly.
//
// Estrategia de fetch: reutiliza el payload del modo activo (que ya está
// cargado para Heatmap/Barras/Radar/FODA) para el primer nivel y, sólo en
// modo "general", pide en paralelo los payloads de cada dimensión como
// indicador para el tercer nivel.

type ConstruccionRow = {
  axis_label: string;
  score_round: number | null;
  base: number | null;
  axis_var?: string;
  tipo?: string;
};

function ConstruccionView({
  payload,
  modo,
  cruce,
  incluirTotal,
  maxed,
}: {
  payload: DashboardDimPayload;
  modo: "general" | "indicadores";
  cruce: string;
  incluirTotal: boolean;
  maxed: boolean;
}) {
  const config = useDashboardStore((s) => s.config);
  const { payload: catalogo } = useDimCatalogo();
  const filtros = useDashboardStore((s) => s.filtros);
  const dim = useDashboardStore((s) => s.dimensiones);
  const filtrosKey = JSON.stringify(dim.filtrosOn ? filtros : []);

  const sem = useMemo(
    () => semaforoFromConfig(config, payload.semaforo),
    [config, payload.semaforo],
  );

  const dimensiones: ConstruccionRow[] = useMemo(() => {
    const rows = (payload.score_heat ?? []) as ConstruccionRow[];
    return rows.filter(
      (r) => (r.tipo === "apertura" || r.tipo === undefined) && r.axis_label !== "Total cruce",
    );
  }, [payload.score_heat]);

  // Paleta categórica por conductor (dimensión). Cada dim recibe un color
  // distintivo; los subcriterios heredan el color con tinte más claro para
  // que la "construcción" se lea como capas de una misma rama.
  const CONSTRUCCION_PALETA = [
    "#3a6df0", // azul
    "#16a37e", // verde-teal
    "#e2802c", // naranja
    "#a259d9", // púrpura
    "#0d8a9b", // cian
    "#d94a8a", // rosa
    "#6b8e23", // oliva
    "#c63d3d", // rojo
  ];
  const dimColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    dimensiones.forEach((d, i) => {
      map[d.axis_label] = CONSTRUCCION_PALETA[i % CONSTRUCCION_PALETA.length];
    });
    return map;
  }, [dimensiones]);

  // Tinte más claro para los subcriterios — mezcla el color del conductor
  // con blanco para diferenciar el anillo externo del medio sin perder la
  // identidad de rama. mix=0 → color saturado; mix=1 → blanco.
  const tintColor = (hex: string, mix = 0.32) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const tr = Math.round(r + (255 - r) * mix);
    const tg = Math.round(g + (255 - g) * mix);
    const tb = Math.round(b + (255 - b) * mix);
    return `rgb(${tr}, ${tg}, ${tb})`;
  };

  // Escala adaptativa: dentro de cada conductor, el subcriterio con score
  // más alto recibe el tinte más saturado (mix=0.18) y el más bajo el más
  // claro (mix=0.55). Si todos tienen el mismo score, usan el tinte medio.
  // Esto preserva identidad de conductor y muestra brechas internas sin
  // mezclarse con la paleta del semáforo.
  const adaptiveTint = (
    baseHex: string,
    score: number | null,
    minScore: number,
    maxScore: number,
  ) => {
    if (score == null || maxScore <= minScore) return tintColor(baseHex, 0.34);
    const t = (score - minScore) / (maxScore - minScore); // 0..1, 1 = max
    const mix = 0.55 - t * 0.37; // 0.55 (low) → 0.18 (high)
    return tintColor(baseHex, mix);
  };

  // Subcriterios por dimensión — sólo se piden en modo "general" porque ahí
  // el payload del índice no los trae. En modo "indicadores" el payload
  // ya entrega los subcriterios como axis_label, así que lo usamos directo.
  const [subRows, setSubRows] = useState<Record<string, ConstruccionRow[]>>({});
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    if (modo !== "general") {
      setSubRows({});
      return;
    }
    if (!catalogo || !catalogo.indicadores?.length) return;
    let cancelled = false;
    setSubLoading(true);
    const indByLabel = new Map<string, string>();
    for (const ind of catalogo.indicadores) indByLabel.set(ind.label, ind.id);
    const promises = dimensiones
      .map((d) => ({ label: d.axis_label, id: indByLabel.get(d.axis_label) }))
      .filter((x): x is { label: string; id: string } => Boolean(x.id))
      .map(({ label, id }) =>
        apiDashboardDimPayload({
          modo: "indicadores",
          objetivo: id,
          cruce: cruce || undefined,
          incluir_total: incluirTotal,
          iter: null,
          filtros: dim.filtrosOn ? filtros : [],
        })
          .then((r) => ({ label, rows: (r.payload.score_heat ?? []) as ConstruccionRow[] }))
          .catch(() => ({ label, rows: [] as ConstruccionRow[] })),
      );
    Promise.all(promises).then((results) => {
      if (cancelled) return;
      const map: Record<string, ConstruccionRow[]> = {};
      for (const { label, rows } of results) {
        map[label] = rows.filter(
          (r) => r.tipo === "apertura" || r.tipo === undefined || r.tipo === "subcriterio",
        ).filter((r) => r.axis_label !== "Total cruce");
      }
      setSubRows(map);
      setSubLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, payload.objective_id, cruce, incluirTotal, filtrosKey, catalogo?.indicadores?.length, dimensiones.length]);

  const traceData = useMemo(() => {
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const textColors: string[] = [];
    const customdata: (number | string)[][] = [];
    const ids: string[] = [];

    const indiceLabel = payload.objective ?? "Índice";
    // Score del índice = "Total cruce" o promedio simple de las dimensiones.
    const totalRow = (payload.score_heat ?? []).find((r) => r.axis_label === "Total cruce");
    const indiceScore = totalRow?.score_round ?? null;

    // Total leaves (preliminar): suma de subcriterios; si no hay, usar n de dims
    const totalLeaves = dimensiones.reduce((acc, d) => {
      const subs = subRows[d.axis_label]?.length ?? 0;
      return acc + (subs > 0 ? subs : 1);
    }, 0) || dimensiones.length || 1;

    ids.push("__root__");
    // Score inline al lado del nombre — evita doble lectura entre arco y hover.
    labels.push(
      indiceScore != null ? `${indiceLabel}\n${indiceScore}` : indiceLabel,
    );
    parents.push("");
    values.push(totalLeaves);
    colors.push("#1f2a3a"); // raíz: gris oscuro neutro para contrastar
    textColors.push("#ffffff");
    customdata.push([
      indiceScore != null ? indiceScore : "—",
      totalRow?.base ?? "",
    ]);

    for (const d of dimensiones) {
      const dimId = `dim:${d.axis_label}`;
      const subs = subRows[d.axis_label] ?? [];
      const dimValue = subs.length > 0 ? subs.length : 1;
      const dimColor = dimColorMap[d.axis_label] ?? "#94a3b8";

      // Rango adaptativo del conductor — usado para modular el tinte de los
      // subcriterios. min/max sólo de los subs con score válido.
      const subScores = subs
        .map((s) => s.score_round)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const subMin = subScores.length ? Math.min(...subScores) : 0;
      const subMax = subScores.length ? Math.max(...subScores) : 100;

      ids.push(dimId);
      labels.push(
        d.score_round != null
          ? `${d.axis_label}\n${d.score_round}`
          : d.axis_label,
      );
      parents.push("__root__");
      values.push(dimValue);
      colors.push(dimColor);
      textColors.push("#ffffff"); // texto blanco sobre color saturado
      customdata.push([d.score_round ?? "—", d.base ?? ""]);

      for (const s of subs) {
        ids.push(`${dimId}:${s.axis_label}`);
        labels.push(
          s.score_round != null
            ? `${s.axis_label}\n${s.score_round}`
            : s.axis_label,
        );
        parents.push(dimId);
        values.push(1);
        colors.push(adaptiveTint(dimColor, s.score_round ?? null, subMin, subMax));
        textColors.push("#1f2a3a"); // texto oscuro sobre tinte claro
        customdata.push([s.score_round ?? "—", s.base ?? ""]);
      }
    }

    return { ids, labels, parents, values, colors, textColors, customdata };
  }, [payload.objective, payload.score_heat, dimensiones, subRows, dimColorMap]);

  // Mapping para highlight contextual: para cada nodo, qué IDs forman su
  // rama (ancestros + propio + descendientes). En hover se usa para atenuar
  // los OTROS nodos manteniendo la rama activa nítida.
  const branchMap = useMemo(() => {
    const childrenOf: Record<string, string[]> = {};
    traceData.ids.forEach((id, i) => {
      const p = traceData.parents[i];
      if (p) (childrenOf[p] ??= []).push(id);
    });
    const collectDesc = (id: string): string[] => {
      const direct = childrenOf[id] ?? [];
      return [id, ...direct.flatMap(collectDesc)];
    };
    const parentOf: Record<string, string> = {};
    traceData.ids.forEach((id, i) => {
      parentOf[id] = traceData.parents[i];
    });
    const ancestorsOf = (id: string): string[] => {
      const out: string[] = [];
      let cur = parentOf[id];
      while (cur) {
        out.push(cur);
        cur = parentOf[cur];
      }
      return out;
    };
    const map: Record<string, Set<string>> = {};
    for (const id of traceData.ids) {
      map[id] = new Set([...ancestorsOf(id), ...collectDesc(id)]);
    }
    return map;
  }, [traceData.ids, traceData.parents]);

  const handlePlotReady = useCallback(
    (gd: HTMLElement) => {
      let plotlyMod: typeof import("plotly.js-dist-min") | null = null;
      let active = true;
      import("plotly.js-dist-min").then((P) => {
        if (!active) return;
        plotlyMod = P;
      });

      const dimmedColors = traceData.colors.map((c) => {
        // Para hex (#rrggbb): convertir a rgba con opacity. Para rgb(...):
        // sustituir por rgba(...).
        if (c.startsWith("#")) {
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, 0.18)`;
        }
        if (c.startsWith("rgb(")) return c.replace("rgb(", "rgba(").replace(")", ", 0.18)");
        return c;
      });

      const onHover = (ev: { points?: { id?: string; pointNumber?: number }[] }) => {
        if (!plotlyMod) return;
        const hoveredId = ev.points?.[0]?.id;
        if (!hoveredId) return;
        const branch = branchMap[hoveredId];
        if (!branch) return;
        const newColors = traceData.ids.map((id, i) =>
          branch.has(id) ? traceData.colors[i] : dimmedColors[i],
        );
        // Plotly.restyle acepta dot-notation en runtime ("marker.colors"),
        // pero el tipo `Data` no lo declara — cast obligatorio.
        plotlyMod.restyle(gd, { "marker.colors": [newColors] } as Parameters<
          typeof plotlyMod.restyle
        >[1]);
      };
      const onUnhover = () => {
        if (!plotlyMod) return;
        plotlyMod.restyle(gd, { "marker.colors": [traceData.colors] } as Parameters<
          typeof plotlyMod.restyle
        >[1]);
      };

      // Plotly emite eventos via .on() en el div graph.
      const g = gd as HTMLElement & {
        on?: (event: string, cb: (ev: unknown) => void) => void;
        removeAllListeners?: (event: string) => void;
      };
      g.on?.("plotly_hover", onHover as (ev: unknown) => void);
      g.on?.("plotly_unhover", onUnhover);

      return () => {
        active = false;
        g.removeAllListeners?.("plotly_hover");
        g.removeAllListeners?.("plotly_unhover");
      };
    },
    [traceData.colors, traceData.ids, branchMap],
  );

  if (!dimensiones.length) {
    return <p className="dash-cardbox-help">Sin dimensiones para construir el indicador.</p>;
  }

  const showLoading = modo === "general" && subLoading && !Object.keys(subRows).length;

  return (
    <div className="dash-construccion-wrap">
      {showLoading && (
        <div className="dash-construccion-loading" aria-live="polite">
          Cargando subcriterios…
        </div>
      )}
      <PlotlyChart
        data={[
          {
            type: "sunburst" as const,
            ids: traceData.ids,
            labels: traceData.labels,
            parents: traceData.parents,
            values: traceData.values,
            branchvalues: "total",
            marker: {
              colors: traceData.colors,
              line: { color: "#ffffff", width: 1.5 },
            },
            customdata: traceData.customdata,
            hovertemplate:
              "<b>%{label}</b><br>Score: %{customdata[0]}<br>Base: %{customdata[1]}<extra></extra>",
            // "auto" deja que Plotly elija — usa horizontal en el centro y
            // se ajusta a tangencial en arcos pequeños para que TODAS las
            // etiquetas entren. Subcriterios con tinte claro toleran texto
            // oscuro (mejor legibilidad que blanco sobre pastel).
            insidetextorientation: "auto",
            textfont: {
              size: 12,
              color: traceData.textColors,
              family: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              weight: 600,
            },
            leaf: { opacity: 0.96 },
            sort: false,
            rotation: 90,
          },
        ]}
        layout={{
          margin: { t: 12, r: 12, b: 12, l: 12 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          showlegend: false,
          // No hide: muestra todas las etiquetas que quepan, aunque rote.
          uniformtext: { minsize: 9, mode: "show" },
          transition: {
            duration: 320,
            easing: "cubic-in-out",
          },
        }}
        height={620}
        ariaLabel={`Construcción del indicador ${payload.objective ?? ""}`}
        onReady={handlePlotReady}
      />
      <div className="dash-construccion-legend" aria-hidden="true">
        {dimensiones.map((d) => (
          <span key={d.axis_label} className="dash-construccion-leyenda-item">
            <span style={{ background: dimColorMap[d.axis_label] }} />
            {d.axis_label}
          </span>
        ))}
      </div>
    </div>
  );
}
