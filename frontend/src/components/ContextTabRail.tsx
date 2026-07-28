import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "../vendor/lucide-react";
import { GlidingTabList } from "./GlidingTabList";
import "./ContextTabRail.css";

/**
 * Estado de readiness de una pestaña. Mismo vocabulario que la máquina de
 * estados de Monitoreo; se declara acá porque el rail es compartido y no puede
 * importar de un feature.
 */
export type ContextTabRailEstado =
  | "sin-configurar"
  | "no-evaluado"
  | "parcial"
  | "bloqueado"
  | "listo";

export type ContextTabRailItem<K extends string> = {
  key: K;
  label: string;
  description?: string;
  icon: LucideIcon;
  disabled?: boolean;
  /**
   * Contador corto (casos pendientes, alertas). Viaja en el tooltip y en el
   * `aria-label`; el cuadrante del ícono no lo pinta.
   */
  badge?: string;
  /**
   * Readiness de la pestaña. El rail es icon-only por defecto y su cuadrante de
   * 40×40 no admite marcas encima del ícono, así que el estado se dice con
   * palabras en el tooltip y en el nombre accesible. La variante etiquetada lo
   * muestra junto al nombre, sin convertirlo en un badge sobre el ícono.
   */
  estado?: ContextTabRailEstado;
  /** Etiqueta de dominio opcional para `estado` (por ejemplo, "Por definir"). */
  estadoLabel?: string;
};

const ETIQUETA_ESTADO_RAIL: Record<ContextTabRailEstado, string> = {
  "sin-configurar": "Sin configurar",
  "no-evaluado": "No evaluado",
  parcial: "Parcial",
  bloqueado: "Bloqueado",
  listo: "Listo",
};

/** Descripción completa de una pestaña: detalle, contador y estado, en texto. */
function descripcionDeItem<K extends string>(item: ContextTabRailItem<K>) {
  return [
    item.description,
    item.badge ? `${item.badge} pendientes` : "",
    item.estadoLabel || (item.estado ? ETIQUETA_ESTADO_RAIL[item.estado] : ""),
  ].filter(Boolean).join(" · ");
}

export type ContextTabRailProps<K extends string> = {
  ariaLabel: string;
  activeKey: K;
  items: readonly ContextTabRailItem<K>[];
  panelId: string | ((key: K) => string);
  tabId: (key: K) => string;
  onChange: (key: K) => void;
  disabled?: boolean;
  className?: string;
  footer?: ReactNode;
  /**
   * Renderiza nombre y estado dentro de cada fila cuando el CSS dispone de un
   * rail expandido. Es opt-in: sin esta prop el contrato global sigue siendo
   * icon-only.
   */
  showLabels?: boolean;
};

type ContextTabTooltip<K extends string> = {
  key: K;
  label: string;
  description?: string;
  top: number;
  side: "left" | "right";
  edge: number;
  accent: string;
};

type ContextTabTooltipStyle = CSSProperties & {
  "--pulso-nav-accent"?: string;
};

const TOOLTIP_GAP = 8;
const TOOLTIP_ESTIMATED_WIDTH = 220;
const TOOLTIP_VIEWPORT_MARGIN = 10;
const TOOLTIP_VERTICAL_SAFE_ZONE = 44;
const LABELED_RAIL_MEDIA_QUERY = "(min-width: 1321px) and (min-height: 721px)";

function resolvePanelId<K extends string>(
  panelId: ContextTabRailProps<K>["panelId"],
  key: K,
): string {
  return typeof panelId === "function" ? panelId(key) : panelId;
}

