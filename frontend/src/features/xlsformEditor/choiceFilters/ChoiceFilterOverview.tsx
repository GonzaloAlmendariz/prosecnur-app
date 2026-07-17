// =============================================================================
// choiceFilters/ChoiceFilterOverview.tsx — diagrama de resumen de relaciones
// =============================================================================
// Un pequeño gráfico al inicio de la vista «Filtros de opciones» que muestra,
// de un vistazo, la RELACIÓN: cada pregunta condicionada (a la derecha) recibe
// las respuestas previas que la habilitan (a la izquierda), convergiendo con
// hairlines finas — el motivo «la señal ordenada» de la identidad Pulso.
//
// Es un resumen, no el detalle: la correspondencia 1:1 opción↔antecedente vive
// en las fichas de abajo. Aquí se ve la forma de la dependencia (cuántas y qué
// respuestas previas alimentan cada pregunta). Cada antecedente es hover-able
// (title) para inspeccionar cuál es sin saturar el gráfico de texto.
// =============================================================================

import type { ChoiceFilterCard } from "./buildChoiceFilterModel";

// Coordenadas internas (el SVG escala al ancho del contenedor vía viewBox).
const VW = 680;
const NODE_W = 232;
const NODE_H = 46;
const NODE_X = VW - NODE_W - 2;
const DOT_X = 16;

/** Trunca a una sola línea para caber en la pastilla del nodo, cortando en
 *  borde de palabra cuando es posible (evita cortes a mitad de palabra). */
function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice.trimEnd();
  return `${cut}…`;
}

function OverviewRow({
  card,
  onJumpToRow,
}: {
  card: ChoiceFilterCard;
  onJumpToRow?: (rowIndex: number) => void;
}) {
  const n = card.antecedents.length;
  // Banda vertical de los antecedentes: 18px por punto, con techo para que el
  // resumen se mantenga pequeño aunque haya muchos (P50 tiene 16).
  const band = Math.min(n * 18, 150);
  const height = Math.max(NODE_H + 20, band + 16);
  const top = (height - band) / 2;
  const step = n > 1 ? band / (n - 1) : 0;
  const nodeCY = height / 2;
  const nodeCX = NODE_X;

  const antYs = card.antecedents.map((_, i) => (n > 1 ? top + i * step : height / 2));

  return (
    <div className="pulso-xcf-ov-row">
      <svg
        className="pulso-xcf-ov-svg"
        viewBox={`0 0 ${VW} ${height}`}
        role="img"
        aria-label={`${card.questionCode} recibe ${n} ${n === 1 ? "respuesta previa" : "respuestas previas"}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Curvas convergentes: de cada antecedente al borde izquierdo del nodo. */}
        {antYs.map((y, i) => {
          const x1 = DOT_X + 4;
          const x2 = nodeCX;
          const cx1 = VW * 0.42;
          const cx2 = nodeCX - 70;
          return (
            <path
              key={`c-${card.antecedents[i]!.varName}-${i}`}
              className="pulso-xcf-ov-link"
              d={`M ${x1} ${y} C ${cx1} ${y}, ${cx2} ${nodeCY}, ${x2} ${nodeCY}`}
              fill="none"
            />
          );
        })}

        {/* Puntos de antecedente (hover-able). */}
        {antYs.map((y, i) => {
          const ant = card.antecedents[i]!;
          const jumpable = onJumpToRow && ant.rowIndex != null;
          return (
            <circle
              key={`d-${ant.varName}-${i}`}
              className={`pulso-xcf-ov-dot ${jumpable ? "is-jumpable" : ""}`}
              cx={DOT_X}
              cy={y}
              r={3.5}
              onClick={jumpable ? () => onJumpToRow!(ant.rowIndex!) : undefined}
              style={jumpable ? { cursor: "pointer" } : undefined}
            >
              <title>{`${ant.varName} · ${ant.label}`}</title>
            </circle>
          );
        })}

        {/* Nodo de la pregunta condicionada. */}
        <g
          className={onJumpToRow ? "pulso-xcf-ov-node is-jumpable" : "pulso-xcf-ov-node"}
          onClick={onJumpToRow ? () => onJumpToRow(card.rowIndex) : undefined}
          style={onJumpToRow ? { cursor: "pointer" } : undefined}
        >
          <rect
            className="pulso-xcf-ov-node-box"
            x={nodeCX}
            y={nodeCY - NODE_H / 2}
            width={NODE_W}
            height={NODE_H}
            rx={12}
          />
          <text
            className="pulso-xcf-ov-node-code"
            x={nodeCX + 14}
            y={nodeCY - NODE_H / 2 + 16}
          >
            {card.questionCode}
          </text>
          <text
            className="pulso-xcf-ov-node-label"
            x={nodeCX + 14}
            y={nodeCY - NODE_H / 2 + 33}
          >
            {truncate(card.questionLabel, 30)}
          </text>
        </g>
      </svg>
    </div>
  );
}

export function ChoiceFilterOverview({
  cards,
  onJumpToRow,
}: {
  cards: ChoiceFilterCard[];
  onJumpToRow?: (rowIndex: number) => void;
}) {
  const withAntecedents = cards.filter((card) => card.antecedents.length > 0);
  if (withAntecedents.length === 0) return null;

  return (
    <section className="pulso-xcf-ov" aria-label="Resumen de relaciones">
      <span className="pulso-xcf-ov-eyebrow">Cómo se relacionan</span>
      <div className="pulso-xcf-ov-rows">
        {withAntecedents.map((card) => (
          <OverviewRow key={card.rowIndex} card={card} onJumpToRow={onJumpToRow} />
        ))}
      </div>
    </section>
  );
}
