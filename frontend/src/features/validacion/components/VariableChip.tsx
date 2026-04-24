// =============================================================================
// VariableChip.tsx — chip de variable con hovercard rico
// =============================================================================
// Unifica la forma en que se presenta una variable en toda la sección
// Validación. Reemplaza los chips inline ad-hoc (monofont + backgroundSoft)
// por un componente con:
//   - chip compacto mostrando [TIPO] `var_name`
//   - hovercard al mantener el mouse 500ms que muestra:
//       • label humano full
//       • tipo, sección, grupo
//       • distribución básica si hay datos (N filled / N total, top valores)
//       • deep link a Explorar
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import type { VarType } from "../narrative";
import { normalizeVarType, varTypeTokens } from "../narrative";

// -----------------------------------------------------------------------------
// Tipos públicos
// -----------------------------------------------------------------------------

export type VariableHoverData = {
  /** Label humano completo (pregunta del cuestionario) */
  label?: string | null;
  /** Sección/grupo donde vive la variable */
  seccion?: string | null;
  /** Grupo inmediato (begin_group nearest parent) */
  grupo?: string | null;
  /** Relevant del grupo, si aplica */
  grupo_relevant?: string | null;
  /** Estadísticas rápidas (del último audit o explorar) */
  stats?: {
    n_total?: number;
    n_validos?: number;
    missing_pct?: number;
    /** Top valores con conteo (máx 5) */
    top_valores?: Array<{ label: string; n: number }>;
    /** Min/max para numéricas */
    min?: number | null;
    max?: number | null;
    media?: number | null;
  } | null;
};

export type VariableChipProps = {
  /** Nombre técnico de la variable (e.g., "p10_ule") */
  name: string;
  /** Tipo ODK normalizado (e.g., "select_multiple") */
  type?: string | null;
  /** Data extra para hovercard — opcional; si no viene, el chip funciona sin popover */
  hoverData?: VariableHoverData;
  /** Variantes visuales */
  variant?: "default" | "mono" | "inline";
  /** Click handler (deep link manual si no hay onOpenInExplorar) */
  onClick?: () => void;
  /** Deep link a Explorar — si se provee, el hovercard muestra CTA */
  onOpenInExplorar?: () => void;
  /** Hide hovercard (chip pasivo) */
  disableHover?: boolean;
  /** Estilos adicionales inline si se necesita */
  style?: CSSProperties;
};

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------

