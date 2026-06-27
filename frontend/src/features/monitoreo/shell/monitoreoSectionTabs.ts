import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Clock,
  ContactRound,
  Download,
  Link2,
  MapPin,
  PhoneCall,
  PlugZap,
  QrCode,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  OPERATIONAL_MODEL_MODES,
  type MonitoreoRouteDefinition,
  type OperationalModelMode,
  type WorkbenchView,
} from "../core/monitoreoRegistry";

export type MonitoreoSectionLocalTab = {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
};

export function localTabsForSection({
  route,
  activeView,
  activeModelMode,
  activeLocalTab,
  onModelModeChange,
  onLocalTabChange,
}: {
  route: MonitoreoRouteDefinition;
  activeView: WorkbenchView;
  activeModelMode?: OperationalModelMode;
  activeLocalTab?: string;
  onModelModeChange?: (mode: OperationalModelMode) => void;
  onLocalTabChange?: (key: string) => void;
}): MonitoreoSectionLocalTab[] {
  const controlledTabs = <T extends string>(tabs: Array<Omit<MonitoreoSectionLocalTab, "active" | "onClick"> & { key: T }>) => (
    tabs.map((tab) => ({
      ...tab,
      active: activeLocalTab === tab.key,
      onClick: () => onLocalTabChange?.(tab.key),
    }))
  );

  if (route.family === "acreditacion" && activeView === "modelo") {
    return OPERATIONAL_MODEL_MODES.filter((mode) => mode.key !== "enlaces").map((mode) => ({
      key: mode.key,
      label: mode.label,
      detail: mode.desc,
      icon: mode.icon,
      active: activeModelMode === mode.key,
      onClick: () => onModelModeChange?.(mode.key),
    }));
  }

  if (route.family === "acreditacion" && activeView === "fuentes") {
    return controlledTabs([
      { key: "sheets", label: "Sheets", detail: "Base y barrido", icon: PlugZap },
      { key: "surveymonkey", label: "SurveyMonkey", detail: "Encuestas y canales", icon: QrCode },
      { key: "recopiladores", label: "Recopiladores", detail: "Collectors y entrada", icon: ContactRound },
      { key: "reconciliacion", label: "Reconciliación", detail: "Llave PUCP y casos", icon: Link2 },
    ]);
  }

  if (route.family === "territorial") {
    const byView: Partial<Record<WorkbenchView, MonitoreoSectionLocalTab[]>> = {
      fuentes: controlledTabs([
        { key: "form", label: "Formulario", detail: "Kobo y hoja de ruta", icon: PlugZap },
        { key: "filter", label: "Filtro", detail: "Distritos y corte", icon: SlidersHorizontal },
        { key: "roster", label: "Enumeradores", detail: "Códigos Pulso", icon: ContactRound },
        { key: "reconciliation", label: "Reconciliación", detail: "UMP y códigos", icon: Link2 },
        { key: "history", label: "Historial", detail: "Actualizaciones", icon: Clock },
      ]),
      modelo: controlledTabs([
        { key: "resumen", label: "Resumen", detail: "Cobertura por distrito", icon: BarChart3 },
        { key: "mapa", label: "Mapa", detail: "Manzanas y ficha", icon: Route },
      ]),
      calidad: controlledTabs([
        { key: "geolocalizacion", label: "Geolocalización", detail: "GPS y cartografía", icon: MapPin },
        { key: "reconciliacion", label: "Reconciliación", detail: "UMP y códigos", icon: Link2 },
        { key: "duracion", label: "Duración", detail: "Outliers de tiempo", icon: Clock },
        { key: "cuotas", label: "Cuotas", detail: "Marginales y brechas", icon: Target },
      ]),
      avance: controlledTabs([
        { key: "resumen", label: "Resumen", detail: "KPI territorial", icon: BarChart3 },
        { key: "ump", label: "UMP", detail: "Ritmo por manzana", icon: Route },
        { key: "ritmo", label: "Ritmo", detail: "Tendencia diaria", icon: Activity },
        { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
      ]),
      ocurrencias: controlledTabs([
        { key: "states", label: "Estados", detail: "Composición general", icon: ClipboardCheck },
        { key: "ump", label: "Por UMP", detail: "Atención por manzana", icon: Route },
        { key: "alerts", label: "Observaciones", detail: "Revisión operativa", icon: AlertTriangle },
      ]),
    };
    return byView[activeView] ?? [];
  }

  if (route.family === "aulas_universitarias") {
    return [];
  }

  const byView: Partial<Record<WorkbenchView, MonitoreoSectionLocalTab[]>> = {
    avance: controlledTabs([
      { key: "resumen", label: "Resumen", detail: "Cumplimiento general", icon: BarChart3 },
      { key: "actores", label: "Actores", detail: "Actor y segmento", icon: ContactRound },
      { key: "encuestas", label: "Encuestas", detail: "Canal y encuesta", icon: ClipboardCheck },
      { key: "detalle", label: "Detalle", detail: "Tabla operativa", icon: Table2 },
      { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
    ]),
    telefonico: controlledTabs([
      { key: "resumen", label: "Resumen", detail: "Barrido telefónico", icon: PhoneCall },
      { key: "dia", label: "Día", detail: "Ritmo diario", icon: CalendarRange },
      { key: "responsables", label: "Responsables", detail: "Equipo y carga", icon: ContactRound },
      { key: "pendientes", label: "Pendientes", detail: "Insistencia", icon: AlertTriangle },
      { key: "supervision", label: "Supervisión", detail: "Control posterior", icon: ShieldAlert },
    ]),
  };
  return byView[activeView] ?? [];
}
