import {
  Database,
  GitBranch,
  Layers,
  LayoutDashboard,
  type LucideIcon,
} from "../../../vendor/lucide-react";

export type DashboardPestanaId =
  | "resumen"
  | "relaciones"
  | "base_datos"
  | "dimensiones";

export type PestanaDashboard<Key extends DashboardPestanaId = DashboardPestanaId> = {
  readonly id: Key;
  readonly key: Key;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly to: "/tablero";
  readonly layoutPolicy: "viewport";
  readonly direccionPublicada: false;
};

function pestana<const Key extends DashboardPestanaId>(
  key: Key,
  label: string,
  icon: LucideIcon,
): PestanaDashboard<Key> {
  return {
    id: key,
    key,
    label,
    icon,
    to: "/tablero",
    layoutPolicy: "viewport",
    direccionPublicada: false,
  };
}

/**
 * Estructura estable del Dashboard. El manifiesto del backend conserva en
 * runtime disponibilidad y motivo; la configuración decide visibilidad.
 */
export const DASHBOARD_PESTANAS = [
  pestana("resumen", "Resumen", LayoutDashboard),
  pestana("relaciones", "Relaciones", GitBranch),
  pestana("base_datos", "Base de datos", Database),
  pestana("dimensiones", "Dimensiones", Layers),
] as const;

export const DEFAULT_DASHBOARD_PESTANA_ID = DASHBOARD_PESTANAS[0].id;
