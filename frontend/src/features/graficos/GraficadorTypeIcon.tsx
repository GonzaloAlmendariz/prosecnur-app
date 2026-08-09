import { resolveGraphLucideIcon } from "./lucideRegistry";

type IconProps = {
  name?: string;
  iconoUi?: string;
  size?: number;
  className?: string;
};

export type GraficadorIconVariant =
  | "barras-agrupadas"
  | "barras-apiladas"
  | "multi-apiladas"
  | "pie"
  | "donut"
  | "numerico"
  | "boxplot"
  | "media-rango"
  | "radar"
  | "tabla"
  | "dim-radar"
  | "dim-radar-tabla"
  | "dim-heatmap"
  | "dim-radarbar"
  | "dim-foda"
  | "dim-heatmap-criterios";

export function graficadorIconVariant(name?: string): GraficadorIconVariant | null {
  switch (name) {
    case "p_barras":
    case "p_barras_agrupadas":
      return "barras-agrupadas";
    case "p_barras_apiladas":
      return "barras-apiladas";
    case "p_barras_multiapiladas":
      return "multi-apiladas";
    case "p_pie":
      return "pie";
    case "p_donut":
      return "donut";
    case "p_numerico":
      return "numerico";
    case "p_boxplot":
      return "boxplot";
    case "p_media_rango":
      return "media-rango";
    case "p_radar":
      return "radar";
    case "p_tabla":
      return "tabla";
    case "p_dim_radar":
      return "dim-radar";
    case "p_dim_radar_tabla":
      return "dim-radar-tabla";
    case "p_dim_heatmap":
      return "dim-heatmap";
    case "p_dim_comparativo_radarbar":
      return "dim-radarbar";
    case "p_dim_foda":
      return "dim-foda";
    case "p_dim_heatmap_criterios":
      return "dim-heatmap-criterios";
    default:
      return null;
  }
}

function Bar({ x, y, width, height, opacity = 0.18 }: { x: number; y: number; width: number; height: number; opacity?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx="1.5"
      fill="currentColor"
      stroke="none"
      opacity={opacity}
    />
  );
}

function BarsGrouped() {
  return (
    <g>
      <path d="M5 4.8v14.4h14" strokeWidth="1.45" />
      <Bar x={8} y={11.5} width={2.4} height={5.2} opacity={0.72} />
      <Bar x={12} y={7.5} width={2.4} height={9.2} opacity={0.72} />
      <Bar x={16} y={9.6} width={2.4} height={7.1} opacity={0.72} />
    </g>
  );
}

function StackedRow({
  y,
  splits,
  height = 4.2,
}: {
  y: number;
  splits: [number, number];
  height?: number;
}) {
  const x = 4.5;
  const width = 15;
  const splitA = x + splits[0];
  const splitB = x + splits[1];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2" fill="currentColor" stroke="none" opacity="0.16" />
      <rect x={x} y={y} width={width} height={height} rx="2" />
      <path d={`M${splitA} ${y + 0.55}v${height - 1.1}M${splitB} ${y + 0.55}v${height - 1.1}`} strokeWidth="1.25" />
    </g>
  );
}

function BarsStacked({ rows = 1 }: { rows?: 1 | 3 }) {
  const specs: Array<[number, [number, number], number]> = rows === 3
    ? [[4.6, [4.5, 9.3], 3.7], [10.1, [6.1, 10.2], 3.7], [15.6, [3.8, 10.4], 3.7]]
    : [[9.4, [5.1, 10.2], 4.9]];
  return (
    <g>
      {specs.map(([y, splits, height]) => <StackedRow key={y} y={y} splits={splits} height={height} />)}
    </g>
  );
}

function PieChartMini({ donut = false }: { donut?: boolean }) {
  return (
    <g>
      <circle cx="12" cy="12" r="7.2" fill="currentColor" stroke="none" opacity="0.12" />
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 12V4.8M12 12l6.4 3.3" />
      {donut && <circle cx="12" cy="12" r="3" />}
    </g>
  );
}

function NumericMini() {
  return (
    <g>
      <path d="M9 5.2v13.6M15 5.2v13.6M6 9.3h13M5 14.7h13" strokeWidth="1.85" />
    </g>
  );
}

function BoxplotMini() {
  return (
    <g>
      <path d="M12 4.6v3M12 16.4v3M8.5 7.6h7v8.8h-7zM8.5 12h7M9.8 4.6h4.4M9.8 19.4h4.4" />
    </g>
  );
}

