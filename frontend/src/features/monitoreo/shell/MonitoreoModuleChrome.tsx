import { Activity, Loader2, RefreshCw } from "lucide-react";
import type {
  MonitoreoRouteDefinition,
  WorkbenchView,
} from "../core/monitoreoRegistry";
import { workbenchViewsForRoute } from "../core/monitoreoRegistry";

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

function formatChromeCount(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("es-PE") : "0";
}

function formatChromeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

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
  const statusLabel = route
    ? routeSelected
      ? "Path fijado"
      : "Path por elegir"
    : `${activeRoutes} tipos disponibles`;
  const cutLabel = syncedAt ? "Listo" : hasSnapshot ? "Snapshot" : "Sin corte";
  const generationLabel = (() => {
    if (pendingRegeneration || generationStatus === "stale") return "Pendiente de regenerar";
    if (generationStatus === "partial") {
      const first = syncErrors.find((item) => item?.message)?.message ?? "";
      return first ? `Parcial: ${first}` : "Parcial";
    }
    if (generationStatus === "failed") return "Regeneración fallida";
    if (generatedAt) return `Regenerado ${formatChromeDate(generatedAt)}`;
    return "";
  })();
  const sectionRail = routeSelected && route ? (
    <div className="mon-section-rail-wrap" aria-label="Secciones de monitoreo">
      <nav className="pulso-phase-pillbar mon-section-rail" aria-label={`Secciones de ${route.shortLabel}`}>
        <ol className="pulso-phase-pill-list">
          {views.map((item, index) => {
            const selected = item.key === activeView;
            const displayLabel = item.shortLabel ?? item.label;
            return (
              <li key={item.key} className="pulso-phase-pill-item">
                <button
                  type="button"
                  role="tab"
                  className={`pulso-phase-pill mon-section-pill is-${item.key}${selected ? " is-active" : ""}`}
                  aria-current={selected ? "page" : undefined}
                  aria-selected={selected}
                  disabled={saving}
                  title={`${item.label}: ${item.desc}`}
                  onClick={() => {
                    if (!saving) onViewChange?.(item.key);
                  }}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      <span className="pulso-phase-pill-number">{index + 1}</span>
                      <span>{displayLabel}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  ) : null;

  return (
    <div className="mon-module-chrome" data-audit-chrome="monitoring">
      <div className={`mon-commandbar${sectionRail ? " has-section-rail" : ""}`} aria-label="Contexto operativo de monitoreo">
        <div className="mon-command-summary" aria-label="Resumen del path">
          <span className="mon-command-token is-path">
            <small>Path</small>
            <strong>{route?.shortLabel ?? "Sin definir"}</strong>
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

        <div className="mon-command-current" aria-live="polite">
          {!routeSelected ? (
            <span>
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
                      className="mon-command-sync is-advance"
                      disabled={saving || syncing || advanceSyncDisabled}
                      title={advanceSyncTitle ?? advanceSyncLabel}
                      aria-label={advanceSyncLabel}
                      onClick={() => {
                        void Promise.resolve(onSyncAdvance()).catch(() => undefined);
                      }}
                    >
                      {syncing ? <Loader2 size={13} className="pulso-spin" /> : <Activity size={13} />}
                      <span>{advanceSyncLabel}</span>
                    </button>
                  ) : null}
                  {onSyncAll ? (
                    <button
                      type="button"
                      className="mon-command-sync is-full"
                      disabled={saving || syncing || syncDisabled}
                      title={syncTitle ?? syncLabel}
                      aria-label={syncLabel}
                      onClick={() => {
                        void Promise.resolve(onSyncAll()).catch(() => undefined);
                      }}
                    >
                      {syncing ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
                      <span>{syncLabel}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
              {generationLabel ? (
                <span className={`mon-command-generation is-${generationStatus || "unknown"}${pendingRegeneration ? " is-stale" : ""}`} title={generationLabel}>
                  {generationLabel}
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
