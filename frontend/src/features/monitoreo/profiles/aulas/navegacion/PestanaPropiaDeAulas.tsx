import type { ReactNode } from "react";

import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow } from "../../../../../api/monitoreo";
import { CursosHorarioAulas } from "../avance/CursosHorarioAulas";
import { PorFacultadAulas } from "../avance/PorFacultadAulas";
import { RendimientoAulas } from "../avance/RendimientoAulas";
import { SalidasAulas, type ContextoDeSalidas } from "../avance/SalidasAulas";
import { AgendaAulas } from "../control/AgendaAulas";
import { ContactoAulas } from "../control/ContactoAulas";
import { PartesAulas } from "../control/PartesAulas";
import { CalidadAulas } from "../control/CalidadAulas";
import { DistribucionAulas, type ContextoDeDistribucion } from "../control/DistribucionAulas";
import { FuentesAulas } from "../insumos/FuentesAulas";
import { ReglasAulas } from "../insumos/ReglasAulas";
import { AplicadoresAulas } from "../insumos/AplicadoresAulas";
import { MetasAulas } from "../modelo/MetasAulas";
import { MuestraAulas } from "../modelo/MuestraAulas";
import type { ContextoDeInsumos } from "../insumos/contextoDeInsumos";
import { ResumenAulas } from "../avance/ResumenAulas";
import type { DireccionAulas } from "./direccionAulas";

/**
 * El contenido propio de una pestaña del revamp (las marcadas `propia` en
 * `direccionAulas.ts`). La página sólo monta este punto: cada pestaña nueva se
 * cuelga aquí y no en `AulasMonitoreoPage.tsx`, que no debe crecer (G8).
 *
 * Devuelve `null` si la dirección no tiene contenido propio todavía.
 */
export function PestanaPropiaDeAulas({ direccion, dashboard, cargando, vacioSinTablero, salidas, insumos, agendaVisible, distribucion }: {
  direccion: DireccionAulas;
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  /** El estado y las acciones que Salidas toma de la página (A5). */
  salidas?: ContextoDeSalidas;
  /** El estado de la sesión y las acciones que Insumos toma de la página (I1). */
  insumos?: ContextoDeInsumos;
  /** Las filas de la agenda que arma la página (titulares y reservas despiertas). */
  agendaVisible?: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** La config y las acciones del reparto que Distribución toma de la página (Ctl3). */
  distribucion?: ContextoDeDistribucion;
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
  // I1 se muestra aunque no haya tablero: importar el plan es la acción de arranque.
  if (direccion.seccion === "insumos" && direccion.pestana === "fuentes" && direccion.panel == null && insumos) {
    return <FuentesAulas dashboard={dashboard} cargando={cargando} contexto={insumos} />;
  }
  if (direccion.seccion === "insumos" && direccion.pestana === "reglas" && direccion.panel == null && insumos) {
    return <ReglasAulas {...props} contexto={insumos} />;
  }
  if (direccion.seccion === "insumos" && direccion.pestana === "aplicadores" && direccion.panel == null && insumos) {
    return <AplicadoresAulas {...props} contexto={insumos} />;
  }
  if (direccion.seccion === "modelo" && direccion.pestana === "metas" && direccion.panel == null) {
    return <MetasAulas {...props} />;
  }
  if (direccion.seccion === "modelo" && direccion.pestana === "muestra" && direccion.panel == null) {
    return <MuestraAulas {...props} />;
  }
  if (direccion.seccion === "control" && direccion.pestana === "contacto" && direccion.panel == null) {
    return <ContactoAulas {...props} agenda={agendaVisible ?? []} />;
  }
  if (direccion.seccion === "control" && direccion.pestana === "distribucion" && direccion.panel == null && distribucion) {
    return <DistribucionAulas {...props} contexto={distribucion} />;
  }
  if (direccion.seccion === "control" && direccion.pestana === "partes" && direccion.panel == null) {
    return <PartesAulas {...props} />;
  }
  if (direccion.seccion === "control" && direccion.pestana === "calidad" && direccion.panel == null) {
    return <CalidadAulas {...props} onDeclararUmbral={insumos?.onDeclararUmbralDeDuracion ?? null} />;
  }
  // A5 se muestra aunque no haya tablero: sus salidas no dependen de él.
  if (direccion.seccion === "avance" && direccion.pestana === "salidas" && direccion.panel == null && salidas) {
    return <SalidasAulas contexto={salidas} />;
  }
  return null;
}
