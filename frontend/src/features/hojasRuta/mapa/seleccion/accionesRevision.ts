import type { TipoObservacion } from "../../seleccion/revisionMarco";

/**
 * Qué hacer con cada observación de la revisión contra el marco (checklist F23). La revisión dice qué
 * pasa; esto dice dónde se arregla. La remedia de fondo de las manzanas sin viviendas, o con muy pocas,
 * es el marco elegible (ADR 0115): un mínimo de viviendas las deja fuera del sorteo. Para una ruta
 * suelta, el reemplazo puntual en Material de campo.
 *
 * `minimoMarco`: mínimo de viviendas del marco elegible declarado; null si el estudio no lo declaró.
 */
/** `destino`: el bloque del marco elegible en Manzanas, o Manzanas a secas (reemplazos por titular). */
export type AccionObservacion = { texto: string; destino: "marco" | "manzanas" };

export function accionDeObservacion(tipo: TipoObservacion, minimoMarco: number | null): AccionObservacion | null {
  const sinMarco = minimoMarco === null || minimoMarco < 1;
  switch (tipo) {
    case "titular-sin-viviendas":
    case "reemplazo-sin-viviendas":
      return sinMarco
        ? { texto: "Volver a sortear con el marco elegible (mínimo 1 vivienda) las deja fuera.", destino: "marco" }
        : null;
    case "titular-corta":
    case "reemplazo-corto":
    case "titular-sin-margen":
      return { texto: `Un mínimo de viviendas más alto en el marco elegible${sinMarco ? "" : ` (hoy ${minimoMarco})`} deja fuera las manzanas chicas; para una ruta suelta, pide un reemplazo puntual.`, destino: "marco" };
    case "titular-sin-reemplazo":
      return { texto: "Sube los reemplazos por titular en Manzanas y vuelve a sortear, o pide un reemplazo puntual para esa ruta.", destino: "manzanas" };
    case "titular-atipica":
      // Su detalle ya dice qué hacer (fijar la esquina de inicio en la ficha).
      return null;
  }
}