export function ContextTabRail<K extends string>({
  ariaLabel,
  activeKey,
  items,
  panelId,
  tabId,
  onChange,
  disabled = false,
  className,
  footer,
  showLabels = false,
}: ContextTabRailProps<K>) {
  const [tooltip, setTooltip] = useState<ContextTabTooltip<K> | null>(null);

  const showTooltip = (
    item: ContextTabRailItem<K>,
    trigger: HTMLButtonElement,
  ) => {
    if (typeof window === "undefined") return;
    if (showLabels && window.matchMedia(LABELED_RAIL_MEDIA_QUERY).matches) return;
    const rect = trigger.getBoundingClientRect();
    const opensRight = rect.right + TOOLTIP_GAP + TOOLTIP_ESTIMATED_WIDTH
      <= window.innerWidth - TOOLTIP_VIEWPORT_MARGIN;
    const styles = window.getComputedStyle(trigger);
    const accent = styles.getPropertyValue("--module-accent").trim()
      || styles.getPropertyValue("--pulso-primary").trim();

    setTooltip({
      key: item.key,
      label: item.label,
      // El estado viaja en el tooltip porque el cuadrante del rail no lleva
      // marcas: es el único sitio donde "Parcial" o "Bloqueado" caben como palabra.
      description: descripcionDeItem(item) || undefined,
      top: Math.min(
        Math.max(rect.top + rect.height / 2, TOOLTIP_VERTICAL_SAFE_ZONE),
        window.innerHeight - TOOLTIP_VERTICAL_SAFE_ZONE,
      ),
      side: opensRight ? "right" : "left",
      edge: opensRight
        ? rect.right + TOOLTIP_GAP
        : window.innerWidth - rect.left + TOOLTIP_GAP,
      accent,
    });
  };

  const hideTooltip = (key: K) => {
    setTooltip((current) => current?.key === key ? null : current);
  };

  const selectSerializedKey = (serializedKey: string) => {
    const item = items.find((candidate) => candidate.key === serializedKey);
    if (!item || disabled || item.disabled) return;
    onChange(item.key);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById(tabId(item.key))?.scrollIntoView({ block: "nearest" });
      });
    }
  };

  const tooltipStyle: ContextTabTooltipStyle | undefined = tooltip
    ? {
        top: tooltip.top,
        ...(tooltip.side === "right" ? { left: tooltip.edge } : { right: tooltip.edge }),
        "--pulso-nav-accent": tooltip.accent || undefined,
      }
    : undefined;

  return (
    <aside
      className={[
        "pulso-context-tab-rail",
        showLabels ? "pulso-context-tab-rail--labeled" : undefined,
        className,
      ].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      <GlidingTabList
        activeKey={activeKey}
        mode="tabs"
        orientation="vertical"
        role="tablist"
        aria-label={ariaLabel}
        className="pulso-context-tab-list"
        onRovingKeyChange={selectSerializedKey}
        onScroll={() => setTooltip(null)}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.key === activeKey;
          const itemDisabled = disabled || Boolean(item.disabled);
          const descripcion = descripcionDeItem(item);
          const estadoLabel = item.estadoLabel
            || (item.estado ? ETIQUETA_ESTADO_RAIL[item.estado] : "");
          const tooltipText = descripcion
            ? `${item.label}\n${descripcion}`
            : item.label;

          return (
            <button
              key={item.key}
              id={tabId(item.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={resolvePanelId(panelId, item.key)}
              aria-disabled={itemDisabled}
              aria-label={descripcion ? `${item.label}. ${descripcion}` : item.label}
              aria-describedby={tooltip?.key === item.key ? `${tabId(item.key)}-tooltip` : undefined}
              disabled={itemDisabled}
              className="pulso-context-tab-item"
              data-gliding-key={item.key}
              data-nav-item=""
              data-nav-shape="row"
              data-nav-state={selected ? "selected" : undefined}
              data-rail-state={item.estado}
              data-rail-tooltip={tooltipText}
              onClick={() => {
                setTooltip(null);
                onChange(item.key);
              }}
              onMouseEnter={(event) => showTooltip(item, event.currentTarget)}
              onMouseLeave={() => hideTooltip(item.key)}
              onFocus={(event) => showTooltip(item, event.currentTarget)}
              onBlur={() => hideTooltip(item.key)}
            >
              {/* El cuadrante de 40×40 lleva el ícono y nada más: es el estándar
                  de rail de la casa y no admite badges ni puntos encima. El
                  estado y el contador viajan por tooltip, `aria-label` y el
                  encabezado del workbench, que es donde hay sitio para decirlo
                  con palabras. */}
              <Icon className="pulso-context-tab-icon" aria-hidden="true" focusable="false" />
              {showLabels ? (
                <span className="pulso-context-tab-copy">
                  <span className="pulso-context-tab-label">{item.label}</span>
                  {(estadoLabel || item.description) ? (
                    <span className="pulso-context-tab-detail">
                      {estadoLabel ? (
                        <span className="pulso-context-tab-state">{estadoLabel}</span>
                      ) : null}
                      {estadoLabel && item.description ? (
                        <span className="pulso-context-tab-separator" aria-hidden="true">·</span>
                      ) : null}
                      {item.description ? (
                        <span className="pulso-context-tab-description">{item.description}</span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </GlidingTabList>
      {footer ? <div className="pulso-context-tab-rail-footer">{footer}</div> : null}
      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              id={`${tabId(tooltip.key)}-tooltip`}
              role="tooltip"
              className="pulso-context-tab-tooltip"
              data-side={tooltip.side}
              style={tooltipStyle}
            >
              <strong>{tooltip.label}</strong>
              {tooltip.description ? <span>{tooltip.description}</span> : null}
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
