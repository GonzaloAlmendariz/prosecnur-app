import type { CSSProperties } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import type {
  MonitoreoModoDefinicion,
  MonitoreoSeccion as MonitoreoSeccionDePagina,
  MonitoreoSeccionPublica as MonitoreoSeccion,
} from "../core/monitoreoRegistry";
import { seccionesPublicasDelModo } from "../core/monitoreoRegistry";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { MonitoreoPathContext } from "./MonitoreoPathContext";
import { PARAMS_DIRECCION } from "../../../lib/navegacion/direccion";
import { HerramientasDelModo, IndicadoresDelModo, type BarraDelModo } from "./BarraDelModo";
import { nombreDeLaPildora, normalizarMetrica, tituloDeLaPildora, type MetricaDeSeccion } from "./metricaDeSeccion";

export type MonitoreoModuleChromeProps<K extends MonitoreoSeccion = MonitoreoSeccionDePagina> = {
  routes: MonitoreoModoDefinicion[];
  route: MonitoreoModoDefinicion | null;
  routeSelected: boolean;
  seccionActiva: K;
  saving: boolean;
  syncedAt: string;
  generatedAt?: string;
  generationStatus?: string;
  pendingRegeneration?: boolean;
  syncErrors?: { message?: string; source_label?: string; source_id?: string }[];
  sourceTotal: number;
  activeSources: number;
  nRows: number;
  hasSnapshot: boolean;
  syncing?: boolean;
  syncProgress?: MonitoreoModuleSyncProgress | null;
  /**
   * Insignia de cada píldora. Un avance va con su base (`{ valor, base, lectura }`,
   * L20); un texto suelto sirve para conteos. Territorial todavía pasa texto.
   */
  viewMetrics?: Partial<Record<MonitoreoSeccion, MetricaDeSeccion>>;
  syncDisabled?: boolean;
  syncLabel?: string;
  syncTitle?: string;
  onSyncAll?: () => Promise<void> | void;
  advanceSyncDisabled?: boolean;
  advanceSyncLabel?: string;
  advanceSyncTitle?: string;
  onSyncAdvance?: () => Promise<void> | void;
  /** Recibe la clave de la píldora; cada modo sólo pinta las suyas. */
  onCambioSeccion?: (view: K) => void;
  /**
   * Barra del esqueleto común del revamp (MODO, EJE DE CUOTA, FALTAN, CORTE,
   * estado y Actualizar). Opcional: sin ella el chrome se pinta como siempre.
   */
  barraDelModo?: BarraDelModo;
  /**
   * El proyecto todavía se lee (L21). Mientras tanto no se publican «Registros 0»
   * ni «Sin sincronizar», que serían cifras falsas: va «Leyendo…».
   */
  cargando?: boolean;
};

type MonitoreoModuleSyncProgress = {
  active?: "advance" | "full";
  percent?: number | null;
  phase?: string;
  message?: string;
  /** «Actualizando, paso N de M» de la barra común (§2b). */
  paso?: number;
  pasos?: number;
};

const LEYENDO = "Leyendo…";

function formatChromeCount(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("es-PE") : "0";
}

function formatChromeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

/* La píldora del chrome da ~104px y el sello completo pide ~126px, así que se
 * cortaba a media hora ("24/07/26, 6:3…"). En la píldora va la fecha, que entra
 * entera; la hora exacta vive en el `title`, que ya llevaba el valor completo. */
function formatChromeDateCompact(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { dateStyle: "short" });
}

function chromeSyncProgressPercent(progress: MonitoreoModuleSyncProgress | null | undefined) {
  const raw = Number(progress?.percent);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, raw));
}

function chromeSyncProgressLabel(progress: MonitoreoModuleSyncProgress | null | undefined) {
  const percent = chromeSyncProgressPercent(progress);
  if (percent == null) return "...";
  return `${Math.round(percent)}%`;
}

function chromeSyncProgressStyle(progress: MonitoreoModuleSyncProgress | null | undefined): CSSProperties | undefined {
  const percent = chromeSyncProgressPercent(progress);
  if (percent == null) return undefined;
  return { "--mon-sync-progress": `${percent}%` } as CSSProperties;
}

