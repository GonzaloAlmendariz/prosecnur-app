// =============================================================================
// RuleNarrative.tsx — presentación narrativa unificada de una regla
// =============================================================================
// Reemplaza las presentaciones dispersas de reglas (CompactRuleCard en
// Instrumento, ReglaRow en Custom, QueueRow en Limpieza, header de
// ReglaDrillPanel) con un solo componente con 3 variantes:
//
//   - "compact": card clickeable para listas/grids (InstrumentoTab,
//     ReglasCustomTab lista, LimpiezaTab queue items).
//   - "hero": bloque destacado para el header de un editor/drill.
//   - "inline": una línea de texto, para menciones cortas.
//
// Usa los helpers del módulo `narrative/` y pinta variables con
// `VariableChip` (hovercards ricos al mantener el mouse).
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { ChevronRight, Star, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReglaLike, RoleKey } from "../narrative";
import {
  ROLE_META,
  buildExpectationHeadline,
  buildActivationSummary,
  buildCompareSummary,
  buildRoleSections,
  displayTargetName,
} from "../narrative";
import VariableChip from "./VariableChip";
import type { VariableHoverData } from "./VariableChip";

// -----------------------------------------------------------------------------
// Tipos públicos
// -----------------------------------------------------------------------------

export type RuleNarrativeVariant = "compact" | "hero" | "inline";

export type RuleNarrativeProps = {
  rule: ReglaLike;
  variant?: RuleNarrativeVariant;
  /** Si se provee, los VariableChip del narrative usan hovercards ricos. */
  variableHoverLookup?: (varName: string) => VariableHoverData | undefined;
  /** Lookup de labels humanos (para resolver target display name). */
  labelLookup?: (varName: string) => string | null;
  /** Estado de la regla en la cola de Limpieza (resuelta / pendiente). */
  status?: "pending" | "ready" | "ignored" | null;
  /** Cantidad de casos — mostrado como badge/pill */
  nCasos?: number | null;
  /** Porcentaje sobre el total */
  porcentaje?: number | null;
  /** Texto de acción actual si hay decisión guardada */
  currentAction?: string | null;
  /** Seleccionada (variante compact resalta el card) */
  selected?: boolean;
  /** Click handler (variant compact y hero) */
  onClick?: () => void;
  /** Click "abrir detalle" explícito (variant compact muestra chevron) */
  onOpenDetail?: () => void;
  /** Abrir variable en Explorar (pasa al VariableChip / Var) */
  onOpenVariableInExplorar?: (varName: string) => void;
  /**
   * Desactivar hovercards de los chips de variable. Útil en previews
   * del editor donde el hovercard portal genera re-renders en cascada
   * con cada keystroke (el preview se actualiza reactivamente) y no
   * aporta info extra — el usuario está precisamente editando la regla
   * y ya ve los datos de sus variables en el propio paso del wizard.
   */
  disableVariableHover?: boolean;
  /** Estilos custom */
  style?: CSSProperties;
};

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------

