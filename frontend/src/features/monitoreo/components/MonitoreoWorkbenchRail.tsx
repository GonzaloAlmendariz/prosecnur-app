import { useEffect } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ContextTabRail,
  type ContextTabRailEstado,
  type ContextTabRailItem,
} from "../../../components/ContextTabRail";
import { MonitoreoRailLastUpdate } from "./MonitoreoRailLastUpdate";

export type MonitoreoWorkbenchRailTab = {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  badge?: string;
  /**
   * Readiness canónica de la pestaña. Sustituye al viejo `status`, que era
   * binario —ready/warning más un risk— y no distinguía "sin configurar" de
   * "evaluado y correcto": por eso "0 reportes" y "Pendiente" se pintaban igual
   * que "Listo".
   */
  estado?: ContextTabRailEstado;
};

export type MonitoreoWorkbenchRailStatusItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  ready?: boolean;
  className?: string;
};

type MonitoreoWorkbenchRailProps = {
  pestanaActiva: string;
  activeSection: {
    label: string;
    desc: string;
    icon: LucideIcon;
  };
  seccionActiva: string;
  ariaLabel: string;
  className?: string;
  emptyDetail?: ReactNode;
  headerDetail?: ReactNode;
  headerEyebrow?: ReactNode;
  iconOnlyTabs?: boolean;
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
  onCambioPestana: (key: string, label: string) => void;
};

function isLastUpdateLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("ultima actualizacion");
}

export function MonitoreoWorkbenchRail({
  pestanaActiva,
  activeSection,
  seccionActiva,
  ariaLabel,
  className,
  localTabs,
  statusAriaLabel = "Estado del monitoreo",
  statusItems = [],
  onCambioPestana,
}: MonitoreoWorkbenchRailProps) {
  const localTabSignature = localTabs.map((tab) => tab.key).join(",");
  // `badge` y `status` llegaban por props y morían acá: los perfiles los
  // calculaban con detalle y el rail nunca los veía. Ahora se propagan.
  const contextItems: readonly ContextTabRailItem<string>[] = localTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    description: tab.detail,
    icon: tab.icon,
    badge: tab.badge,
    estado: tab.estado,
  }));

  useEffect(() => {
    const activeTab = localTabs.find((tab) => tab.key === pestanaActiva);
    if (!activeTab) return undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: seccionActiva, key: activeTab.key, label: activeTab.label },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pestanaActiva, seccionActiva, localTabSignature, localTabs]);

  useEffect(() => {
    const tabsByKey = new Map(localTabs.map((tab) => [tab.key, tab]));
    function handleLocalTabActive(event: Event) {
      const detail = (event as CustomEvent<{ view?: string; key?: unknown }>).detail;
      const key = typeof detail?.key === "string" ? detail.key : "";
      const tab = tabsByKey.get(key);
      if (detail?.view !== seccionActiva || !tab || key === pestanaActiva) return;
      onCambioPestana(tab.key, tab.label);
    }
    window.addEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
    return () => window.removeEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
  }, [pestanaActiva, seccionActiva, localTabSignature, localTabs, onCambioPestana]);

  function activateLocalTab(tab: MonitoreoWorkbenchRailTab) {
    onCambioPestana(tab.key, tab.label);
    window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
      detail: { view: seccionActiva, key: tab.key, label: tab.label },
    }));
  }

  function activateLocalTabByKey(key: string) {
    const tab = localTabs.find((candidate) => candidate.key === key);
    if (tab) activateLocalTab(tab);
  }

  const onlyStatusItem = statusItems.length === 1 ? statusItems[0] : undefined;
  const footer = onlyStatusItem
    && isLastUpdateLabel(onlyStatusItem.label)
    && typeof onlyStatusItem.value === "string" ? (
      <MonitoreoRailLastUpdate
        value={onlyStatusItem.value}
        label={onlyStatusItem.label}
        ariaLabel={statusAriaLabel}
        className={onlyStatusItem.className}
      />
    ) : statusItems.length ? (
    <div className="pulso-context-tab-rail-meta" aria-label={statusAriaLabel}>
      {statusItems.map((item) => {
        return (
          <span
            key={item.label}
            className={item.className}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </span>
        );
      })}
    </div>
  ) : null;

  return (
    <ContextTabRail
      ariaLabel={ariaLabel || `Pestañas locales de ${activeSection.label}`}
      activeKey={pestanaActiva}
      items={contextItems}
      panelId={`monitoreo-${seccionActiva}-panel`}
      tabId={(key) => `monitoreo-${seccionActiva}-tab-${key}`}
      onChange={activateLocalTabByKey}
      className={className}
      footer={footer}
    />
  );
}
