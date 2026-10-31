import type { ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { CursosHorarioAulas } from "../avance/CursosHorarioAulas";
import { PorFacultadAulas } from "../avance/PorFacultadAulas";
import { ResumenAulas } from "../avance/ResumenAulas";
import type { DireccionAulas } from "./direccionAulas";

/**
 * El contenido propio de una pestaña del revamp (las marcadas `propia` en
 * `direccionAulas.ts`). La página sólo monta este punto: cada pestaña nueva se
 * cuelga aquí y no en `AulasMonitoreoPage.tsx`, que no debe crecer (G8).
 *
 * Devuelve `null` si la dirección no tiene contenido propio todavía.
 */
export function PestanaPropiaDeAulas({ direccion, dashboard, cargando, vacioSinTablero }: {
  direccion: DireccionAulas;
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
}) {
  const props = { dashboard, cargando, vacioSinTablero };
  if (direccion.seccion === "avance" && direccion.pestana === "resumen") return <ResumenAulas {...props} />;
  if (direccion.seccion === "avance" && direccion.pestana === "porfacultad") return <PorFacultadAulas {...props} />;
  // A3 sólo en su vista principal: la sub-vista «Estado del campo» monta la
  // vista heredada de Resumen.
  if (direccion.seccion === "avance" && direccion.pestana === "cursos" && direccion.panel == null) {
    return <CursosHorarioAulas {...props} />;
  }
  return null;
}
