// =============================================================================
// canvas-graph/GraphNodeCard.tsx — caja del nodo (sección o pregunta)
// =============================================================================
// Render SVG de un node usando `<foreignObject>` para layout HTML interno
// (más fácil de estilizar que SVG puro). Tres modos visuales:
//
//   1. Pregunta normal: header con icono + label + name técnico.
//      Si es select_one/multiple, chip "Catálogo: <listName> · N opciones"
//      al pie con muestra de hasta 5 opciones en grayscale (apenas
//      legibles, son contexto).
//
//   2. Sección colapsada: como una pregunta pero con chevron > a la
//      izquierda y subtítulo "<name> · N preguntas dentro". Click expande.
//
//   3. Sección expandida: header con chevron v + body que ocupa la altura
//      total (calculada por autoLayout). Los hijos se renderizan por
//      separado con sus propias <GraphNodeCard> — esta solo dibuja el
//      borde contenedor.
// =============================================================================

import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import type { LaidOutNode } from "./autoLayout";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { ConditionalIcon } from "../helpers/icons";

export type GraphNodeCardProps = {
  laid: LaidOutNode;
  selected: boolean;
  highlighted: boolean;
  /** Si la sección está expandida (solo aplica si laid.node.kind === "section"). */
  expanded?: boolean;
  /** True cuando este node tiene `relevant` no vacío — se muestra
   *  ConditionalIcon en el header. */
  isConditional: boolean;
  /** Estados auxiliares para el modo edición (drag de edge). */
  markedAsTarget?: boolean;
  draggingFrom?: boolean;
  /** Toggle expand/collapse para secciones. */
  onToggleExpand?: () => void;
  /** Click en el body (no chevron) selecciona / abre detalle. */
  onClick: () => void;
  /** Inicio de drag de edge desde el anchor del lado derecho. */
  onAnchorMouseDown?: (event: React.MouseEvent) => void;
  /** Inicio de drag de la card entera para reposicionarla. La toolbar
   *  pasa este handler cuando el modo "mover" está habilitado (siempre
   *  por ahora). El componente lo dispara desde el body — no desde el
   *  chevron ni desde el anchor para no chocar con esos affordances. */
  onCardMouseDown?: (event: React.MouseEvent) => void;
  /** Si esta card se está arrastrando ahora — solo afecta visualmente
   *  (cursor grabbing, sombra elevada). */
  beingDragged?: boolean;
};

const COLLAPSED_HEIGHT = 88;

