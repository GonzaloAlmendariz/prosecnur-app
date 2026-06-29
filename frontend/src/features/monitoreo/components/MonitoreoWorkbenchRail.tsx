import { useEffect } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

export type MonitoreoWorkbenchRailTab = {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

export type MonitoreoWorkbenchRailStatusItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  ready?: boolean;
  className?: string;
};

type MonitoreoWorkbenchRailProps = {
  activeLocalTab: string;
  activeSection: {
    label: string;
    desc: string;
    icon: LucideIcon;
  };
  activeView: string;
  ariaLabel: string;
  className?: string;
  emptyDetail?: ReactNode;
  headerDetail?: ReactNode;
  headerEyebrow?: ReactNode;
  localTabs: readonly MonitoreoWorkbenchRailTab[];
  localTabsLabel?: string;
  modeCountLabel?: string;
  phaseSwitch?: ReactNode;
  routeLabel?: ReactNode;
  routeSectionLabel: ReactNode;
  routeShortLabel: ReactNode;
  statusAriaLabel?: string;
  statusItems?: readonly MonitoreoWorkbenchRailStatusItem[];
  summary?: ReactNode;
  onLocalTabChange: (key: string, label: string) => void;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MonitoreoWorkbenchRail({
  activeLocalTab,
  activeSection,
  activeView,
  ariaLabel,
  className,
  emptyDetail,
  headerDetail = "Tipo único del proyecto",
  headerEyebrow = "Ruta activa",
  localTabs,
  localTabsLabel = "Pestañas locales",
  modeCountLabel,
  phaseSwitch,
  routeLabel,
  routeSectionLabel,
  routeShortLabel,
  statusAriaLabel = "Estado del monitoreo",
  statusItems = [],
  summary,
  onLocalTabChange,
}: MonitoreoWorkbenchRailProps) {
  const ActiveIcon = activeSection.icon;
  const resolvedModeCountLabel = modeCountLabel ?? (localTabs.length ? `${localTabs.length} modos` : "1 modo");
  const localTabSignature = localTabs.map((tab) => tab.key).join(",");

  useEffect(() => {
    const activeTab = localTabs.find((tab) => tab.key === activeLocalTab);
    if (!activeTab) return undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: activeView, key: activeTab.key, label: activeTab.label },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeLocalTab, activeView, localTabSignature, localTabs]);

  useEffect(() => {
    const tabsByKey = new Map(localTabs.map((tab) => [tab.key, tab]));
    function handleLocalTabActive(event: Event) {
      const detail = (event as CustomEvent<{ view?: string; key?: unknown }>).detail;
      const key = typeof detail?.key === "string" ? detail.key : "";
      const tab = tabsByKey.get(key);
      if (detail?.view !== activeView || !tab || key === activeLocalTab) return;
      onLocalTabChange(tab.key, tab.label);
    }
    window.addEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
    return () => window.removeEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
  }, [activeLocalTab, activeView, localTabSignature, localTabs, onLocalTabChange]);

  function activateLocalTab(tab: MonitoreoWorkbenchRailTab) {
    onLocalTabChange(tab.key, tab.label);
    window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
      detail: { view: activeView, key: tab.key, label: tab.label },
    }));
  }

  return (
    <aside className={joinClasses("mon-workbench-rail pulso-sidebar", className)} aria-label={ariaLabel}>
      <div className="mon-rail-head">
        <span className="pulso-section-eyebrow">{headerEyebrow}</span>
        <strong>{routeShortLabel}</strong>
        <small>{headerDetail}</small>
      </div>

      {summary}

      <div className="mon-rail-section-label">
        <span>{localTabsLabel}</span>
        <em>{resolvedModeCountLabel}</em>
      </div>
      <div className="mon-section-current-card">
        <span>{routeSectionLabel}</span>
        <strong><ActiveIcon size={13} /> {activeSection.label}</strong>
        <small>{activeSection.desc}</small>
      </div>
      <div className="mon-section-local-tabs" role="tablist" aria-orientation="vertical" aria-label={`Pestañas locales de ${activeSection.label}`}>
        {localTabs.length ? localTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeLocalTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={`mon-nav-item is-${activeView}-${tab.key}${active ? " is-active" : ""}`}
              title={`${tab.label}: ${tab.detail}`}
              onClick={() => activateLocalTab(tab)}
            >
              <span className="mon-nav-icon"><Icon size={15} /></span>
              <span className="mon-nav-copy">
                <strong>{tab.label}</strong>
                <span>{tab.detail}</span>
              </span>
              {active ? <CheckCircle2 size={13} className="mon-nav-current" /> : null}
            </button>
          );
        }) : (
          <span className="mon-nav-item is-empty">
            <span className="mon-nav-icon"><ActiveIcon size={15} /></span>
            <span className="mon-nav-copy">
              <strong>{routeLabel ?? activeSection.label}</strong>
              <span>{emptyDetail ?? activeSection.desc}</span>
            </span>
          </span>
        )}
      </div>

      {phaseSwitch}

      {statusItems.length ? (
        <div className="mon-rail-status" aria-label={statusAriaLabel}>
          {statusItems.map((item) => (
            <div
              key={item.label}
              className={joinClasses("mon-rail-sync", item.ready && "is-ready", item.className)}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.detail ? <small>{item.detail}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
