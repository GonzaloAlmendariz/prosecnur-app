import { Fragment, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
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

function isLastUpdateLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("ultima actualizacion");
}

function compactLastUpdateValue(value: ReactNode) {
  if (typeof value !== "string") return value;
  const parts = value.split(",");
  if (parts.length < 2) return value;
  const date = parts[0].trim();
  const time = parts.slice(1).join(",").trim()
    .replace(/\s+a\.\s*m\./i, " a.m.")
    .replace(/\s+p\.\s*m\./i, " p.m.");
  if (!date || !time) return value;
  return (
    <>
      <span className="mon-rail-sync-date">{date}</span>
      <span className="mon-rail-sync-time">{time}</span>
    </>
  );
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
  const emptyRailLabel = typeof routeLabel === "string" ? routeLabel : activeSection.label;
  const emptyRailDetail = typeof emptyDetail === "string" ? emptyDetail : activeSection.desc;

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
    <aside className={joinClasses("mon-workbench-rail pulso-sidebar is-collapsible", className)} aria-label={ariaLabel}>
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
        {localTabs.length ? localTabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = activeLocalTab === tab.key;
          const tabStyle = {
            "--mon-nav-index": index,
            "--mon-nav-tip-y": `${19 + index * 44}px`,
          } as CSSProperties;
          return (
            <Fragment key={tab.key}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-label={`${tab.label}: ${tab.detail}`}
                className={`mon-nav-item is-${activeView}-${tab.key}${active ? " is-active" : ""}`}
                data-rail-label={tab.label}
                data-rail-tip={`${tab.label} · ${tab.detail}`}
                style={tabStyle}
                onClick={() => activateLocalTab(tab)}
              >
                <span className="mon-nav-icon"><Icon size={15} /></span>
                <span className="mon-nav-copy">
                  <strong>{tab.label}</strong>
                  <span>{tab.detail}</span>
                </span>
                {active ? <CheckCircle2 size={13} className="mon-nav-current" /> : null}
              </button>
              <span className="mon-nav-tip" style={tabStyle} aria-hidden="true">{tab.label} · {tab.detail}</span>
            </Fragment>
          );
        }) : (
          <span
            className="mon-nav-item is-empty"
            data-rail-label={emptyRailLabel}
            data-rail-tip={`${emptyRailLabel} · ${emptyRailDetail}`}
          >
            <span className="mon-nav-icon"><ActiveIcon size={15} /></span>
            <span className="mon-nav-tip" aria-hidden="true">{emptyRailLabel} · {emptyRailDetail}</span>
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
          {statusItems.map((item) => {
            const isLastUpdate = isLastUpdateLabel(item.label);
            return (
              <div
                key={item.label}
                className={joinClasses(
                  "mon-rail-sync",
                  item.ready && "is-ready",
                  isLastUpdate && "is-last-update",
                  item.className,
                )}
              >
                <span>{item.label}</span>
                <strong>{isLastUpdate ? compactLastUpdateValue(item.value) : item.value}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}