function MediaRangoMini() {
  return (
    <g>
      <path d="M5.5 15.8h13M12 6.2v12.2M8 9.8h8" strokeWidth="1.55" />
      <circle cx="12" cy="12.1" r="2.75" fill="currentColor" stroke="none" opacity="0.18" />
      <circle cx="12" cy="12.1" r="2.75" />
      <circle cx="5.5" cy="15.8" r="1.18" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="15.8" r="1.18" fill="currentColor" stroke="none" />
    </g>
  );
}

function RadarMini({ small = false }: { small?: boolean }) {
  const outer = small
    ? "8.2 5.1 13.6 9.2 11.5 15.7 4.9 15.7 2.8 9.2"
    : "12 4.6 18.5 9.3 16 17.4 8 17.4 5.5 9.3";
  const inner = small
    ? "8.2 8 11 10 10.1 13.2 6.2 13.2 5.4 10"
    : "12 8 15.3 10.4 14 14.5 10 14.5 8.7 10.4";
  return (
    <g>
      <polygon points={outer} fill="currentColor" stroke="none" opacity="0.12" />
      <polygon points={outer} />
      <polygon points={inner} fill="currentColor" stroke="none" opacity="0.32" />
    </g>
  );
}

function TableMini({ x = 5, y = 5, width = 14, height = 14 }: { x?: number; y?: number; width?: number; height?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="2" fill="currentColor" stroke="none" opacity="0.12" />
      <rect x={x} y={y} width={width} height={height} rx="2" />
      <path d={`M${x} ${y + height * 0.42}h${width}M${x + width * 0.5} ${y}v${height}`} strokeWidth="1.18" />
    </g>
  );
}

function HeatmapMini({ grouped = false }: { grouped?: boolean }) {
  const cells = [
    [4.4, 4.4], [10, 4.4], [15.6, 4.4],
    [4.4, 10], [10, 10], [15.6, 10],
    [4.4, 15.6], [10, 15.6], [15.6, 15.6],
  ];
  return (
    <g>
      {cells.map(([x, y], index) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="4"
          height="4"
          rx="1.15"
          fill="currentColor"
          stroke="none"
          opacity={0.28 + (index % 3) * 0.22}
        />
      ))}
      {grouped && <path d="M4 9.2h16M9.2 4v16" strokeWidth="1.05" opacity="0.72" />}
    </g>
  );
}

function RadarTableMini() {
  return (
    <g>
      <RadarMini small />
      <TableMini x={15} y={6.3} width={5.8} height={11.4} />
    </g>
  );
}

function RadarBarsMini() {
  return (
    <g>
      <RadarMini small />
      <Bar x={15.5} y={13.2} width={1.8} height={4.6} opacity={0.72} />
      <Bar x={18.2} y={9.4} width={1.8} height={8.4} opacity={0.72} />
      <Bar x={20.9} y={11.4} width={1.8} height={6.4} opacity={0.72} />
    </g>
  );
}

function FodaMini() {
  return (
    <g>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="currentColor" stroke="none" opacity="0.1" />
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.2" />
      <path d="M12 4.5v15M4.5 12h15" strokeWidth="1.15" />
      <circle cx="8.5" cy="8.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.05" fill="currentColor" stroke="none" />
    </g>
  );
}

function GraficadorSvgIcon({
  variant,
  size,
  className,
}: {
  variant: GraficadorIconVariant;
  size: number;
  className?: string;
}) {
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
      {variant === "barras-agrupadas" && <BarsGrouped />}
      {variant === "barras-apiladas" && <BarsStacked rows={1} />}
      {variant === "multi-apiladas" && <BarsStacked rows={3} />}
      {variant === "pie" && <PieChartMini />}
      {variant === "donut" && <PieChartMini donut />}
      {variant === "numerico" && <NumericMini />}
      {variant === "boxplot" && <BoxplotMini />}
      {variant === "media-rango" && <MediaRangoMini />}
      {variant === "radar" && <RadarMini />}
      {variant === "tabla" && <TableMini />}
      {variant === "dim-radar" && <RadarMini />}
      {variant === "dim-radar-tabla" && <RadarTableMini />}
      {variant === "dim-heatmap" && <HeatmapMini />}
      {variant === "dim-radarbar" && <RadarBarsMini />}
      {variant === "dim-foda" && <FodaMini />}
      {variant === "dim-heatmap-criterios" && <HeatmapMini grouped />}
    </svg>
  );
}

export function GraficadorTypeIcon({ name, iconoUi, size = 16, className }: IconProps) {
  const variant = graficadorIconVariant(name);
  if (variant) {
    return <GraficadorSvgIcon variant={variant} size={size} className={className} />;
  }

  const Icon = resolveGraphLucideIcon(iconoUi, "BarChart");
  return <Icon size={size} className={className} aria-hidden={true} focusable="false" />;
}
