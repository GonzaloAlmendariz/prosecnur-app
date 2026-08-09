import {
  Activity,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  BarChart,
  BarChart2,
  BarChartBig,
  BarChartHorizontal,
  Bookmark,
  BoxSelect,
  ChartColumn,
  ChartColumnStacked,
  CircleDot,
  Cloud,
  Columns2,
  FileText,
  GraduationCap,
  Grid3X3,
  Hash,
  Layers,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  ListOrdered,
  Map,
  MoveHorizontal,
  PieChart,
  Radar,
  Rows3,
  Settings2,
  Sliders,
  Square,
  Table,
  Target,
  TrendingUp,
  Type,
  UsersRound,
  type LucideIcon,
} from "../../vendor/lucide-react";

const GRAPH_LUCIDE_ICONS = {
  Activity,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  BarChart,
  BarChart2,
  BarChartBig,
  BarChartHorizontal,
  Bookmark,
  BoxSelect,
  ChartColumn,
  ChartColumnStacked,
  CircleDot,
  Cloud,
  Columns2,
  FileText,
  GraduationCap,
  Grid3X3,
  Hash,
  Layers,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  ListOrdered,
  Map,
  MoveHorizontal,
  PieChart,
  Radar,
  Rows3,
  Settings2,
  Sliders,
  Square,
  Table,
  Target,
  TrendingUp,
  Type,
  UsersRound,
} satisfies Record<string, LucideIcon>;

export type GraphLucideIcon = LucideIcon;

export function resolveGraphLucideIcon(
  name: string | undefined,
  fallback: keyof typeof GRAPH_LUCIDE_ICONS = "Square",
): GraphLucideIcon {
  if (name && Object.prototype.hasOwnProperty.call(GRAPH_LUCIDE_ICONS, name)) {
    return GRAPH_LUCIDE_ICONS[name as keyof typeof GRAPH_LUCIDE_ICONS];
  }
  return GRAPH_LUCIDE_ICONS[fallback] ?? Square;
}

export const GraphSettingsIcon = Settings2;
export const GraphSquareIcon = Square;
