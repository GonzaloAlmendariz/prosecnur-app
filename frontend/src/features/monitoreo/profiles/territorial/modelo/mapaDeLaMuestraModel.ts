import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress } from "../../../../../api/client";
import { construirFaltante } from "../avance/faltanteModel";

/**
 * Modelo › Metas, «Manzanas de la muestra» (pedido de Gonzalo, 2026-10-24:
 * «los reemplazos solo son importantes si realmente reemplazan a algo»).
 *
 * El reemplazo en uso sale del mismo dato con que Avance › Faltante marca
 * «Reemplazo» en la cuota de cada UMP: la manzana que `ump_groups` (o
 * `operational_group_selected`) marca en uso, de tipo reemplazo, en una UMP
 * que tiene su titular. La reserva sin usar no se pinta: se cuenta.
 */

function esReemplazo(bloque: { tipo_manzana?: string | null }): boolean {
  return String(bloque.tipo_manzana ?? "").trim().toLowerCase() === "reemplazo";
}

/** Los `id_manzana` de reemplazo que hoy cubren a su titular; `null` sin el corte de avance. */
export function reemplazosEnUso(avance: MonitoreoTerritorialDashboard | null | undefined): Set<string> | null {
  if (!avance?.route_quota_progress) return null;
  const filas = construirFaltante(avance).filas;
  return new Set(filas
    .filter((fila) => fila.reemplazo && fila.otras.some((otra) => !esReemplazo(otra)))
    .map((fila) => fila.idManzana));
}

export type ManzanasDelMapa = {
  /** Lo que se pinta: titulares y los reemplazos en uso. */
  visibles: TerritorialBlockProgress[];
  titulares: number;
  enUso: number;
  /** Reemplazos de reserva que no se pintan. */
  reserva: number;
  /** Sin el corte de avance no se sabe qué reemplazo está en uso. */
  sinDatoDeUso: boolean;
};

export function manzanasDelMapa(bloques: readonly TerritorialBlockProgress[], enUso: Set<string> | null): ManzanasDelMapa {
  const titulares = bloques.filter((bloque) => !esReemplazo(bloque));
  const reemplazos = bloques.filter(esReemplazo);
  const usados = enUso ? reemplazos.filter((bloque) => enUso.has(bloque.id_manzana)) : [];
  return {
    visibles: [...titulares, ...usados],
    titulares: titulares.length,
    enUso: usados.length,
    reserva: reemplazos.length - usados.length,
    sinDatoDeUso: enUso == null,
  };
}

export type Encuadre = { ancho: number; alto: number; proyectar: (lon: number, lat: number) => { x: number; y: number } };

/**
 * Encuadra los puntos dados (lon, lat) en una caja de `ancho` × `alto` con un
 * margen parejo. Lo que cae fuera de la geometría encuadrada (los distritos
 * vecinos de contexto) se ve si la caja tiene sitio en el otro eje.
 */
export function encuadrar(puntos: ReadonlyArray<readonly [number, number]>, ancho: number, alto: number, margen: number): Encuadre {
  const validos = puntos.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!validos.length || ancho <= margen * 2 || alto <= margen * 2) {
    return { ancho, alto, proyectar: () => ({ x: ancho / 2, y: alto / 2 }) };
  }
  const lons = validos.map(([lon]) => lon);
  const lats = validos.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const escala = Math.min((ancho - margen * 2) / Math.max(1e-6, maxLon - minLon), (alto - margen * 2) / Math.max(1e-6, maxLat - minLat));
  const x0 = (ancho - (maxLon - minLon) * escala) / 2;
  const y0 = (alto - (maxLat - minLat) * escala) / 2;
  return {
    ancho,
    alto,
    proyectar: (lon, lat) => ({ x: x0 + (lon - minLon) * escala, y: y0 + (maxLat - lat) * escala }),
  };
}

/** Recorre una geometría GeoJSON y junta sus vértices. */
export function verticesDe(coordenadas: unknown): Array<[number, number]> {
  const salida: Array<[number, number]> = [];
  const recorrer = (valor: unknown) => {
    if (!Array.isArray(valor)) return;
    if (valor.length >= 2 && typeof valor[0] === "number" && typeof valor[1] === "number") {
      salida.push([valor[0], valor[1]]);
      return;
    }
    for (const hijo of valor) recorrer(hijo);
  };
  recorrer(coordenadas);
  return salida;
}

/** Trazo SVG de un Polygon o MultiPolygon con una proyección cualquiera. */
export function trazoDe(geometria: { type: string; coordinates: unknown }, proyectar: Encuadre["proyectar"]): string {
  const poligonos = (geometria.type === "MultiPolygon" ? geometria.coordinates : [geometria.coordinates]) as unknown[];
  const partes: string[] = [];
  for (const poligono of Array.isArray(poligonos) ? poligonos : []) {
    for (const anillo of Array.isArray(poligono) ? poligono : []) {
      const vertices = verticesDe(anillo);
      if (vertices.length < 3) continue;
      partes.push(vertices.map(([lon, lat], indice) => {
        const { x, y } = proyectar(lon, lat);
        return `${indice ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join("") + "Z");
    }
  }
  return partes.join(" ");
}