export default function VariableChip({
  name,
  type,
  hoverData,
  variant = "default",
  onClick,
  onOpenInExplorar,
  disableHover = false,
  style,
}: VariableChipProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const varType: VarType = normalizeVarType(type ?? null);
  const tokens = varTypeTokens(varType);

  const clearTimers = useCallback(() => {
    if (enterTimer.current) { window.clearTimeout(enterTimer.current); enterTimer.current = null; }
    if (leaveTimer.current) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null; }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (disableHover || pinned) return;
    clearTimers();
    // Delay para no disparar el hovercard accidentalmente.
    enterTimer.current = window.setTimeout(() => {
      if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect());
      setOpen(true);
    }, 500);
  }, [disableHover, pinned, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    if (pinned) return;
    clearTimers();
    leaveTimer.current = window.setTimeout(() => setOpen(false), 180);
  }, [pinned, clearTimers]);

  const handleCardEnter = useCallback(() => {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const handleCardLeave = useCallback(() => {
    if (pinned) return;
    leaveTimer.current = window.setTimeout(() => setOpen(false), 180);
  }, [pinned]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onClick) {
        e.stopPropagation();
        onClick();
        return;
      }
      // Sin onClick custom, el click pinea/despinea el hovercard.
      e.stopPropagation();
      if (!disableHover) {
        if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect());
        if (pinned) {
          setPinned(false);
          setOpen(false);
        } else {
          setPinned(true);
          setOpen(true);
        }
      }
    },
    [onClick, disableHover, pinned],
  );

  // Cerrar al hacer Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Cleanup timers on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  // ---- Estilos según variant -------------------------------------------------
  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: variant === "inline" ? "0 4px" : "2px 7px",
    borderRadius: variant === "inline" ? 4 : "var(--pulso-radius-chip)",
    fontSize: variant === "inline" ? "inherit" : 11,
    fontWeight: 700,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    background: tokens.bg,
    color: tokens.fg,
    border: variant === "inline" ? "none" : `1px solid ${tokens.border}`,
    cursor: onClick || !disableHover ? "pointer" : "default",
    whiteSpace: "nowrap",
    lineHeight: 1.4,
    verticalAlign: "baseline",
    ...style,
  };

  const typeLabelStyle: CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.3,
    opacity: 0.75,
    fontFamily: "inherit",
  };

  return (
    <>
      <span
        ref={anchorRef}
        style={chipStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role={onClick || !disableHover ? "button" : undefined}
        tabIndex={onClick || !disableHover ? 0 : undefined}
        aria-label={`Variable ${name}${hoverData?.label ? `: ${hoverData.label}` : ""}`}
      >
        {varType && variant !== "mono" && (
          <span style={typeLabelStyle}>{tokens.label}</span>
        )}
        <span>{name}</span>
      </span>
      {open && anchorRect && !disableHover && (
        <VariableHoverCard
          name={name}
          type={type}
          tokens={tokens}
          data={hoverData}
          anchorRect={anchorRect}
          pinned={pinned}
          onOpenInExplorar={onOpenInExplorar}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          onClose={() => { setPinned(false); setOpen(false); }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// VariableHoverCard — popover posicionado con portal
// -----------------------------------------------------------------------------

type HoverCardProps = {
  name: string;
  type?: string | null;
  tokens: ReturnType<typeof varTypeTokens>;
  data?: VariableHoverData;
  anchorRect: DOMRect;
  pinned: boolean;
  onOpenInExplorar?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
};

function VariableHoverCard({
  name,
  type,
  tokens,
  data,
  anchorRect,
  pinned,
  onOpenInExplorar,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: HoverCardProps) {
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean }>(() =>
    computePosition(anchorRect),
  );
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPos(computePosition(anchorRect));
  }, [anchorRect]);

  // Recalcular al hacer scroll/resize mientras está abierto.
  useEffect(() => {
    const onResize = () => setPos(computePosition(anchorRect));
    window.addEventListener("scroll", onResize, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onResize, true);
      window.removeEventListener("resize", onResize);
    };
  }, [anchorRect]);

  const stats = data?.stats;

  return createPortal(
    <div
      ref={cardRef}
      className="pulso-hovercard-in"
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 200,
        width: 300,
        padding: 14,
        borderRadius: "var(--pulso-radius-panel)",
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        boxShadow: "var(--pulso-shadow-high)",
        fontSize: 12,
        color: "var(--pulso-text)",
        pointerEvents: "auto",
      }}
    >
      {/* Header: nombre + tipo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--pulso-text)",
          }}
        >
          {name}
        </span>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: "var(--pulso-radius-chip)",
            background: tokens.bg,
            color: tokens.fg,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.3,
            border: `1px solid ${tokens.border}`,
          }}
        >
          {tokens.label}
        </span>
      </div>

      {/* Label humano */}
      {data?.label && (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pulso-text)", marginBottom: 8 }}>
          {data.label}
        </div>
      )}

      {/* Sección / grupo */}
      {(data?.seccion || data?.grupo) && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: 8, lineHeight: 1.55 }}>
          {data.seccion && <div>Sección: <strong style={{ color: "var(--pulso-text)" }}>{data.seccion}</strong></div>}
          {data.grupo && data.grupo !== data.seccion && (
            <div>Grupo: <strong style={{ color: "var(--pulso-text)" }}>{data.grupo}</strong></div>
          )}
          {data.grupo_relevant && (
            <div style={{ marginTop: 2 }}>
              Activa si: <code style={{ fontSize: 11 }}>{data.grupo_relevant}</code>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <Stats tokens={tokens} stats={stats} />
      )}

      {/* Deep link */}
      {onOpenInExplorar && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--pulso-border)" }}>
          <button
            type="button"
            onClick={() => {
              onOpenInExplorar();
              onClose();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid var(--pulso-primary-border)",
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <ExternalLink size={12} />
            Abrir en Explorar
          </button>
        </div>
      )}

      {pinned && (
        <div
          style={{
            fontSize: 10,
            color: "var(--pulso-text-soft)",
            marginTop: 8,
            textAlign: "right",
            fontStyle: "italic",
          }}
        >
          Fijado · Esc o click afuera cierra
        </div>
      )}
    </div>,
    document.body,
  );
}

