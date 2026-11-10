import type { ReactNode } from "react";

import type { MonitoreoAulasConfig, MonitoreoSource } from "../../../../../api/monitoreo";
import type { GenerarPlantillaDeDisponibilidad } from "../entregasDeAulas";

/**
 * Lo que la sección Insumos toma de la página: el estado de la sesión y sus
 * acciones, con los paneles de reglas ya construidos (la página es la que sabe
 * guardar). Fuentes (I1) y Reglas (I2) sólo los ordenan.
 */
export type ContextoDeInsumos = {
  config: MonitoreoAulasConfig | null | undefined;
  fuentes: ReadonlyArray<MonitoreoSource>;
  ocupado: boolean;
  /** Reemplaza el plan entero con el de Cálculo de muestra. */
  importarPlan: () => void;
  /**
   * Las operaciones del plan de siempre (leer el libro, leer del Sheets,
   * traslape). Quedan bajo «Más operaciones» hasta que cada una tenga su lugar
   * (I1 retira `AulasOperationsPanel`).
   */
  operaciones: ReactNode;
  /** Eje de la cuota, agrupación e inicio de campo (I2, columna 2). */
  comoMide?: ReactNode;
  /** Qué cuenta como efectiva (I2, columna 1); `null` sin variables que elegir. */
  criterioDeEfectiva?: ReactNode;
  /** Cuándo un curso-horario se da por aplicado (I2, columna 3). */
  criterioDeAula?: ReactNode;
  /** Declara el umbral de duración sospechosa; `null` si todavía no se puede guardar. */
  onDeclararUmbralDeDuracion?: ((minutos: number) => void | Promise<void>) | null;
  /** I3: pide la plantilla de disponibilidad; la entrega el contenedor del kit bajo la cabecera. */
  plantillaDisponibilidad?: GenerarPlantillaDeDisponibilidad;
  /** I3: reemplaza la disponibilidad entera con la del archivo. */
  importarDisponibilidad?: (archivo: File) => void;
  /** Vuelve a pedir el corte (después de traer la entrega de Material). */
  recargar?: () => void;
};
