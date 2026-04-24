// =============================================================================
// ContextLens.tsx — panel lateral deslizable (reemplaza bubble modals)
// =============================================================================
// Un solo patrón de overlay para toda la sección Validación:
//   - Desliza desde la derecha con animación suave
//   - Backdrop semitransparente con blur
//   - Escape cierra, click en backdrop cierra
//   - Focus trap básico
//   - Tabs internas opcionales
//   - No tapa toda la pantalla (permite ver origen del click)
//
// Reemplaza:
//   - RuleBubbleModal en InstrumentoTab (pop modal flotante elegante pero ad hoc)
//   - Render inline pesado de ReglaDrillPanel en LimpiezaTab
//   - Futuros popups que requieran más espacio que un hovercard
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
  /** aria-labelledby — si el title no es string */
  ariaLabel?: string;
};

const WIDTHS: Record<NonNullable<ContextLensProps["variant"]>, string> = {
  standard: "min(640px, 92vw)",
  wide: "min(960px, 94vw)",
  full: "min(1180px, 96vw)",
};

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
  ariaLabel,
}: ContextLensProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    activeTabId ?? tabs?.[0]?.id ?? "",
  );
  const [closing, setClosing] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const effectiveTab = activeTabId ?? internalActiveTab;

  const handleTab = useCallback(
    (id: string) => {
      if (onTabChange) onTabChange(id);
      else setInternalActiveTab(id);
    },
    [onTabChange],
  );

  const handleClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [onClose]);

  // Manejo de Escape + focus trap básico + capturar focus al abrir
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      shellRef.current?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Tab" && shellRef.current) {
        // Focus trap mínimo: mantener tab dentro del shell
        const focusables = shellRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [open, handleClose]);

  if (!open && !closing) return null;

  const activeTab = tabs?.find((t) => t.id === effectiveTab) ?? tabs?.[0];

  return createPortal(
    <div
      className={closing ? "" : "pulso-lens-backdrop"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : ariaLabel}
        tabIndex={-1}
        className={closing ? "pulso-lens-slide-out" : "pulso-lens-slide-in"}
        style={{
          width: WIDTHS[variant],
          maxWidth: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--pulso-surface)",
          boxShadow: "var(--pulso-shadow-lens)",
          borderLeft: "1px solid var(--pulso-border)",
          borderTopLeftRadius: "var(--pulso-radius-lens)",
          borderBottomLeftRadius: "var(--pulso-radius-lens)",
          outline: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            flexShrink: 0,
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border)",
            background:
              "linear-gradient(180deg, var(--pulso-surface) 0%, var(--pulso-surface-2) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--pulso-text)",
                  lineHeight: 1.35,
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--pulso-text-soft)",
                    lineHeight: 1.5,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {actions}
              <button
                type="button"
                aria-label="Cerrar panel"
                onClick={handleClose}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--pulso-border)",
                  color: "var(--pulso-text-soft)",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Tabs (opcional) */}
        {tabs && tabs.length > 1 && (
          <nav
            role="tablist"
            aria-label="Secciones del panel"
            style={{
              flexShrink: 0,
              display: "flex",
              gap: 2,
              padding: "0 20px",
              borderBottom: "1px solid var(--pulso-border)",
              background: "var(--pulso-surface)",
              overflowX: "auto",
            }}
          >
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                active={tab.id === effectiveTab}
                onClick={() => handleTab(tab.id)}
              />
            ))}
          </nav>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 20px",
            background: "var(--pulso-surface)",
          }}
        >
          {tabs ? activeTab?.content : children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -----------------------------------------------------------------------------
// Tab button interno
// -----------------------------------------------------------------------------

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: ContextLensTab;
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
    borderBottom: active ? "2px solid var(--pulso-primary)" : "2px solid transparent",
    color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 120ms ease, border-color 120ms ease",
  };
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
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
            fontSize: 10,
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
