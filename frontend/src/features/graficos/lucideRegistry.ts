import {
  Activity,
  AlignLeft,
  BarChart,
  BarChart2,
  BarChartBig,
  BarChartHorizontal,
  Bookmark,
  BoxSelect,
  CircleDot,
  Columns2,
  FileText,
  GraduationCap,
  Grid3X3,
  Hash,
  Layers,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  PieChart,
  Radar,
  Rows3,
  Settings2,
  Sliders,
  Square,
  Table,
  Target,
  Type,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const GRAPH_LUCIDE_ICONS = {
  Activity,
  AlignLeft,
  BarChart,
  BarChart2,
  BarChartBig,
  BarChartHorizontal,
  Bookmark,
  BoxSelect,
  CircleDot,
  Columns2,
  FileText,
  GraduationCap,
  Grid3X3,
  Hash,
  Layers,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  PieChart,
  Radar,
  Rows3,
  Settings2,
  Sliders,
  Square,
  Table,
  Target,
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
