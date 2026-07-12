// =============================================================================
// RuleFlowDiagram.tsx — diagrama de flujo de la validación de una regla.
// =============================================================================
// Pinta la secuencia de nodos que produce `buildRuleFlow` (ruleFlowModel.ts),
// conectados por flechas. Cada nodo toma el color/ícono de su rol (ROLE_META)
// y muestra sus variables como chips. Vertical en drawer angosto, horizontal
// cuando hay ancho (container query en ruleDetail.css). Sin librerías externas.
// =============================================================================

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Calculator,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock,
  GitBranch,
  Hash,
  Info,
  ListChecks,
  Ruler,
  Scale,
  ShieldCheck,
} from "../../../vendor/lucide-react";
import { ROLE_META } from "../narrative";
import type { FlowNode, FlowVerdictKind, RuleFlow } from "../ruleFlowModel";

type NodeTheme = { bg: string; fg: string; border: string; Icon: LucideIcon };

function roleTheme(kind: "gate" | "drivers" | "target" | "compare"): NodeTheme {
  const meta = ROLE_META[kind];
  return { bg: meta.tokenBg, fg: meta.tokenFg, border: meta.tokenBorder, Icon: meta.Icon };
}

const CONDITION_ICONS: Record<string, LucideIcon> = {
  calculate_check: Calculator,
  range: Ruler,
  required: ShieldCheck,
  constraint: ShieldCheck,
  skip: GitBranch,
  coherence: Scale,
  duplicate: CircleDot,
  repeat_length: Hash,
};

function conditionIcon(iconKey: string | null | undefined): LucideIcon {
  if (iconKey && CONDITION_ICONS[iconKey]) return CONDITION_ICONS[iconKey];
  return ListChecks;
}

function verdictTheme(kind: FlowVerdictKind): NodeTheme {
  switch (kind) {
    case "clean":
      return {
        bg: "var(--pulso-success-bg)",
        fg: "var(--pulso-success-fg)",
        border: "var(--pulso-success-border)",
        Icon: CheckCircle2,
      };
    case "issues":
      return {
        bg: "var(--pulso-danger-bg)",
        fg: "var(--pulso-danger-fg)",
        border: "var(--pulso-danger-border)",
        Icon: CircleAlert,
      };
    case "misaligned":
    case "not_evaluated":
      return {
        bg: "var(--pulso-warn-bg)",
        fg: "var(--pulso-warn-fg)",
        border: "var(--pulso-warn-border)",
        Icon: AlertTriangle,
      };
    case "pending_child":
      return {
        bg: "var(--pulso-warn-bg)",
        fg: "var(--pulso-warn-fg)",
        border: "var(--pulso-warn-border)",
        Icon: Clock,
      };
    case "not_applicable":
      return {
        bg: "var(--pulso-surface-2)",
        fg: "var(--pulso-text-soft)",
        border: "var(--pulso-border)",
        Icon: Ban,
      };
    case "external":
      return {
        bg: "var(--pulso-surface-2)",
        fg: "var(--pulso-text-soft)",
        border: "var(--pulso-border)",
        Icon: Info,
      };
  }
}

function nodeTheme(node: FlowNode): NodeTheme {
  switch (node.kind) {
    case "gate":
    case "drivers":
    case "target":
    case "compare":
      return roleTheme(node.kind);
    case "condition":
      return {
        bg: "var(--pulso-primary-soft)",
        fg: "var(--pulso-primary)",
        border: "var(--pulso-primary-border)",
        Icon: conditionIcon(node.iconKey),
      };
    case "verdict":
      return verdictTheme(node.verdict ?? "clean");
  }
}

export default function RuleFlowDiagram({ flow }: { flow: RuleFlow }) {
  return (
    <div className="pulso-ruleflow" aria-label="Diagrama de la validación">
      <div className="pulso-ruleflow__track">
        {flow.nodes.map((node, i) => (
          <div key={`${node.kind}-${i}`} style={{ display: "contents" }}>
            {i > 0 && (
              <div className="pulso-ruleflow__conn pulso-ruleflow__conn--vpad" aria-hidden="true">
                <ArrowRight size={16} />
              </div>
            )}
            <FlowNodeCard node={node} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowNodeCard({ node }: { node: FlowNode }) {
  const theme = nodeTheme(node);
  const { Icon } = theme;
  return (
    <div
      className="pulso-ruleflow__node"
      style={{
        background: theme.bg,
        borderColor: theme.border,
        // Accent superior con inset boxShadow (evita mezclar el shorthand
        // `border` con `borderColor`, que dispara warnings de React en rerender).
        boxShadow: `inset 0 2px 0 ${theme.fg}`,
      }}
    >
      <div className="pulso-ruleflow__node-head" style={{ color: theme.fg }}>
        <Icon size={12} />
        {node.eyebrow}
      </div>
      <div className="pulso-ruleflow__node-title">{node.title}</div>
      {node.detail && <div className="pulso-ruleflow__node-detail">{node.detail}</div>}
      {node.chips.length > 0 && (
        <div className="pulso-ruleflow__chips">
          {node.chips.map((chip) => (
            <span
              key={chip.key}
              className="pulso-ruleflow__chip"
              title={chip.label ? `${chip.key} — ${chip.label}` : chip.key}
            >
              {chip.key}
              {chip.label && <small>{chip.label}</small>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
