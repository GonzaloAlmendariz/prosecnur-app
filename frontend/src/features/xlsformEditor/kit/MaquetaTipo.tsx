import type { ReactNode } from "react";
import { typeFamily, typeTone, type TypeFamily } from "./typeTone";
import "./kit.css";

// Maqueta del tipo de pregunta (F3, 2026-10-16): un dibujo pequeño de cómo se ve la pregunta en el formulario, como
// los glifos de Gráficos. Pedido de Gonzalo: los íconos de tipo «en todas partes y de forma inteligente con maqueta
// elegante». El color de la familia va sólo en el acento (la marca elegida, el valor); lo demás en tinta neutra.

const LINEA = "var(--pulso-border-strong)";
const TENUE = "var(--pulso-border)";

function dibujo(familia: TypeFamily, tono: string): ReactNode {
  switch (familia) {
    case "unica":
      return [6, 16, 26].map((y, i) => (
        <g key={y}>
          <circle cx={7} cy={y} r={3.2} fill={i === 1 ? tono : "none"} stroke={i === 1 ? tono : LINEA} strokeWidth={1.4} />
          <rect x={14} y={y - 1.5} width={i === 2 ? 18 : 26} height={3} rx={1.5} fill={TENUE} />
        </g>
      ));
    case "multiple":
      return [6, 16, 26].map((y, i) => (
        <g key={y}>
          <rect x={4} y={y - 3.2} width={6.4} height={6.4} rx={1.4} fill={i < 2 ? tono : "none"} stroke={i < 2 ? tono : LINEA} strokeWidth={1.4} />
          {i < 2 ? <path d={`M5.6 ${y} l1.4 1.5 l2.4 -2.8`} stroke="var(--pulso-surface)" strokeWidth={1.3} fill="none" /> : null}
          <rect x={14} y={y - 1.5} width={i === 1 ? 20 : 26} height={3} rx={1.5} fill={TENUE} />
        </g>
      ));
    case "numero":
      return (
        <g>
          <rect x={3} y={9} width={42} height={14} rx={3} fill="none" stroke={LINEA} strokeWidth={1.4} />
          <text x={9} y={19.5} fontSize={9} fontWeight={700} fill={tono} fontFamily="ui-sans-serif, system-ui">123</text>
        </g>
      );
    case "texto":
      return (
        <g>
          <rect x={3} y={9} width={42} height={14} rx={3} fill="none" stroke={LINEA} strokeWidth={1.4} />
          <rect x={8} y={14.5} width={20} height={3} rx={1.5} fill={TENUE} />
          <rect x={30} y={12} width={1.6} height={8} fill={tono} />
        </g>
      );
    case "fecha":
      return (
        <g>
          <rect x={12} y={4} width={24} height={24} rx={3} fill="none" stroke={LINEA} strokeWidth={1.4} />
          <rect x={12} y={4} width={24} height={6} rx={2} fill={tono} />
          {[0, 1, 2].flatMap((f) => [0, 1, 2].map((c) => (
            <rect key={`${f}-${c}`} x={15.5 + c * 6.5} y={13 + f * 5} width={4} height={3} rx={0.8} fill={f === 1 && c === 1 ? tono : TENUE} />
          )))}
        </g>
      );
    case "nota":
      return [8, 14, 20, 26].map((y, i) => <rect key={y} x={4} y={y - 1.5} width={i === 3 ? 22 : 40} height={3} rx={1.5} fill={i === 0 ? tono : TENUE} />);
    case "calculo":
      return (
        <g>
          <rect x={3} y={6} width={42} height={20} rx={3} fill="none" stroke={LINEA} strokeWidth={1.4} />
          <text x={10} y={20.5} fontSize={11} fontStyle="italic" fontWeight={700} fill={tono} fontFamily="Georgia, serif">ƒx</text>
          <rect x={26} y={14.5} width={14} height={3} rx={1.5} fill={TENUE} />
        </g>
      );
    case "ubicacion":
      return (
        <g>
          <path d="M6 24 L18 18 L30 24 L42 18" stroke={TENUE} strokeWidth={2} fill="none" />
          <path d="M24 4 a6 6 0 0 1 6 6 c0 5 -6 11 -6 11 s-6 -6 -6 -11 a6 6 0 0 1 6 -6z" fill={tono} />
          <circle cx={24} cy={10} r={2.2} fill="var(--pulso-surface)" />
        </g>
      );
    case "estructura":
      return (
        <g>
          <path d="M4 7 h12 l3 3 h25 v18 h-40z" fill="none" stroke={LINEA} strokeWidth={1.4} />
          <rect x={9} y={15} width={28} height={3} rx={1.5} fill={TENUE} />
          <rect x={9} y={21} width={20} height={3} rx={1.5} fill={TENUE} />
        </g>
      );
    default:
      return <rect x={3} y={8} width={42} height={16} rx={3} fill="none" stroke={LINEA} strokeWidth={1.4} />;
  }
}

export function MaquetaTipo({ baseType, ancho = 48 }: { baseType: string; ancho?: number }) {
  return (
    <svg className="xfk-maqueta" width={ancho} height={(ancho * 32) / 48} viewBox="0 0 48 32" aria-hidden="true" focusable="false">
      {dibujo(typeFamily(baseType), typeTone(baseType))}
    </svg>
  );
}
