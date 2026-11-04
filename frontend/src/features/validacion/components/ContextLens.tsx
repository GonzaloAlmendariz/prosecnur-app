// =============================================================================
// ContextLens.tsx — panel lateral (o centrado) con pestañas internas opcionales
// =============================================================================
// Un solo patrón de overlay para lo que necesita más espacio que un hovercard
// (Validación › Instrumento, Carga › Preguntas, Formularios › Catálogos).
//
// Desde L1 monta las primitivas del kit: `placement="right"` es el Sideover y
// `placement="center"` el Dialog. Velo, Escape, click fuera, foco atrapado y de
// vuelta, portal y capa los ponen ellas; aquí sólo vive la API (anchos,
// pestañas internas, acciones de cabecera), que no cambia para los consumidores.
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import { Dialog } from "../../../components/Dialog";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { Sideover } from "../../../components/Sideover";
import "./contextLens.css";

export type ContextLensTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Cantidad/badge opcional al lado del label */
  badge?: number | string | null;
  content: ReactNode;
};

export type ContextLensProps = {
  open: boolean;
  onClose: () => void;
  /** Título principal mostrado en el header del panel */
  title: ReactNode;
  /** Subtítulo opcional — una línea bajo el título */
  subtitle?: ReactNode;
  /** Área de acciones del header (botones custom) */
  actions?: ReactNode;
  /** Contenido sin tabs (alternativa a tabs) */
  children?: ReactNode;
  /** Tabs internas — si se proveen, `children` se ignora */
  tabs?: ContextLensTab[];
  /** Tab activa controlada (opcional) */
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  /** Ancho del panel — default "standard" (640px) */
  variant?: "standard" | "wide" | "full";
  /**
   * Posición del panel:
   *   - "right" (default): desliza desde la derecha, pegado al borde.
   *   - "center": modal centrado con padding alrededor — recomendado cuando
   *     el contenido es rico y el contexto detrás importa menos (ej. drill
   *     completo de una regla).
   */
  placement?: "right" | "center";
  /** aria-labelledby — si el title no es string */
  ariaLabel?: string;
};

export function contextLensTabA11y(contextLensId: string, index: number) {
  return {
    tabId: `${contextLensId}-tab-${index}`,
    panelId: `${contextLensId}-tabpanel`,
  };
}

export default function ContextLens({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  tabs,
  activeTabId,
  onTabChange,
  variant = "standard",
  placement = "right",
  ariaLabel,
}: ContextLensProps) {
  const contextLensId = useId();
  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    activeTabId ?? tabs?.[0]?.id ?? "",
  );
  const effectiveTab = activeTabId ?? internalActiveTab;

  const handleTab = useCallback(
    (id: string) => {
      if (onTabChange) onTabChange(id);
      else setInternalActiveTab(id);
    },
    [onTabChange],
  );

  const activeTab = tabs?.find((t) => t.id === effectiveTab) ?? tabs?.[0];
  const activeTabIndex = tabs?.findIndex((tab) => tab.id === activeTab?.id) ?? -1;
  const activeTabA11y = tabs && tabs.length > 1 && activeTabIndex >= 0
    ? contextLensTabA11y(contextLensId, activeTabIndex)
    : undefined;

  const barraPestanas = tabs && tabs.length > 1 ? (
    <GlidingTabList
      as="nav"
      activeKey={effectiveTab}
      className="pulso-lens-pestanas"
      style={{ "--pulso-gliding-indicator-radius": "0px" } as CSSProperties}
      role="tablist"
      aria-label="Secciones del panel"
    >
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.id}
          tab={tab}
          tabA11y={contextLensTabA11y(contextLensId, index)}
          active={tab.id === effectiveTab}
          onClick={() => handleTab(tab.id)}
        />
      ))}
    </GlidingTabList>
  ) : null;

  // Acciones de cabecera y pestañas internas van en la banda entre la cabecera
  // y el cuerpo (el `stepper` de las primitivas).
  const banda = actions || barraPestanas ? (
    <div className="pulso-lens-banda">
      {actions ? <div className="pulso-lens-acciones">{actions}</div> : null}
      {barraPestanas}
    </div>
  ) : undefined;

  const cuerpo = (
    <div
      id={activeTabA11y?.panelId}
      role={activeTabA11y ? "tabpanel" : undefined}
      aria-labelledby={activeTabA11y?.tabId}
      tabIndex={activeTabA11y ? 0 : undefined}
      className="pulso-lens-cuerpo"
    >
      {tabs ? activeTab?.content : children}
    </div>
  );

  const comun = {
    open,
    onOpenChange: (abierto: boolean) => {
      if (!abierto) onClose();
    },
    title: title ?? ariaLabel,
    subtitle,
    stepper: banda,
    flush: true,
    closeLabel: "Cerrar panel",
    className: `pulso-lens pulso-lens--${variant}`,
  };

  return placement === "center" ? (
    <Dialog {...comun} size={variant === "standard" ? "md" : "lg"}>
      {cuerpo}
    </Dialog>
  ) : (
    <Sideover {...comun}>{cuerpo}</Sideover>
  );
}

// -----------------------------------------------------------------------------
// Tab button interno
// -----------------------------------------------------------------------------

function TabButton({
  tab,
  tabA11y,
  active,
  onClick,
}: {
  tab: ContextLensTab;
  tabA11y: ReturnType<typeof contextLensTabA11y>;
  active: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 14px",
    borderRadius: 0,
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
    fontSize: "var(--pulso-type-subtitle-size)",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 120ms ease, border-color 120ms ease",
  };
  return (
    <button
      id={tabA11y.tabId}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={tabA11y.panelId}
      data-gliding-key={tab.id}
      onClick={onClick}
      style={style}
    >
      {tab.icon}
      <span>{tab.label}</span>
      {tab.badge != null && tab.badge !== "" && (
        <span
          style={{
            padding: "1px 6px",
            borderRadius: "var(--pulso-radius-chip)",
            background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
            color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            fontSize: "var(--pulso-type-micro-size)",
            fontWeight: 700,
            minWidth: 18,
            textAlign: "center",
            border: "1px solid",
            borderColor: active ? "var(--pulso-primary-border)" : "var(--pulso-border)",
          }}
        >
          {tab.badge}
        </span>
      )}
    </button>
  );
}