export default function RuleNarrative({
  rule,
  variant = "compact",
  variableHoverLookup,
  labelLookup,
  status = null,
  nCasos,
  porcentaje,
  currentAction,
  selected = false,
  onClick,
  onOpenDetail,
  onOpenVariableInExplorar,
  disableVariableHover = false,
  style,
}: RuleNarrativeProps) {
  const label = labelLookup ?? (() => null);
  const roleSections = useMemo(() => buildRoleSections(rule, label), [rule, label]);
  const targetDisplay = useMemo(() => displayTargetName(rule, label), [rule, label]);

  const headline = useMemo(
    () => buildExpectationHeadline(rule, targetDisplay),
    [rule, targetDisplay],
  );
  const activation = useMemo(
    () => buildActivationSummary(rule, roleSections),
    [rule, roleSections],
  );
  const compareText = useMemo(
    () => buildCompareSummary(rule, roleSections),
    [rule, roleSections],
  );

  const fuente = rule.fuente ?? "instrumento";
  const severidad = rule.severidad ?? "info";

  const resolvedHover = (name: string): VariableHoverData | undefined =>
    variableHoverLookup?.(name);

  const variableType = (name: string): string | null => {
    // Heurística: si la regla tiene tipo_variable, lo usamos para la variable target
    const roles = rule.variable_roles ?? {};
    const target = Array.isArray(roles.target) ? roles.target[0] : roles.target;
    if (target === name && rule.tipo_variable) return rule.tipo_variable;
    return null;
  };

  // ---- Variant: inline ----------------------------------------------------
  if (variant === "inline") {
    return (
      <span style={{ fontSize: "var(--pulso-narrative-size)", lineHeight: "var(--pulso-narrative-line-height)", ...style }}>
        {renderWithVariables(headline, rule, { resolvedHover, variableType, onOpenVariableInExplorar, disableVariableHover })}
      </span>
    );
  }

  // ---- Variant: compact (card clickeable) ---------------------------------
  if (variant === "compact") {
    const isPending = status === "pending";
    const isResolved = status === "ready" || status === "ignored";
    return (
      <article
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 14px",
          borderRadius: "var(--pulso-radius-card)",
          border: `1px solid ${selected ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
          background: selected
            ? "var(--pulso-primary-soft)"
            : isResolved
            ? "var(--pulso-surface-2)"
            : "var(--pulso-surface)",
          cursor: onClick ? "pointer" : "default",
          opacity: isResolved ? 0.75 : 1,
          transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
          boxShadow: selected ? "var(--pulso-shadow-soft)" : "var(--pulso-shadow-low)",
          ...style,
        }}
      >
        {/* Top row: badges + n casos.
            El contenedor exterior no hace wrap — así el CaseBadge siempre
            queda anclado arriba-derecha y no se salta a una segunda línea
            cuando los chips del lado izquierdo son muchos. Los chips
            izquierdos sí pueden envolverse dentro de su propia caja
            (min-width: 0 + flex-wrap para que respeten el espacio). */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
            <SourceBadge fuente={fuente} />
            <CategoryBadge categoria_ux={rule.categoria_ux ?? null} />
            <SeverityDot severidad={severidad} />
          </div>
          {typeof nCasos === "number" && (
            <div style={{ flexShrink: 0 }}>
              <CaseBadge n={nCasos} porcentaje={porcentaje} highlight={isPending} />
            </div>
          )}
        </div>

        {/* Narrativa */}
        <div
          style={{
            fontSize: "var(--pulso-narrative-size)",
            lineHeight: "var(--pulso-narrative-line-height)",
            color: "var(--pulso-narrative-color)",
            fontWeight: 500,
          }}
        >
          {renderWithVariables(headline, rule, { resolvedHover, variableType, onOpenVariableInExplorar, disableVariableHover })}
        </div>

        {/* Bottom row: activación + acción actual + chevron */}
        {(activation || compareText || currentAction || onOpenDetail) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 11,
              color: "var(--pulso-text-soft)",
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {currentAction ? (
                <span style={{ color: "var(--pulso-primary)", fontWeight: 700 }}>
                  Acción: {currentAction}
                </span>
              ) : activation ? (
                activation
              ) : compareText ? (
                compareText
              ) : null}
            </div>
            {onOpenDetail && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid var(--pulso-border)",
                  color: "var(--pulso-primary)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                aria-label="Ver detalle de la regla"
              >
                Detalle
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  // ---- Variant: hero (bloque destacado, header de editor/drill) -----------
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "18px 20px",
        borderRadius: "var(--pulso-radius-panel)",
        background:
          "linear-gradient(180deg, var(--pulso-primary-soft) 0%, var(--pulso-surface) 72%)",
        border: "1px solid var(--pulso-primary-border)",
        boxShadow: "var(--pulso-shadow-soft)",
        ...style,
      }}
    >
      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <SourceBadge fuente={fuente} />
        <CategoryBadge categoria_ux={rule.categoria_ux ?? null} />
        <SeverityBadge severidad={severidad} />
        {typeof nCasos === "number" && (
          <CaseBadge n={nCasos} porcentaje={porcentaje} highlight={nCasos > 0} />
        )}
      </div>

      {/* Chip con la variable target (nombre técnico) — facilita el
          scan rápido en listas grandes con muchos labels similares.
          Se deriva de variable_roles.target o, en fallback, de la
          primera variable de la regla. */}
      {(() => {
        const target =
          (roleSections.find((s) => s.role === "target")?.items[0]?.key) ??
          (rule.variables && rule.variables.length > 0 ? rule.variables[0] : null);
        if (!target) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "var(--pulso-text-soft)",
              }}
            >
              Variable
            </span>
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                fontSize: 13,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "white",
                border: "1px solid var(--pulso-primary-border)",
                color: "var(--pulso-primary)",
              }}
            >
              {target}
            </code>
          </div>
        );
      })()}

      {/* Headline narrativo grande */}
      <div
        style={{
          fontSize: 18,
          lineHeight: 1.5,
          color: "var(--pulso-text)",
          fontWeight: 500,
          letterSpacing: "-0.1px",
        }}
      >
        {renderWithVariables(headline, rule, { resolvedHover, variableType, onOpenVariableInExplorar, disableVariableHover })}
      </div>

      {/* Sub-frases: activación + comparación */}
      {(activation || compareText) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, lineHeight: 1.55, color: "var(--pulso-text-soft)" }}>
          {activation && (
            <div>
              <RoleTag role="drivers" />{" "}
              {renderWithVariables(activation, rule, { resolvedHover, variableType, onOpenVariableInExplorar, disableVariableHover })}
            </div>
          )}
          {compareText && (
            <div>
              <RoleTag role="compare" />{" "}
              {renderWithVariables(compareText, rule, { resolvedHover, variableType, onOpenVariableInExplorar, disableVariableHover })}
            </div>
          )}
        </div>
      )}

      {/* Role chips compactos */}
      {roleSections.length > 0 && (
        <RoleChipsRow
          sections={roleSections}
          resolvedHover={resolvedHover}
          variableType={variableType}
          onOpenVariableInExplorar={onOpenVariableInExplorar}
          disableVariableHover={disableVariableHover}
        />
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Helper — renderiza un string con variables detectadas como VariableChip
// -----------------------------------------------------------------------------
// Busca patrones `«varname»` y los reemplaza con <Var>. Si el varname existe
// en rule.variables, se renderiza como chip; si no, queda como texto.

function renderWithVariables(
  text: string,
  rule: ReglaLike,
  ctx: {
    resolvedHover: (n: string) => VariableHoverData | undefined;
    variableType: (n: string) => string | null;
    onOpenVariableInExplorar?: (varName: string) => void;
    disableVariableHover?: boolean;
  },
): ReactNode {
  if (!text) return null;
  const vars = new Set((rule.variables ?? []).map((v) => v.toLowerCase()));

  // Regex: captura «contenido» pero sólo cuando parece var (alfanumérico+_.).
  // También detecta mentions sin comillas si coinciden con una variable conocida.
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const regex = /«([^»]+)»/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const candidate = m[1];
    const isVar = vars.has(candidate.toLowerCase()) ||
                  /^[A-Za-z_][\w.]*$/.test(candidate);
    if (isVar) {
      parts.push(
        <VariableChip
          key={`v-${m.index}`}
          name={candidate}
          type={ctx.variableType(candidate)}
          hoverData={ctx.resolvedHover(candidate)}
          variant="inline"
          disableHover={ctx.disableVariableHover}
          onOpenInExplorar={
            ctx.onOpenVariableInExplorar
              ? () => ctx.onOpenVariableInExplorar!(candidate)
              : undefined
          }
          style={{
            background: "var(--pulso-primary-soft)",
            color: "var(--pulso-narrative-emphasis)",
            border: "none",
            padding: "0 5px",
            margin: "0 1px",
            fontWeight: 700,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.92em",
          }}
        />,
      );
    } else {
      parts.push(`«${candidate}»`);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// -----------------------------------------------------------------------------
// Sub-componentes visuales
// -----------------------------------------------------------------------------

function SourceBadge({ fuente }: { fuente: string }) {
  const isCustom = fuente === "custom";
  return (
    <span
      title={isCustom ? "Regla personalizada" : "Regla del instrumento (XLSForm)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--pulso-radius-chip)",
        background: isCustom ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
        color: isCustom ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
        border: `1px solid ${isCustom ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {isCustom && <Star size={10} />}
      {isCustom ? "Personalizada" : "Instrumento"}
    </span>
  );
}

function CategoryBadge({ categoria_ux }: { categoria_ux: string | null }) {
  if (!categoria_ux) return null;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "var(--pulso-radius-chip)",
        background: "var(--pulso-surface-2)",
        color: "var(--pulso-text-soft)",
        border: "1px solid var(--pulso-border)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {categoria_ux}
    </span>
  );
}

function SeverityDot({ severidad }: { severidad: string }) {
  const color =
    severidad === "error"
      ? "var(--pulso-danger-fg)"
      : severidad === "advertencia"
      ? "var(--pulso-warn-fg)"
      : "var(--pulso-text-soft)";
  const labelMap: Record<string, string> = {
    error: "Alta",
    advertencia: "Media",
    info: "Baja",
  };
  return (
    <span
      title={`Severidad: ${labelMap[severidad] ?? severidad}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: "var(--pulso-text-soft)",
        fontWeight: 600,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {labelMap[severidad] ?? severidad}
    </span>
  );
}

function SeverityBadge({ severidad }: { severidad: string }) {
  const meta = {
    error: { icon: AlertCircle, bg: "var(--pulso-danger-bg)", fg: "var(--pulso-danger-fg)", border: "var(--pulso-danger-border)", label: "Alta" },
    advertencia: { icon: AlertTriangle, bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)", border: "var(--pulso-warn-border)", label: "Media" },
    info: { icon: Info, bg: "var(--pulso-info-bg)", fg: "var(--pulso-info-fg)", border: "var(--pulso-info-border)", label: "Baja" },
  }[severidad as "error" | "advertencia" | "info"] ?? {
    icon: Info,
    bg: "var(--pulso-info-bg)",
    fg: "var(--pulso-info-fg)",
    border: "var(--pulso-info-border)",
    label: severidad,
  };
  const Icon = meta.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--pulso-radius-chip)",
        background: meta.bg,
        color: meta.fg,
        border: `1px solid ${meta.border}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

function CaseBadge({
  n,
  porcentaje,
  highlight,
}: {
  n: number;
  porcentaje?: number | null;
  highlight?: boolean;
}) {
  const pct = porcentaje != null ? (Math.abs(porcentaje) > 1 ? porcentaje : porcentaje * 100) : null;
  const pctStr = pct != null && Number.isFinite(pct) ? ` · ${pct.toFixed(1)}%` : "";
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "var(--pulso-radius-chip)",
        background: highlight ? "var(--pulso-danger-bg)" : "var(--pulso-surface-2)",
        color: highlight ? "var(--pulso-danger-fg)" : "var(--pulso-text-soft)",
        border: `1px solid ${highlight ? "var(--pulso-danger-border)" : "var(--pulso-border)"}`,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
      aria-label={`${n} casos${pctStr}`}
    >
      {fmtCase(n)}{pctStr}
    </span>
  );
}

function RoleTag({ role }: { role: RoleKey }) {
  const meta = ROLE_META[role];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 7px",
        borderRadius: "var(--pulso-radius-chip)",
        background: meta.tokenBg,
        color: meta.tokenFg,
        border: `1px solid ${meta.tokenBorder}`,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        verticalAlign: "baseline",
      }}
    >
      <meta.Icon size={9} />
      {meta.eyebrow}
    </span>
  );
}