/**
 * Enlace a una sección de Monitoreo en forma canónica.
 *
 * Cambiar de sección descarta la pestaña activa a propósito: la pestaña
 * pertenece a la sección que se abandona y arrastrarla produciría un
 * `?pestana=` que no existe en el destino.
 */
export function monitoreoSeccionHref(seccion: MonitoreoSeccion, currentHref?: string) {
  const href = currentHref
    ?? (typeof window === "undefined" ? "http://localhost/monitoreo" : window.location.href);
  const url = new URL(href, "http://localhost");
  url.searchParams.set(PARAMS_DIRECCION.seccion, seccion);
  url.searchParams.delete(PARAMS_DIRECCION.pestana);
  url.searchParams.delete("tab");
  return `${url.pathname}${url.search}${url.hash}`;
}

type ChromeGenerationInfo = {
  label: string;
  value: string;
  tone: "ready" | "partial" | "stale" | "failed";
  title: string;
};

export function MonitoreoModuleChrome<K extends MonitoreoSeccion = MonitoreoSeccionDePagina>({
  routes,
  route,
  routeSelected,
  seccionActiva,
  saving,
  syncedAt,
  generatedAt = "",
  generationStatus = "",
  pendingRegeneration = false,
  syncErrors = [],
  sourceTotal,
  activeSources,
  nRows,
  hasSnapshot,
  syncing = false,
  syncProgress = null,
  viewMetrics,
  syncDisabled = false,
  syncLabel = "Actualizar todo",
  syncTitle,
  onSyncAll,
  advanceSyncDisabled = false,
  advanceSyncLabel = "Actualizar avance",
  advanceSyncTitle,
  onSyncAdvance,
  onCambioSeccion,
  barraDelModo,
  cargando = false,
}: MonitoreoModuleChromeProps<K>) {
  const activeRoutes = routes.filter((item) => item.status === "active").length;
  const views = route ? seccionesPublicasDelModo(route) : [];
  const statusLabel = route
    ? routeSelected
      ? "Modo fijado"
      : "Modo por elegir"
    : `${activeRoutes} tipos disponibles`;
  // **Dos «Corte» distintos en la misma pantalla.**
  //
  // Este indicador miraba el sello del ESTADO —cuándo se sincronizaron los
  // datos— y la tarjeta de Fuentes, dos dedos más abajo, mira el del TABLERO
  // —contra qué día se mide el atraso—. Son dos cosas distintas y las dos se
  // llamaban «Corte»: con un proyecto recién importado, arriba decía «Snapshot»
  // y abajo «23/8/2026», sin forma de saber que hablaban de cosas diferentes.
  //
  // Este pasa a llamarse **Sincronizado**, que es lo que mide, y enseña la fecha
  // cuando la hay. «Corte» se queda para el sello del tablero, que es donde esa
  // palabra significa algo en el operativo.
  const cutDate = (() => {
    const iso = String(generatedAt || syncedAt || "").trim();
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("es-PE");
  })();
  const cutOrigen = syncedAt
    ? "última sincronización de datos"
    : hasSnapshot ? "datos del proyecto guardado, sin sincronizar" : "todavía sin datos sincronizados";
  const cutLabel = cutDate || (hasSnapshot ? "Del proyecto" : "Sin sincronizar");
  const syncingAdvance = Boolean(syncing && (!syncProgress?.active || syncProgress.active === "advance"));
  const syncingFull = Boolean(syncing && (!syncProgress?.active || syncProgress.active === "full"));
  const advanceProgress = syncingAdvance ? syncProgress : null;
  const fullProgress = syncingFull ? syncProgress : null;
  const advanceProgressLabel = syncingAdvance ? chromeSyncProgressLabel(advanceProgress) : "";
  const fullProgressLabel = syncingFull ? chromeSyncProgressLabel(fullProgress) : "";
  const advanceProgressTitle = advanceProgress?.message || advanceProgress?.phase || advanceSyncTitle || advanceSyncLabel;
  const fullProgressTitle = fullProgress?.message || fullProgress?.phase || syncTitle || syncLabel;
  const generationInfo: ChromeGenerationInfo | null = (() => {
    if (pendingRegeneration || generationStatus === "stale") {
      return {
        label: "Estado",
        value: "Pendiente",
        tone: "stale",
        title: "Pendiente de regenerar",
      };
    }
    if (generationStatus === "partial") {
      const first = syncErrors.find((item) => item?.message)?.message ?? "";
      return {
        label: "Estado",
        value: "Parcial",
        tone: "partial",
        title: first ? `Parcial: ${first}` : "Parcial",
      };
    }
    if (generationStatus === "failed") {
      return {
        label: "Estado",
        value: "Fallida",
        tone: "failed",
        title: "Regeneración fallida",
      };
    }
    if (generatedAt) {
      const formatted = formatChromeDate(generatedAt);
      return {
        label: "Regenerado",
        value: formatChromeDateCompact(generatedAt),
        tone: "ready",
        title: `Regenerado ${formatted}`,
      };
    }
    return null;
  })();
  const sectionRail = routeSelected && route ? (
    <div
      className={`mon-section-rail-wrap${views.length === 1 ? " is-single-section" : ""}`}
      aria-label="Secciones de monitoreo"
      data-view-count={views.length}
    >
      <GlidingTabList as="nav" mode="nav" activeKey={seccionActiva} className="pulso-phase-pillbar mon-section-rail" aria-label={`Secciones de ${route.shortLabel}`}>
        <ol className="pulso-phase-pill-list">
          {views.map((item, index) => {
            const selected = item.key === seccionActiva;
            const displayLabel = item.shortLabel ?? item.label;
            const metric = normalizarMetrica(viewMetrics?.[item.key]);
            const accessibilityLabel = nombreDeLaPildora(displayLabel, metric, item.desc);
            return (
              <li key={item.key} className="pulso-phase-pill-item">
                <a
                  href={saving ? undefined : monitoreoSeccionHref(item.key)}
                  data-gliding-key={item.key}
                  /* Adopta los estados compartidos: el mismo hover, el mismo
                   * hover sobre la sección activa y el mismo anillo de foco que
                   * en Procesamiento. Era la diferencia que se veía. */
                  data-nav-item=""
                  data-nav-shape="pill"
                  data-nav-state={selected ? "selected" : undefined}
                  className={`pulso-phase-pill mon-section-pill is-${item.key}${selected ? " is-active" : ""}${saving ? " is-disabled" : ""}`}
                  aria-label={accessibilityLabel}
                  aria-current={selected ? "page" : undefined}
                  aria-disabled={saving ? "true" : undefined}
                  data-view-key={item.key}
                  tabIndex={saving ? -1 : undefined}
                  title={tituloDeLaPildora(item.label, metric, item.desc)}
                  onClick={(event) => {
                    if (saving) {
                      event.preventDefault();
                      return;
                    }
                    if (
                      !onCambioSeccion
                      || event.button !== 0
                      || event.metaKey
                      || event.ctrlKey
                      || event.shiftKey
                      || event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onCambioSeccion(item.key as K);
                  }}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      <span className="pulso-phase-pill-text">{displayLabel}</span>
                      {metric ? (
                        <em className={`pulso-phase-pill-metric${metric.base ? " has-base" : ""}`}>
                          <span className="mon-pill-metric-valor">{metric.valor}</span>
                          {metric.base ? <span className="mon-pill-metric-base">{metric.base}</span> : null}
                        </em>
                      ) : null}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </GlidingTabList>
    </div>
  ) : null;

  const registrosLabel = cargando ? LEYENDO : formatChromeCount(nRows);
  const sincronizadoLabel = cargando ? LEYENDO : cutLabel;
  const indicadores = routeSelected ? (
    <ChromeIndicatorGroup
      ariaLabel="Estado del monitoreo"
      resumen={[
        generationInfo ? `${generationInfo.label}: ${generationInfo.value}` : null,
        `Registros: ${registrosLabel}`,
        `Sincronizado: ${sincronizadoLabel}`,
      ].filter(Boolean).join(" · ")}
    >
      {generationInfo ? (
        <ChromeIndicator
          label={generationInfo.label}
          value={generationInfo.value}
          prioridad="baja"
          detalle={generationInfo.title}
        />
      ) : null}
      <ChromeIndicator label="Registros" value={registrosLabel} prioridad="alta" />
      <ChromeIndicator
        label="Sincronizado"
        value={sincronizadoLabel}
        prioridad="media"
        detalle={cargando ? "Leyendo el proyecto" : cutOrigen}
      />
    </ChromeIndicatorGroup>
  ) : null;

  return (
    <div className={`mon-module-chrome${barraDelModo ? " is-barra-comun" : ""}`} data-audit-chrome="monitoring">
      {barraDelModo ? (
        <ModuleCommandBar
          modulo="monitoreo"
          className="mon-commandbar is-barra-comun"
          ariaLabel="Contexto operativo de monitoreo"
          contexto={
            <>
              <MonitoreoPathContext route={route} conHermanos={false} />
              {barraDelModo.selector}
              <IndicadoresDelModo indicadores={barraDelModo.indicadores} />
            </>
          }
          secciones={sectionRail}
          herramientas={<HerramientasDelModo barra={barraDelModo} ocupado={saving || syncing} progreso={syncing ? syncProgress : null} cargando={cargando} />}
        />
      ) : (
      <ModuleCommandBar
        modulo="monitoreo"
        className="mon-commandbar"
        ariaLabel="Contexto operativo de monitoreo"
        contexto={
          <>
            <MonitoreoPathContext route={route} />
            {routeSelected ? (
              <ChromeIndicator label="Activas" value={`${activeSources}/${sourceTotal}`} prioridad="media" />
            ) : null}
          </>
        }
        secciones={sectionRail}
        herramientas={
          <>
            {!routeSelected ? (
              <span className="mon-command-status">
                {saving ? <Loader2 size={13} className="pulso-spin" /> : <Activity size={13} />}
                {statusLabel}
              </span>
            ) : null}
            {!routeSelected ? <strong>Selecciona un tipo de monitoreo</strong> : null}
            {indicadores}
            {routeSelected && (onSyncAll || onSyncAdvance) ? (
              <div className="mon-command-sync-group" aria-label="Actualización de monitoreo">
                {onSyncAdvance ? (
                  <button
                    type="button"
                    className={`mon-command-sync is-advance${syncingAdvance ? " is-syncing" : ""}`}
                    disabled={saving || syncing || advanceSyncDisabled}
                    title={advanceProgressTitle}
                    aria-label={advanceProgressLabel ? `${advanceSyncLabel}: ${advanceProgressLabel}` : advanceSyncLabel}
                    style={chromeSyncProgressStyle(advanceProgress)}
                    onClick={() => {
                      void Promise.resolve(onSyncAdvance()).catch(() => undefined);
                    }}
                  >
                    {/* Solo el spinner: en reposo el label basta. */}
                    {syncingAdvance ? <Loader2 size={13} className="pulso-spin" /> : null}
                    <span>{advanceSyncLabel}</span>
                    {advanceProgressLabel ? <strong className="mon-command-sync-progress">{advanceProgressLabel}</strong> : null}
                  </button>
                ) : null}
                {onSyncAll ? (
                  <button
                    type="button"
                    className={`mon-command-sync is-full${syncingFull ? " is-syncing" : ""}`}
                    disabled={saving || syncing || syncDisabled}
                    title={fullProgressTitle}
                    aria-label={fullProgressLabel ? `${syncLabel}: ${fullProgressLabel}` : syncLabel}
                    style={chromeSyncProgressStyle(fullProgress)}
                    onClick={() => {
                      void Promise.resolve(onSyncAll()).catch(() => undefined);
                    }}
                  >
                    {syncingFull ? <Loader2 size={13} className="pulso-spin" /> : null}
                    <span>{syncLabel}</span>
                    {fullProgressLabel ? <strong className="mon-command-sync-progress">{fullProgressLabel}</strong> : null}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />
      )}
    </div>
  );
}
