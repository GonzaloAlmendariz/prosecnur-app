/**
 * La silueta de un distrito para las tarjetas de UMP (Gonzalo, 2026-10-24:
 * «elementos más creativos como contorno de distritos para territorial»).
 *
 * Sale de la misma cartografía PlanMet que dibuja Avance › Mapa
 * (`limaDistrictCoverage.json`); no se inventa geometría: si el distrito no
 * está en la cartografía, no hay silueta y la tarjeta no reserva el hueco.
 * La proyección es propia de la silueta (encuadra sólo ese distrito) para que
 * cada contorno llene su caja.
 */

type Punto = [number, number];
type Anillo = Punto[];
type Poligono = Anillo[];

export type GeometriaDeDistrito =
  | { type: "Polygon"; coordinates: Poligono }
  | { type: "MultiPolygon"; coordinates: Poligono[] };

export type DistritoConGeometria = {
  properties: { ubigeo: string; distrito: string };
  geometry: GeometriaDeDistrito;
};

export type Silueta = {
  ubigeo: string;
  /** Trazo SVG en la caja `0 0 lado lado`. */
  trazo: string;
  lado: number;
  /** Posición de la manzana dentro de la caja, si se dio y cae en el encuadre. */
  punto: { x: number; y: number } | null;
};

/** «SAN JUAN DE LURIGANCHO», «San Juan de Lurigancho» y «san juan de lurigancho» son el mismo. */
export function claveDeDistrito(nombre: unknown): string {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function poligonos(geometria: GeometriaDeDistrito): Poligono[] {
  return geometria.type === "Polygon" ? [geometria.coordinates] : geometria.coordinates;
}

export function buscarDistrito<T extends DistritoConGeometria>(
  distritos: readonly T[],
  nombreOUbigeo: unknown,
): T | null {
  const clave = claveDeDistrito(nombreOUbigeo);
  if (!clave) return null;
  return distritos.find((feature) => (
    claveDeDistrito(feature.properties.distrito) === clave || claveDeDistrito(feature.properties.ubigeo) === clave
  )) ?? null;
}

export function construirSilueta(
  distrito: DistritoConGeometria,
  lado = 64,
  margen = 4,
  manzana: { lon: number; lat: number } | null = null,
): Silueta | null {
  const anillos = poligonos(distrito.geometry).flat();
  const puntos = anillos.flat().filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!puntos.length) return null;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of puntos) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const util = lado - margen * 2;
  const escala = util / Math.max(1e-9, maxLon - minLon, maxLat - minLat);
  const dx = margen + (util - (maxLon - minLon) * escala) / 2;
  const dy = margen + (util - (maxLat - minLat) * escala) / 2;
  const proyectar = (lon: number, lat: number) => ({ x: dx + (lon - minLon) * escala, y: dy + (maxLat - lat) * escala });
  const trazo = anillos
    .filter((anillo) => anillo.length > 2)
    .map((anillo) => anillo
      .map(([lon, lat], indice) => {
        const p = proyectar(lon, lat);
        return `${indice ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join("") + "Z")
    .join("");
  let punto: Silueta["punto"] = null;
  if (manzana && Number.isFinite(manzana.lon) && Number.isFinite(manzana.lat)) {
    const p = proyectar(manzana.lon, manzana.lat);
    if (p.x >= 0 && p.x <= lado && p.y >= 0 && p.y <= lado) punto = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
  }
  return { ubigeo: distrito.properties.ubigeo, trazo, lado, punto };
}