export function GraphNodeCard({
  laid,
  selected,
  highlighted,
  expanded,
  isConditional,
  markedAsTarget,
  draggingFrom,
  onToggleExpand,
  onClick,
  onAnchorMouseDown,
  onCardMouseDown,
  beingDragged,
}: GraphNodeCardProps) {
  const { node, x, y, width, height } = laid;
  const isSection = node.kind === "section";
  const isSelect =
    node.baseType === "select_one" || node.baseType === "select_multiple";

  const accent = isSection
    ? paletteForType("begin_group")
    : paletteForType(node.baseType);
  const accentSoft = isSection
    ? paletteSoftForType("begin_group")
    : paletteSoftForType(node.baseType);
  const Icon = isSection
    ? expanded
      ? iconForType("begin_group")
      : iconForType("begin_group")
    : iconForType(node.baseType);

  // Fondo por estado, con fallback al color de sección heredado (igual
  // hash determinístico que `PreguntasPanel.tsx`) — así un nodo dentro
  // de una sección expandida tiene un tinte sutil que lo agrupa con sus
  // hermanos. Top-level questions y secciones colapsadas mantienen el
  // fondo blanco/expandido por defecto.
  const baseFill = node.sectionColor && !isSection ? node.sectionColor : "white";
  const fill = markedAsTarget
    ? "rgba(34, 197, 94, 0.08)"
    : draggingFrom
      ? "rgba(36, 87, 214, 0.06)"
      : selected
        ? accentSoft
        : highlighted
          ? "rgba(36, 87, 214, 0.04)"
          : isSection && expanded
            ? "rgba(15, 118, 110, 0.04)"
            : baseFill;
  const stroke = markedAsTarget
    ? "#16a34a"
    : draggingFrom
      ? "var(--pulso-primary)"
      : selected
        ? accent
        : highlighted
          ? "var(--pulso-primary)"
          : isSection
            ? accent
            : "var(--pulso-border)";
  const strokeWidth = markedAsTarget || draggingFrom
    ? 2.2
    : selected
      ? 2
      : highlighted || isSection
        ? 1.6
        : 1;

  const headerHeight = COLLAPSED_HEIGHT;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-graph-node-id={node.id}
      className={`pulso-graph-node ${selected ? "is-selected" : ""} ${
        highlighted ? "is-highlighted" : ""
      } ${markedAsTarget ? "is-target" : ""} ${
        draggingFrom ? "is-source" : ""
      } ${expanded ? "is-expanded" : ""} ${
        beingDragged ? "is-dragging" : ""
      } pulso-graph-node-${node.kind}`}
      style={{
        // Cursor refleja capacidad: si la card es movible (top-level
        // con onCardMouseDown), grab/grabbing; si no, pointer normal.
        cursor: !onCardMouseDown
          ? "pointer"
          : beingDragged
            ? "grabbing"
            : "grab",
      }}
      onMouseDown={(event) => {
        // El drag de card SOLO se dispara desde el rect/foreignObject
        // del body — el chevron y el anchor de edge tienen
        // stopPropagation para quedarse con su propio drag/click.
        if ((event.target as Element).closest(".pulso-graph-node-anchor")) return;
        if ((event.target as HTMLElement).tagName === "BUTTON") return; // chevron
        onCardMouseDown?.(event);
      }}
    >
      {/* Caja contenedora: si es sección expandida ocupa height total;
          si es colapsada o pregunta, ocupa COLLAPSED_HEIGHT. */}
      <rect
        width={width}
        height={height}
        rx={10}
        ry={10}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isSection && !expanded ? undefined : undefined}
      />

      {/* Color band a la izquierda — solo en secciones expandidas.
          Banda fina de 4 px del color de la sección (paleta
          determinística) — ayuda al usuario a identificar
          visualmente qué sección está mirando. */}
      {isSection && expanded && (
        <rect
          x={0}
          y={0}
          width={4}
          height={height}
          fill={accent}
          opacity={0.85}
          style={{
            // Esquinas redondeadas solo en el borde izquierdo.
            clipPath: `inset(0 0 0 0 round 10px 0 0 10px)`,
          }}
        />
      )}

      {/* Header (siempre presente en h=COLLAPSED_HEIGHT). Click selecciona
          el nodo. Para secciones, separamos un área del chevron a la
          izquierda que dispara el toggle. */}
      <foreignObject
        x={0}
        y={0}
        width={width}
        height={headerHeight}
        style={{ pointerEvents: "auto" }}
      >
        <div
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            boxSizing: "border-box",
          }}
        >
          {isSection && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand?.();
              }}
              title={expanded ? "Colapsar sección" : "Expandir sección"}
              aria-label={expanded ? "Colapsar sección" : "Expandir sección"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                // Background tinted con el accent color para hacer
                // el botón visible sobre el fondo de la sección.
                // Antes era transparent → el chevron se perdía.
                background: accentSoft,
                border: `1px solid ${accent}`,
                color: accent,
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            >
              {expanded ? (
                <ChevronDown size={18} strokeWidth={2.4} />
              ) : (
                <ChevronRight size={18} strokeWidth={2.4} />
              )}
            </button>
          )}
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              background: accentSoft,
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </span>
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              flex: 1,
              minWidth: 0,
            }}
          >
            <strong
              title={node.title || node.subtitle}
              style={{
                fontSize: isSection ? 13 : 12.3,
                color: "var(--pulso-text)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: isSection ? 2 : 3,
                lineHeight: 1.18,
                fontWeight: 700,
              }}
            >
              {node.title || node.subtitle}
            </strong>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--pulso-text-soft)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {node.subtitle}
            </span>
            {!isSection && isSelect && node.catalogContext && (
              <span
                title={`${node.catalogContext.listName} · ${node.catalogContext.itemCount} ${
                  node.catalogContext.itemCount === 1 ? "opción" : "opciones"
                }`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  minWidth: 0,
                  fontSize: 10.5,
                  color: "var(--pulso-text-soft)",
                  lineHeight: 1.15,
                }}
              >
                <ListChecks size={11} style={{ color: "#0f766e", flexShrink: 0 }} />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                >
                  {node.catalogContext.listName} · {node.catalogContext.itemCount}{" "}
                  {node.catalogContext.itemCount === 1 ? "opción" : "opciones"}
                </span>
              </span>
            )}
          </span>
          {isConditional && (
            <span
              title={
                isSection
                  ? "Sección con visibilidad condicional"
                  : "Pregunta condicional"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 5,
                color: isSection ? "white" : "var(--pulso-primary)",
                background: isSection
                  ? "var(--pulso-primary)"
                  : "var(--pulso-primary-bg, rgba(36, 87, 214, 0.10))",
                flexShrink: 0,
              }}
            >
              <ConditionalIcon
                size={12}
                weight={isSection ? "bold" : "thin"}
                color="currentColor"
              />
            </span>
          )}
          {/* Indicador de visibilidad HEREDADA de sección padre. Se
              dibuja con tono soft/diagonal para distinguirlo del
              ConditionalIcon "directo": la pregunta no tiene relevant
              propio, pero su sección padre sí. Tooltip explica de
              dónde viene. */}
          {!isConditional && node.inheritedRelevant.length > 0 && (
            <span
              title={`Hereda visibilidad de ${
                node.inheritedRelevant
                  .map((p) => p.fromSectionName)
                  .join(" → ")
              }`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 5,
                color: "var(--pulso-text-soft)",
                background: "var(--pulso-surface-2)",
                border: "1px dashed var(--pulso-border)",
                flexShrink: 0,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              ⤷
            </span>
          )}
        </div>
      </foreignObject>

      {/* Anchor de "salida" — círculo a la derecha que el usuario arrastra
          para crear una conexión nueva. Solo visible si onAnchorMouseDown
          está provisto (modo edición). Halo extra visible al hover de
          la card para hacerlo descubrible. */}
      {onAnchorMouseDown && (
        <g
          className="pulso-graph-node-anchor"
          onMouseDown={(event) => {
            event.stopPropagation();
            onAnchorMouseDown(event);
          }}
          style={{ cursor: "crosshair" }}
        >
          {/* Halo invisible por defecto; visible al hover de la card. */}
          <circle
            className="pulso-graph-node-anchor-halo"
            cx={width}
            cy={headerHeight / 2}
            r={11}
            fill={accent}
            fillOpacity={0}
          />
          <circle
            cx={width}
            cy={headerHeight / 2}
            r={6}
            fill="white"
            stroke={accent}
            strokeWidth={1.6}
          />
          <circle cx={width} cy={headerHeight / 2} r={3} fill={accent} />
        </g>
      )}
    </g>
  );
}
