import * as Lucide from "lucide-react";
import { Image as ImageIcon, Palette, AlertCircle, AlertTriangle } from "lucide-react";
import { IconModes } from "../../../../lib/icons";
import { PlanGraphNode } from "./buildPlanGraph";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { SLIDE_LABELS } from "../../store";
import SlidePreviewMockup from "../../SlidePreviewMockup";
import { ValidationIssue } from "../../usePlanValidator";

export type PlanNodeCardProps = {
  node: PlanGraphNode;
  selected: boolean;
  dimmed: boolean;
  issues: ValidationIssue[];
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
};

// Card de nodo del lienzo. Render dentro de <foreignObject>. Muestra
// índice del slide, label humano, mini-mockup, badges (override/icon/
// palette/diag).

type LucideIcon = (props: { size?: number }) => JSX.Element;
function resolveIcon(name: string | undefined): LucideIcon {
  const reg = Lucide as unknown as Record<string, LucideIcon>;
  return (name && reg[name]) || reg["FileText"] || reg["Square"];
}

export function PlanNodeCard({ node, selected, dimmed, issues, onClick, onMouseDown }: PlanNodeCardProps) {
  const { slidesById } = useGraficosRegistry();
  const meta = slidesById[node.slide.tipo];
  const Icon = resolveIcon(meta?.icono_ui);
  const titulo = typeof node.slide.payload.titulo === "string" ? node.slide.payload.titulo : "";
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warning").length;

  return (
    <div
      data-cat={node.category}
      className={`pulso-gv2-node-card ${selected ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""}`}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onMouseDown={onMouseDown}
    >
      <div className="pulso-gv2-node-head">
        <Icon size={12} />
        <span>#{node.index + 1}</span>
        <span style={{ flex: 1 }} />
        {(errors > 0 || warns > 0) && (
          <span
            title={`${errors > 0 ? `${errors} error(es)` : ""}${errors > 0 && warns > 0 ? " · " : ""}${warns > 0 ? `${warns} aviso(s)` : ""}`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 14, height: 14, borderRadius: 999,
              background: errors > 0 ? "var(--pulso-danger-fg)" : "#d97706",
              color: "white",
            }}
          >
            {errors > 0 ? <AlertCircle size={9} strokeWidth={3} /> : <AlertTriangle size={9} strokeWidth={3} />}
          </span>
        )}
      </div>

      <div className="pulso-gv2-node-title" title={titulo || (SLIDE_LABELS[node.slide.tipo] ?? node.slide.tipo)}>
        {titulo || (SLIDE_LABELS[node.slide.tipo] ?? node.slide.tipo)}
      </div>

      <div className="pulso-gv2-node-thumb">
        <div style={{ position: "absolute", inset: 0 }}>
          <SlidePreviewMockup slide={node.slide} />
        </div>
      </div>

      {(node.hasOverride || node.hasIcon || node.hasPalette) && (
        <div className="pulso-gv2-node-badges">
          {node.hasOverride && (
            <span className="pulso-gv2-node-badge is-override" title="Aplica un modo de estilo">
              <IconModes size={9} /> Modo
            </span>
          )}
          {node.hasIcon && (
            <span className="pulso-gv2-node-badge is-icon" title="Usa ícono del catálogo">
              <ImageIcon size={9} /> Ícono
            </span>
          )}
          {node.hasPalette && (
            <span className="pulso-gv2-node-badge is-palette" title="Usa paleta personalizada">
              <Palette size={9} /> Paleta
            </span>
          )}
        </div>
      )}
    </div>
  );
}