// -----------------------------------------------------------------------------
// Stats block — render específico según tipo de variable
// -----------------------------------------------------------------------------

function Stats({
  tokens,
  stats,
}: {
  tokens: ReturnType<typeof varTypeTokens>;
  stats: NonNullable<VariableHoverData["stats"]>;
}) {
  const total = stats.n_total ?? 0;
  const validos = stats.n_validos ?? 0;
  const pct = stats.missing_pct ?? (total > 0 ? (1 - validos / total) * 100 : 0);

  return (
    <div style={{ fontSize: 11, lineHeight: 1.55 }}>
      {(stats.n_total != null || stats.n_validos != null) && (
        <div style={{ color: "var(--pulso-text-soft)", marginBottom: 6 }}>
          <strong style={{ color: "var(--pulso-text)" }}>{fmtNum(validos)}</strong> con valor
          {total > 0 && (
            <> · <strong style={{ color: "var(--pulso-text)" }}>{fmtNum(total - validos)}</strong> vacíos
            {pct > 0 && <> ({pct.toFixed(1)}%)</>}</>
          )}
        </div>
      )}

      {stats.top_valores && stats.top_valores.length > 0 && (
        <TopValores tokens={tokens} values={stats.top_valores.slice(0, 5)} />
      )}

      {(stats.min != null || stats.max != null || stats.media != null) && (
        <div style={{ color: "var(--pulso-text-soft)", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          {stats.min != null && <span>min: <strong>{fmtNum(stats.min)}</strong></span>}
          {stats.max != null && <span>max: <strong>{fmtNum(stats.max)}</strong></span>}
          {stats.media != null && <span>media: <strong>{fmtNum(stats.media, 1)}</strong></span>}
        </div>
      )}
    </div>
  );
}

function TopValores({
  tokens,
  values,
}: {
  tokens: ReturnType<typeof varTypeTokens>;
  values: Array<{ label: string; n: number }>;
}) {
  const maxN = Math.max(...values.map((v) => v.n), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
      {values.map((v) => {
        const w = Math.max(4, Math.round((v.n / maxN) * 100));
        return (
          <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                color: "var(--pulso-text)",
                flex: "0 0 110px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={v.label}
            >
              {v.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                background: "var(--pulso-surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  background: tokens.fg,
                  opacity: 0.7,
                  transition: "width 300ms ease-out",
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", flex: "0 0 30px", textAlign: "right" }}>
              {fmtNum(v.n)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function computePosition(rect: DOMRect): { top: number; left: number; below: boolean } {
  const cardWidth = 300;
  const cardHeightGuess = 220;
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Preferir abajo si hay espacio, sino arriba
  const spaceBelow = viewportH - rect.bottom;
  const below = spaceBelow > cardHeightGuess + margin || spaceBelow > rect.top;

  let top = below ? rect.bottom + margin : rect.top - cardHeightGuess - margin;
  top = Math.max(8, Math.min(top, viewportH - 8));

  let left = rect.left + rect.width / 2 - cardWidth / 2;
  left = Math.max(8, Math.min(left, viewportW - cardWidth - 8));

  return { top, left, below };
}

function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

// -----------------------------------------------------------------------------
// Componente helper para marcar una mención de variable en texto fluido.
// Uso: <Var name="edad">edad</Var>  (el children es opcional)
// -----------------------------------------------------------------------------

export function Var({
  name,
  type,
  hoverData,
  children,
  onOpenInExplorar,
}: {
  name: string;
  type?: string | null;
  hoverData?: VariableHoverData;
  children?: ReactNode;
  onOpenInExplorar?: () => void;
}) {
  return (
    <VariableChip
      name={children ? String(children) : name}
      type={type}
      hoverData={hoverData}
      variant="inline"
      onOpenInExplorar={onOpenInExplorar}
      style={{
        background: "var(--pulso-primary-soft)",
        color: "var(--pulso-narrative-emphasis)",
        border: "none",
        padding: "0 4px",
        margin: "0 1px",
        fontWeight: 700,
      }}
    />
  );
}
