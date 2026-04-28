import { BloqueConfig, IndiceConfig } from "../../store";

// Diagrama SVG compacto: instrumento → listas evaluativas → bloques → índices.
// Las líneas se "dibujan" con stroke-dasharray animado (clase .pulso-tree-draw).
// Los nodos son rectángulos con label humano. Es read-only en step 5;
// la edición sigue siendo via wizard navigation.

type Props = {
  listas: string[];
  bloques: BloqueConfig[];
  indices: IndiceConfig[];
};

const COL_LISTAS_X = 16;
const COL_BLOQUES_X = 240;
const COL_INDICES_X = 460;

const NODE_W = 200;
const NODE_H = 32;
const Y_GAP = 12;

export function DiagramaArbol({ listas, bloques, indices }: Props) {
  const listasArr = listas.length > 0 ? listas.slice(0, 8) : ["—"];
  const bloquesArr = bloques.length > 0 ? bloques : [];
  const indicesArr = indices.length > 0 ? indices : [];

  const colHeight = (n: number) => Math.max(1, n) * (NODE_H + Y_GAP) - Y_GAP;
  const totalH = Math.max(
    colHeight(listasArr.length),
    colHeight(bloquesArr.length),
    colHeight(indicesArr.length),
  ) + 32;

  const nodeY = (col: { length: number }, i: number) => {
    const totalCol = colHeight(col.length);
    const yStart = (totalH - totalCol) / 2;
    return yStart + i * (NODE_H + Y_GAP);
  };

  // Coordenadas del centro derecho/izquierdo de cada nodo, para
  // dibujar líneas curvas tipo Bezier.
  const listaY = (i: number) => nodeY(listasArr, i) + NODE_H / 2;
  const bloqueY = (i: number) => nodeY(bloquesArr, i) + NODE_H / 2;
  const indiceY = (i: number) => nodeY(indicesArr, i) + NODE_H / 2;

  return (
    <svg
      role="img"
      aria-label="Estructura jerárquica de dimensiones"
      width="100%"
      viewBox={`0 0 ${COL_INDICES_X + NODE_W + 16} ${totalH}`}
      style={{ display: "block", maxWidth: 720 }}
    >
      {/* Líneas listas → bloques (usa orden, no semántica real). Si listas
          es 0, simplemente conecta cada bloque desde col1 a col2. */}
      {bloquesArr.map((_, bi) => {
        const liY = listaY(Math.min(bi, listasArr.length - 1));
        const blY = bloqueY(bi);
        const x1 = COL_LISTAS_X + NODE_W;
        const x2 = COL_BLOQUES_X;
        const cx1 = x1 + 30;
        const cx2 = x2 - 30;
        return (
          <path
            key={`l-b-${bi}`}
            d={`M ${x1} ${liY} C ${cx1} ${liY}, ${cx2} ${blY}, ${x2} ${blY}`}
            stroke="var(--pulso-border)"
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="240"
            strokeDashoffset="240"
            className="pulso-tree-draw"
            style={{ animationDelay: `${bi * 60 + 100}ms` }}
          />
        );
      })}

      {/* Líneas bloques → índices */}
      {indicesArr.flatMap((idx, ii) =>
        idx.subindices.map((subNombre) => {
          const bi = bloquesArr.findIndex((b) => b.nombre === subNombre);
          if (bi < 0) return null;
          const blY = bloqueY(bi);
          const inY = indiceY(ii);
          const x1 = COL_BLOQUES_X + NODE_W;
          const x2 = COL_INDICES_X;
          const cx1 = x1 + 30;
          const cx2 = x2 - 30;
          return (
            <path
              key={`b-i-${ii}-${subNombre}`}
              d={`M ${x1} ${blY} C ${cx1} ${blY}, ${cx2} ${inY}, ${x2} ${inY}`}
              stroke="var(--pulso-primary)"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="240"
              strokeDashoffset="240"
              className="pulso-tree-draw"
              style={{ animationDelay: `${ii * 80 + 400}ms` }}
            />
          );
        }),
      )}

      {/* Columna 1: listas evaluativas */}
      {listasArr.map((l, i) => (
        <Nodo
          key={`l-${i}`}
          x={COL_LISTAS_X}
          y={nodeY(listasArr, i)}
          label={l}
          tono="neutral"
          delay={i * 40}
        />
      ))}

      {/* Columna 2: bloques */}
      {bloquesArr.map((b, i) => (
        <Nodo
          key={`b-${i}`}
          x={COL_BLOQUES_X}
          y={nodeY(bloquesArr, i)}
          label={b.etiqueta}
          subtitle={`${b.vars.length} vars`}
          tono="primary"
          delay={i * 50 + 200}
        />
      ))}

      {/* Columna 3: índices */}
      {indicesArr.map((idx, i) => (
        <Nodo
          key={`i-${i}`}
          x={COL_INDICES_X}
          y={nodeY(indicesArr, i)}
          label={idx.etiqueta}
          subtitle={`${idx.subindices.length} bloques`}
          tono="success"
          delay={i * 50 + 500}
        />
      ))}
    </svg>
  );
}

function Nodo({
  x,
  y,
  label,
  subtitle,
  tono,
  delay,
}: {
  x: number;
  y: number;
  label: string;
  subtitle?: string;
  tono: "neutral" | "primary" | "success";
  delay: number;
}) {
  const fill =
    tono === "primary"
      ? "var(--pulso-primary-soft)"
      : tono === "success"
        ? "var(--pulso-success-bg, #f0fdf4)"
        : "var(--pulso-surface)";
  const stroke =
    tono === "primary"
      ? "var(--pulso-primary)"
      : tono === "success"
        ? "var(--pulso-success-fg, #15803d)"
        : "var(--pulso-border)";
  const textColor = tono === "primary" ? "var(--pulso-primary)" : "var(--pulso-text)";
  return (
    <g
      style={{
        animation: `pulso-lens-slide-in-kf var(--anim-dur-med) var(--anim-ease-expressive) both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x + 10}
        y={y + (subtitle ? 14 : 20)}
        fontSize={12}
        fontWeight={700}
        fill={textColor}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {truncate(label, 24)}
      </text>
      {subtitle && (
        <text
          x={x + 10}
          y={y + 26}
          fontSize={10}
          fill="var(--pulso-text-soft)"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
