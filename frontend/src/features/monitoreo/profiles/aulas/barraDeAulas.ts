import type { BarraDelModo } from "../../shell/BarraDelModo";
import { corteCorto, estadoDelModo } from "../../core/barraComun";

/**
 * L38 · Cursos-horario entra a la barra común con un solo «Actualizar ▾», como
 * Telefónico, Acreditación y Territorial. El cuerpo abre el panel de P1 (qué
 * hará, en qué paso va, recibo): trae lo nuevo de la plataforma y recalcula. El
 * menú lleva lo que antes eran botones sueltos: recalcular sin pedir nada
 * («Recalcular sin traer») y el viejo «Avance», que nunca trajo datos: abre la
 * sección y la vuelve a leer con lo que el proyecto ya tiene.
 */
export function construirBarraDeAulas({
  registros,
  syncedAt,
  generationStatus,
  pendienteDeRecalcular,
  hayEstado,
  cargando,
  actualizando,
  error,
  ocupado,
  importado,
  tituloActualizar,
  onActualizar,
  onRecalcular,
  onReleerAvance,
}: {
  registros: number;
  syncedAt: string;
  generationStatus: string;
  pendienteDeRecalcular: boolean;
  hayEstado: boolean;
  cargando: boolean;
  actualizando: boolean;
  error: string;
  ocupado: boolean;
  importado: boolean;
  tituloActualizar: string;
  onActualizar: () => void;
  onRecalcular: () => void;
  onReleerAvance: () => void;
}): BarraDelModo {
  return {
    indicadores: [{ etiqueta: "Registros", valor: registros.toLocaleString("es-PE") }],
    corte: corteCorto(syncedAt),
    estado: estadoDelModo({ actualizando, cargando, hayEstado, generationStatus, pendienteDeRecalcular, error }),
    actualizar: {
      etiqueta: "Actualizar",
      titulo: tituloActualizar,
      disabled: ocupado || !importado,
      onElegir: onActualizar,
    },
    otrasActualizaciones: [
      {
        clave: "recalcular",
        etiqueta: "Recalcular sin traer",
        detalle: "Rehace el corte, la agenda y el avance con lo que ya está",
        disabled: ocupado || !importado,
        onElegir: onRecalcular,
      },
      {
        clave: "releer-avance",
        etiqueta: "Releer el avance",
        detalle: "Abre Avance y lo vuelve a leer, sin pedir nada a la plataforma",
        disabled: ocupado,
        onElegir: onReleerAvance,
      },
    ],
  };
}
