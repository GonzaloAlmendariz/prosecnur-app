// Lo que dicen al pie de su contenedor los archivos de cursos-horario (ADR
// 0133, fase 5). Puro: se prueba sin React ni red.

import type { apiMonitoreoAulasDisponibilidadPlantilla, apiMonitoreoAulasGenerarLibro } from "../../../../api/monitoreo";
import type { PedidoDeCargaDeCampo } from "../../../../api/monitoreoAulasCargaDeCampo";
import type { OpcionesDeCarga } from "./cargaDeCampo";
import { fmt } from "./kpisDeAulas";

export type LibroGenerado = Awaited<ReturnType<typeof apiMonitoreoAulasGenerarLibro>>;
export type PlantillaDeDisponibilidad = Awaited<ReturnType<typeof apiMonitoreoAulasDisponibilidadPlantilla>>;

/** Qué hacer con la plantilla, y si ya trae los nombres declarados. */
export function notaDeLaPlantillaDeDisponibilidad(res: { aplicadores?: number | null }): string {
  const n = Number(res.aplicadores ?? 0);
  const que = n > 0
    ? `Trae escritos los ${fmt(n)} aplicadores ya declarados.`
    : "Se llena con el nombre de cada aplicador y un 1 o un 0 por franja.";
  return `${que} Al llenarla, vuelve por "Importar disponibilidad".`;
}

/** Pide la plantilla de disponibilidad; la entrega el contenedor del kit junto al botón. */
export type GenerarPlantillaDeDisponibilidad = () => Promise<PlantillaDeDisponibilidad>;

/**
 * El pedido del Excel de la carga de campo con las MISMAS opciones que la vista
 * (duración, eje, ventanas del motor, preparación y salida): el libro no puede
 * leer otro pico que el que se ve en pantalla.
 */
export function pedidoDeCargaDeCampo(opciones: OpcionesDeCarga): PedidoDeCargaDeCampo {
  return {
    duracionMin: opciones.duracionMin,
    ...(opciones.eje ? { eje: opciones.eje } : {}),
    ...(opciones.ventanas?.size
      ? { ventanas: [...opciones.ventanas].map(([codigo, v]) => ({ codigo, fecha: v.fecha, inicioMin: v.inicioMin })) }
      : {}),
    ...(opciones.preparacionMin != null ? { preparacionMin: opciones.preparacionMin } : {}),
    ...(opciones.salidaMin != null ? { salidaMin: opciones.salidaMin } : {}),
  };
}
