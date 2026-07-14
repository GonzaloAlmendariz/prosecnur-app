import type { CSSProperties } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import type {
  MonitoreoRouteDefinition,
  WorkbenchView,
} from "../core/monitoreoRegistry";
import { workbenchViewsForRoute } from "../core/monitoreoRegistry";
import { GlidingTabList } from "../../../components/GlidingTabList";

type MonitoreoModuleChromeProps = {
  routes: MonitoreoRouteDefinition[];
  route: MonitoreoRouteDefinition | null;
  routeSelected: boolean;
  activeView: WorkbenchView;
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
  viewMetrics?: Partial<Record<WorkbenchView, string>>;
  syncDisabled?: boolean;
  syncLabel?: string;
  syncTitle?: string;
  onSyncAll?: () => Promise<void> | void;
  advanceSyncDisabled?: boolean;
  advanceSyncLabel?: string;
  advanceSyncTitle?: string;
  onSyncAdvance?: () => Promise<void> | void;
  onViewChange?: (view: WorkbenchView) => void;
};

type MonitoreoModuleSyncProgress = {
  active?: "advance" | "full";
  percent?: number | null;
  phase?: string;
  message?: string;
};

function formatChromeCount(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("es-PE") : "0";
}

function formatChromeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
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

type ChromeGenerationInfo = {
  label: string;
  value: string;
  tone: "ready" | "partial" | "stale" | "failed";
  title: string;
};

export function MonitoreoModuleChrome({
  routes,
  route,
  routeSelected,
  activeView,
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
  onViewChange,
}: MonitoreoModuleChromeProps) {
  const activeRoutes = routes.filter((item) => item.status === "active").length;
  const views = route ? workbenchViewsForRoute(route) : [];
  const RouteIcon = route?.icon ?? Activity;
  const statusLabel = route
    ? routeSelected
      ? "Modo fijado"
      : "Modo por elegir"
    : `${activeRoutes} tipos disponibles`;
  const cutLabel = syncedAt ? "Listo" : hasSnapshot ? "Snapshot" : "Sin corte";
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
        value: formatted,
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
      <GlidingTabList as="nav" activeKey={activeView} className="pulso-phase-pillbar mon-section-rail" role="tablist" aria-label={`Secciones de ${route.shortLabel}`}>
        <ol className="pulso-phase-pill-list">
          {views.map((item, index) => {
            const selected = item.key === activeView;
            const displayLabel = item.shortLabel ?? item.label;
            const metric = viewMetrics?.[item.key] ?? "";
            const accessibilityLabel = metric ? `${displayLabel}, ${metric}: ${item.desc}` : `${displayLabel}: ${item.desc}`;
            return (
              <li key={item.key} className="pulso-phase-pill-item">
                <button
                  type="button"
                  role="tab"
                  data-gliding-key={item.key}
                  className={`pulso-phase-pill mon-section-pill is-${item.key}${selected ? " is-active" : ""}${saving ? " is-disabled" : ""}`}
                  aria-label={accessibilityLabel}
                  aria-current={selected ? "page" : undefined}
                  aria-selected={selected}
                  data-view-key={item.key}
                  disabled={saving}
                  title={metric ? `${item.label}: ${metric} · ${item.desc}` : `${item.label}: ${item.desc}`}
                  onClick={() => {
                    if (!saving) onViewChange?.(item.key);
                  }}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      <span className="pulso-phase-pill-number">{index + 1}</span>
                      <span className="pulso-phase-pill-text">{displayLabel}</span>
                      {metric ? <em className="pulso-phase-pill-metric">{metric}</em> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </GlidingTabList>
    </div>
  ) : null;

  return (
    <div className="mon-module-chrome" data-audit-chrome="monitoring">
      <div
        className={`mon-commandbar${sectionRail ? " has-section-rail" : ""}`}
        aria-label="Contexto operativo de monitoreo"
        data-route-family={route?.family ?? "none"}
        data-view-count={views.length}
      >
        <div className="mon-command-summary mon-command-side" aria-label="Resumen del modo de monitoreo">
          <span className="mon-command-token is-mode">
            <span className="mon-command-mode-icon" aria-hidden="true">
              <RouteIcon size={15} />
            </span>
            <span className="mon-command-token-copy">
              <small>Modo</small>
              <strong>{route?.shortLabel ?? "Sin definir"}</strong>
            </span>
          </span>
          <span className="mon-command-token">
            <small>Activas</small>
            <strong>{activeSources}/{sourceTotal}</strong>
          </span>
          {!routeSelected ? (
            <>
              <span className="mon-command-token">
                <small>Registros</small>
                <strong>{formatChromeCount(nRows)}</strong>
              </span>
              <span className="mon-command-token">
                <small>Corte</small>
                <strong>{cutLabel}</strong>
              </span>
            </>
          ) : null}
        </div>

        {sectionRail}

        <div className="mon-command-current mon-command-side" aria-live="polite">
          {!routeSelected ? (
            <span className="mon-command-status">
              {saving ? <Loader2 size={13} className="pulso-spin" /> : <Activity size={13} />}
              {statusLabel}
            </span>
          ) : null}
          {routeSelected ? (
            <>
              {onSyncAll || onSyncAdvance ? (
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
	                      {syncingAdvance ? <Loader2 size={13} className="pulso-spin" /> : <Activity size={13} />}
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
	                      {syncingFull ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
	                      <span>{syncLabel}</span>
	                      {fullProgressLabel ? <strong className="mon-command-sync-progress">{fullProgressLabel}</strong> : null}
	                    </button>
	                  ) : null}
                </div>
              ) : null}
              {generationInfo ? (
                <span className={`mon-command-token mon-command-generation is-${generationInfo.tone}`} title={generationInfo.title}>
                  <small>{generationInfo.label}</small>
                  <strong>{generationInfo.value}</strong>
                </span>
              ) : null}
              <span className="mon-command-token">
                <small>Registros</small>
                <strong>{formatChromeCount(nRows)}</strong>
              </span>
              <span className="mon-command-token">
                <small>Corte</small>
                <strong>{cutLabel}</strong>
              </span>
            </>
          ) : null}
          {!routeSelected ? <strong>Selecciona un tipo de monitoreo</strong> : null}
        </div>
      </div>
    </div>
  );
}