function RoleChipsRow({
  sections,
  resolvedHover,
  variableType,
  onOpenVariableInExplorar,
  disableVariableHover,
}: {
  sections: ReturnType<typeof buildRoleSections>;
  resolvedHover: (n: string) => VariableHoverData | undefined;
  variableType: (n: string) => string | null;
  onOpenVariableInExplorar?: (varName: string) => void;
  disableVariableHover?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {sections.map((section) => {
        const meta = ROLE_META[section.role];
        return (
          <div
            key={section.role}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "8px 10px",
              borderRadius: 10,
              background: meta.tokenBg,
              border: `1px solid ${meta.tokenBorder}`,
              minWidth: 120,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontWeight: 800,
                color: meta.tokenFg,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              <meta.Icon size={10} />
              {meta.eyebrow}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {section.items.map((item) => (
                <VariableChip
                  key={`${section.role}-${item.key}`}
                  name={item.key}
                  type={variableType(item.key)}
                  hoverData={resolvedHover(item.key) ?? { label: item.label ?? undefined }}
                  variant="default"
                  disableHover={disableVariableHover}
                  onOpenInExplorar={
                    onOpenVariableInExplorar
                      ? () => onOpenVariableInExplorar(item.key)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtCase(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat("es-PE").format(n);
  return `${formatted} ${n === 1 ? "caso" : "casos"}`;
}
