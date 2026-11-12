// "Por hacer" de Estado del estudio, como lista numerada con su "Ir"
// (prototipo "estado"). Orden: el siguiente paso del estudio (`queSigue`), las
// bases que esperan su aprobación para informe (solo en bases independientes,
// donde el motor la publica) y las secciones que la banda marca como
// bloqueadas o incompletas.

import type { AprobacionDeBase, Aprobaciones } from "./aprobacionesModel";
import type { FilaDeBase } from "./basesDelEstudioModel";
import { NOMBRE_DE_SECCION, RUTA_DE_SECCION, type QueSigue } from "./queSigueModel";

export type TareaPorHacer = {
  clave: string;
  titulo: string;
  /** La segunda línea: la causa del paso o la base a la que se refiere. */
  detalle: string | null;
  to: string;
  /** A dónde lleva "Ir", para el nombre accesible del botón. */
  destino: string;
  /** No se puede abrir todavía: lleva el chip "Bloqueada" en vez de "Ir". */
  bloqueada: boolean;
  /** La base que hay que activar antes de ir; `null` si la tarea es del estudio. */
  base: string | null;
};

function tareaDeAprobacion(aprobacion: AprobacionDeBase, etiqueta: string): TareaPorHacer | null {
  if (aprobacion.estado !== "lista" && aprobacion.estado !== "desactualizada") return null;
  const desactualizada = aprobacion.estado === "desactualizada";
  return {
    clave: `aprobacion:${aprobacion.base}`,
    titulo: desactualizada ? "Volver a aprobar para informe" : "Aprobar para informe",
    detalle: desactualizada ? `${etiqueta}: cambió un insumo después de aprobarla` : etiqueta,
    to: RUTA_DE_SECCION.analitica,
    destino: NOMBRE_DE_SECCION.analitica,
    bloqueada: false,
    base: aprobacion.base,
  };
}

export function porHacer(
  sigue: QueSigue,
  aprobaciones: Aprobaciones | null,
  filas: readonly FilaDeBase[],
): TareaPorHacer[] {
  const tareas: TareaPorHacer[] = [];
  if (!sigue.completo) {
    tareas.push({
      clave: `paso:${sigue.paso.seccion}`,
      titulo: sigue.paso.titulo,
      detalle: sigue.paso.causa,
      to: sigue.paso.to,
      destino: NOMBRE_DE_SECCION[sigue.paso.seccion],
      bloqueada: false,
      base: null,
    });
  }
  if (aprobaciones) {
    for (const fila of filas) {
      const aprobacion = aprobaciones.porBase.get(fila.nombre);
      const tarea = aprobacion ? tareaDeAprobacion(aprobacion, fila.etiqueta) : null;
      if (tarea) tareas.push(tarea);
    }
  }
  for (const pendiente of sigue.pendientes) {
    tareas.push({
      clave: `seccion:${pendiente.seccion}`,
      titulo: pendiente.nombre,
      detalle: pendiente.motivo,
      to: pendiente.to,
      destino: pendiente.nombre,
      bloqueada: pendiente.estado === "bloqueada",
      base: null,
    });
  }
  return tareas;
}
