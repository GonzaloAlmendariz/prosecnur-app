import type { ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { CursosHorarioAulas } from "../avance/CursosHorarioAulas";
import { PorFacultadAulas } from "../avance/PorFacultadAulas";
import { RendimientoAulas } from "../avance/RendimientoAulas";
import { SalidasAulas, type ContextoDeSalidas } from "../avance/SalidasAulas";
import { AgendaAulas } from "../control/AgendaAulas";
import { ResumenAulas } from "../avance/ResumenAulas";
import type { DireccionAulas } from "./direccionAulas";

/**
 * El contenido propio de una pestaña del revamp (las marcadas `propia` en
 * `direccionAulas.ts`). La página sólo monta este punto: cada pestaña nueva se
 * cuelga aquí y no en `AulasMonitoreoPage.tsx`, que no debe crecer (G8).
 *
 * Devuelve `null` si la dirección no tiene contenido propio todavía.
 */
export function PestanaPropiaDeAulas({ direccion, dashboard, cargando, vacioSinTablero, salidas }: {
  direccion: DireccionAulas;
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  /** El estado y las acciones que Salidas toma de la página (A5). */
  salidas?: ContextoDeSalidas;
}) {
  const props = { dashboard, cargando, vacioSinTablero };
  if (direccion.seccion === "avance" && direccion.pestana === "resumen") return <ResumenAulas {...props} />;
  if (direccion.seccion === "avance" && direccion.pestana === "porfacultad") return <PorFacultadAulas {...props} />;
  // A3 sólo en su vista principal: la sub-vista «Estado del campo» monta la
  // vista heredada de Resumen.
  if (direccion.seccion === "avance" && direccion.pestana === "cursos" && direccion.panel == null) {
    return <CursosHorarioAulas {...props} />;
  }
  if (direccion.seccion === "avance" && direccion.pestana === "rendimiento" && direccion.panel == null) {
    return <RendimientoAulas {...props} />;
  }
  if (direccion.seccion === "control" && direccion.pestana === "agenda" && direccion.panel == null) {
    return <AgendaAulas {...props} />;
  }
  // A5 se muestra aunque no haya tablero: sus salidas no dependen de él.
  if (direccion.seccion === "avance" && direccion.pestana === "salidas" && direccion.panel == null && salidas) {
    return <SalidasAulas contexto={salidas} />;
  }
  return null;
}
