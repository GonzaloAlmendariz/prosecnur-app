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
  readonly to: string;
  readonly layoutPolicy: "viewport";
  readonly direccionPublicada: true;
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
    to: `/tablero?pestana=${key}`,
    layoutPolicy: "viewport",
    // Publicada desde 2026-08-15: la pestaña activa vivía sólo en el store y
    // el recorrido del QA visual llegaba a Resumen y a ninguna otra. La
    // dirección se resuelve en `DashboardRuta`, que es lo que monta la ruta
    // de admin; el artefacto público corre fuera del Router y no la usa.
    direccionPublicada: true,
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
