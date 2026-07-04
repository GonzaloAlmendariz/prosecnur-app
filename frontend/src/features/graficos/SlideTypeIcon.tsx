import type { SlideType } from "../../api/client";
import { resolveGraphLucideIcon } from "./lucideRegistry";

type IconProps = {
  tipo?: SlideType | string;
  iconoUi?: string;
  size?: number;
  className?: string;
};

export type SlideLayoutIconVariant =
  | "objetivo-icono"
  | "texto"
  | "tabla"
  | "grafico"
  | "grafico-narrativa"
  | "grafico-texto-izquierda"
  | "grafico-texto-derecha"
  | "dos-graficos"
  | "dos-graficos-narrativa"
  | "dos-graficos-texto-izquierda"
  | "dos-graficos-texto-derecha"
  | "cuatro-graficos"
  | "poblacion-2"
  | "poblacion-4"
  | "poblacion-5"
  | "poblacion-6";

export function slideLayoutIconVariant(tipo?: SlideType | string): SlideLayoutIconVariant | null {
  switch (tipo) {
    case "p_slide_objetivo_icono":
      return "objetivo-icono";
    case "p_slide_texto":
      return "texto";
    case "p_slide_tabla_tecnica":
      return "tabla";
    case "p_slide_1_grafico":
      return "grafico";
    case "p_slide_1_grafico_narrativo":
      return "grafico-narrativa";
    case "p_slide_grafico_texto_izquierda":
      return "grafico-texto-izquierda";
    case "p_slide_grafico_texto_derecha":
      return "grafico-texto-derecha";
    case "p_slide_2_graficos":
      return "dos-graficos";
    case "p_slide_2_graficos_narrativo":
      return "dos-graficos-narrativa";
    case "p_slide_2_graficos_texto_izquierda":
      return "dos-graficos-texto-izquierda";
    case "p_slide_2_graficos_texto_derecha":
      return "dos-graficos-texto-derecha";
    case "p_slide_4_graficos":
      return "cuatro-graficos";
    case "p_slide_2_graficos_poblacion":
      return "poblacion-2";
    case "p_slide_4_graficos_poblacion":
      return "poblacion-4";
    case "p_slide_5_graficos_poblacion":
      return "poblacion-5";
    case "p_slide_6_graficos_poblacion":
      return "poblacion-6";
    default:
      return null;
  }
}

type BlockProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  muted?: boolean;
};

function BlockSurface({ x, y, width, height, muted = false }: BlockProps) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="2"
        fill="currentColor"
        stroke="none"
        opacity={muted ? 0.1 : 0.16}
      />
      <rect x={x} y={y} width={width} height={height} rx="2" />
    </>
  );
}

function TextBlock({ x, y, width, height, muted }: BlockProps) {
  const left = x + width * 0.24;
  const right = x + width * 0.78;
  return (
    <g>
      <BlockSurface x={x} y={y} width={width} height={height} muted={muted} />
      <path
        d={`M${left} ${y + height * 0.38}H${right}M${left} ${y + height * 0.62}H${right - width * 0.14}`}
        strokeWidth="1.28"
      />
    </g>
  );
}

function ChartBlock({ x, y, width, height, muted }: BlockProps) {
  const left = x + width * 0.24;
  const right = x + width * 0.77;
  const bottom = y + height * 0.72;
  return (
    <g>
      <BlockSurface x={x} y={y} width={width} height={height} muted={muted} />
      {width >= 7.5 && height >= 8 && (
        <path
          d={`M${left} ${bottom}l${width * 0.18} -${height * 0.22}l${width * 0.18} ${height * 0.12}l${width * 0.18} -${height * 0.28}`}
          strokeWidth="1.3"
        />
      )}
      {width < 7.5 && <path d={`M${left} ${bottom}H${right}`} strokeWidth="1.25" />}
    </g>
  );
}

function TableBlock({ x, y, width, height, muted }: BlockProps) {
  return (
    <g>
      <BlockSurface x={x} y={y} width={width} height={height} muted={muted} />
      <path
        d={`M${x} ${y + height * 0.42}h${width}M${x + width * 0.5} ${y}v${height}`}
        strokeWidth="1.18"
      />
    </g>
  );
}

function ChartTile({ x, y, size = 5.8 }: { x: number; y: number; size?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      rx="1.7"
      fill="currentColor"
      stroke="none"
      opacity="0.72"
    />
  );
}

function NarrativeBand() {
  return (
    <g>
      <rect x="4" y="4" width="16" height="4.8" rx="1.7" fill="currentColor" stroke="none" opacity="0.14" />
      <path d="M7 6.4h10" strokeWidth="1.35" />
    </g>
  );
}

function TwoCharts({ y = 5, height = 14 }: { y?: number; height?: number }) {
  return (
    <g>
      <ChartBlock x={4} y={y} width={6.6} height={height} />
      <ChartBlock x={13.4} y={y} width={6.6} height={height} />
    </g>
  );
}

function StackedCharts({ x }: { x: number }) {
  return (
    <g>
      <ChartBlock x={x} y={4.2} width={6.6} height={6.6} />
      <ChartBlock x={x} y={13.2} width={6.6} height={6.6} />
    </g>
  );
}

