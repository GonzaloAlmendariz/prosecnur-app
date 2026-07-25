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

import { ChevronDown, ChevronRight } from "../../../vendor/lucide-react";
import { IconConditionalLogic } from "../../../lib/icons";
import type { LaidOutNode } from "./autoLayout";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { stripMarkdown } from "../helpers/markdown";

export type GraphNodeCardProps = {
  laid: LaidOutNode;
  selected: boolean;
  highlighted: boolean;
  /** Si la sección está expandida (solo aplica si laid.node.kind === "section"). */
  expanded?: boolean;
  /** True cuando este node tiene `relevant` no vacío. */
  isConditional: boolean;
  /** Nº de relaciones lógicas que tocan este nodo (entradas + salidas).
   *  Solo se muestra en secciones COLAPSADAS, para anticipar cuánta
   *  lógica esconde el grupo sin tener que expandirlo. */
  relationCount?: number;
  /** Estados auxiliares para el modo edición (drag de edge). */
  markedAsTarget?: boolean;
  draggingFrom?: boolean;
  /** Durante un arrastre de conexión, este nodo NO es destino válido
   *  (crearía ciclo o es el propio origen) → se atenúa. */
  invalidTarget?: boolean;
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
  relationCount = 0,
  markedAsTarget,
  draggingFrom,
  invalidTarget,
  onToggleExpand,
  onClick,
  onAnchorMouseDown,
  onCardMouseDown,
  beingDragged,
}: GraphNodeCardProps) {
  const { node, x, y, width, height } = laid;
  // El title puede traer markdown crudo del XLSForm (`**Especifique:**`).
  // En el lienzo mostramos texto plano (mismo criterio que el resto del
  // editor vía `stripMarkdown`); el markdown se renderiza en las vistas
  // de campo, no en el mapa de lógica.
  const cleanTitle =
    stripMarkdown(node.title || "").replace(/\s+/g, " ").trim() ||
    node.subtitle;
  const isSection = node.kind === "section";
  // Un grupo repetible (begin_repeat) es de primera clase: conserva su
  // `baseType`, así que lo distinguimos de un grupo normal para pintarlo con la
  // identidad naranja (`--pulso-repeat-*`) y el ícono Repeat.
  const isRepeatSection = isSection && node.baseType === "begin_repeat";
  const sectionType = isRepeatSection ? "begin_repeat" : "begin_group";
  const isSelect =
    node.baseType === "select_one" || node.baseType === "select_multiple";

  const accent = isSection
    ? paletteForType(sectionType)
    : paletteForType(node.baseType);
  const accentSoft = isSection
    ? paletteSoftForType(sectionType)
    : paletteSoftForType(node.baseType);
  const Icon = isSection ? iconForType(sectionType) : iconForType(node.baseType);

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
            ? isRepeatSection
              ? "color-mix(in srgb, var(--pulso-repeat-accent) 6%, transparent)"
              : "rgba(15, 118, 110, 0.04)"
            : baseFill;
  // Borde SIEMPRE del color del tipo de pregunta (paletteForType) — en
  // reposo con opacidad reducida para que el lienzo no grite; estados
  // activos (selección, drag, target) suben a opacidad plena.
  const stroke = markedAsTarget
    ? "#16a34a"
    : draggingFrom
      ? "var(--pulso-primary)"
      : selected
        ? accent
        : highlighted
          ? "var(--pulso-primary)"
          : accent;
  const strokeWidth = markedAsTarget || draggingFrom
    ? 2.2
    : selected
      ? 2
      : highlighted || isSection
        ? 1.6
        : 1.2;
  const strokeOpacity =
    markedAsTarget || draggingFrom || selected || highlighted
      ? 1
      : isSection
        ? 0.9
        : 0.6;

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
      } ${invalidTarget ? "is-invalid-target" : ""} pulso-graph-node-${node.kind}`}
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
      {/* Contenido en un <g> interno: la elevación al hover y la entrada
          fade-in-up animan ESTE g (CSS transform), nunca el g raíz — su
          translate(x, y) del layout no se pisa. */}
      <g className="pulso-graph-node-inner">

      {/* Caja contenedora: si es sección expandida ocupa height total;
          si es colapsada o pregunta, ocupa COLLAPSED_HEIGHT. */}
      <rect
        width={width}
        height={height}
        rx={13}
        ry={13}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
      />

      {/* Ring primario del nodo seleccionado — halo fino por fuera de
          la card, solo presentación. */}
      {selected && (
        <rect
          className="pulso-graph-node-ring"
          x={-3.5}
          y={-3.5}
          width={width + 7}
          height={height + 7}
          rx={16}
          ry={16}
          fill="none"
          stroke="var(--pulso-primary)"
          strokeOpacity={0.35}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

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
            clipPath: `inset(0 0 0 0 round 13px 0 0 13px)`,
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
              title={cleanTitle}
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
              {cleanTitle}
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
            {isRepeatSection && (
              <span
                title="Grupo repetible: sus preguntas se repiten por cada registro."
                style={{
                  alignSelf: "flex-start",
                  marginTop: 1,
                  padding: "1px 7px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  color: "var(--pulso-repeat-fg)",
                  background: "var(--pulso-repeat-bg)",
                  border: "1px solid var(--pulso-repeat-border)",
                }}
              >
                Repetible
              </span>
            )}
            {/* El conteo de opciones / lista es info de DATOS, no de lógica:
                no vive en el Mapa de lógica (feedback directo). La identidad
                del nodo se lee por título + name técnico. */}
            {isSection && !expanded && relationCount > 0 && (
              <span
                title={`${relationCount} relación${relationCount === 1 ? "" : "es"} lógica${relationCount === 1 ? "" : "s"} entra(n)/sale(n) de esta sección`}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                  color: "var(--pulso-primary)",
                  background: "var(--pulso-primary-bg, rgba(36, 87, 214, 0.10))",
                  border: "1px solid var(--pulso-primary-border)",
                }}
              >
                <IconConditionalLogic size={10} />
                {relationCount} relaci{relationCount === 1 ? "ón" : "ones"}
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
              <IconConditionalLogic size={12} />
            </span>
          )}
          {/* Indicador de visibilidad HEREDADA de sección padre. Se
              dibuja con tono soft/dashed para distinguirlo del relevant
              directo: la pregunta no tiene relevant propio, pero su sección padre sí. Tooltip explica de
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
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              <IconConditionalLogic size={11} />
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
    </g>
  );
}