function FourChartGrid() {
  return (
    <g>
      <ChartTile x={4.2} y={4.2} />
      <ChartTile x={14} y={4.2} />
      <ChartTile x={4.2} y={14} />
      <ChartTile x={14} y={14} />
    </g>
  );
}

function PersonMark({ x = 7.2, y = 12.4 }: { x?: number; y?: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 2.3} r="2" fill="currentColor" stroke="none" opacity="0.16" />
      <circle cx={x} cy={y - 2.3} r="2" />
      <path d={`M${x - 3.7} ${y + 4.8}c.35-2.75 1.85-4.25 3.7-4.25s3.35 1.5 3.7 4.25`} />
    </g>
  );
}

function TargetMark() {
  return (
    <g>
      <circle cx="11.2" cy="12.8" r="6.9" />
      <circle cx="11.2" cy="12.8" r="4" />
      <circle cx="11.2" cy="12.8" r="1.25" fill="currentColor" stroke="none" />
      <path d="M14.4 9.6 20.6 3.4" strokeWidth="1.95" />
      <path d="M17.2 3.4h3.4v3.4" strokeWidth="1.95" />
    </g>
  );
}

function CountTile({ x, y, size = 3.5 }: { x: number; y: number; size?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      rx="1.1"
      fill="currentColor"
      stroke="none"
      opacity="0.74"
    />
  );
}

function PopulationCount({ count }: { count: 2 | 4 | 5 | 6 }) {
  const positions: Record<2 | 4 | 5 | 6, Array<[number, number]>> = {
    2: [[15.2, 7.4], [15.2, 14.8]],
    4: [[13.8, 6.2], [18, 6.2], [13.8, 14.4], [18, 14.4]],
    5: [[13.5, 5.5], [18.2, 5.5], [15.85, 10.2], [13.5, 14.9], [18.2, 14.9]],
    6: [[13.5, 5.4], [18.2, 5.4], [13.5, 10.2], [18.2, 10.2], [13.5, 15], [18.2, 15]],
  };

  return (
    <g>
      {positions[count].map(([x, y]) => (
        <CountTile key={`${x}-${y}`} x={x} y={y} />
      ))}
    </g>
  );
}

function PopulationIcon({ variant }: { variant: Extract<SlideLayoutIconVariant, "poblacion-2" | "poblacion-4" | "poblacion-5" | "poblacion-6"> }) {
  const count = Number(variant.replace("poblacion-", "")) as 2 | 4 | 5 | 6;
  return (
    <g>
      <PersonMark />
      <PopulationCount count={count} />
    </g>
  );
}

function SlideLayoutIcon({
  variant,
  size,
  className,
}: {
  variant: SlideLayoutIconVariant;
  size: number;
  className?: string;
}) {
  const textLeft = variant.endsWith("izquierda");
  const isPopulation = variant.startsWith("poblacion-");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {variant === "objetivo-icono" && (
        <TargetMark />
      )}
      {variant === "texto" && <TextBlock x={5} y={4} width={14} height={16} />}
      {variant === "tabla" && <TableBlock x={5} y={4} width={14} height={16} />}
      {variant === "grafico" && <ChartBlock x={5} y={4} width={14} height={16} />}
      {variant === "grafico-narrativa" && (
        <>
          <NarrativeBand />
          <ChartBlock x={5} y={11.5} width={14} height={8.5} />
        </>
      )}
      {(variant === "grafico-texto-izquierda" || variant === "grafico-texto-derecha") && (
        <>
          {textLeft ? <TextBlock x={3.2} y={4} width={7.2} height={16} /> : <ChartBlock x={3.2} y={4} width={7.2} height={16} />}
          {textLeft ? <ChartBlock x={13.6} y={4} width={7.2} height={16} /> : <TextBlock x={13.6} y={4} width={7.2} height={16} />}
        </>
      )}
      {variant === "dos-graficos" && <TwoCharts />}
      {variant === "dos-graficos-narrativa" && (
        <>
          <NarrativeBand />
          <TwoCharts y={11.7} height={8.3} />
        </>
      )}
      {(variant === "dos-graficos-texto-izquierda" || variant === "dos-graficos-texto-derecha") && (
        <>
          {textLeft ? <TextBlock x={3.2} y={4} width={7.2} height={16} /> : <StackedCharts x={3.2} />}
          {textLeft ? <StackedCharts x={13.6} /> : <TextBlock x={13.6} y={4} width={7.2} height={16} />}
        </>
      )}
      {variant === "cuatro-graficos" && <FourChartGrid />}
      {isPopulation && <PopulationIcon variant={variant as Extract<SlideLayoutIconVariant, "poblacion-2" | "poblacion-4" | "poblacion-5" | "poblacion-6">} />}
    </svg>
  );
}

export function SlideTypeIcon({ tipo, iconoUi, size = 16, className }: IconProps) {
  const variant = slideLayoutIconVariant(tipo);
  if (variant) {
    return <SlideLayoutIcon variant={variant} size={size} className={className} />;
  }

  const Icon = resolveGraphLucideIcon(iconoUi, "FileText");
  return <Icon size={size} className={className} aria-hidden={true} focusable="false" />;
}
