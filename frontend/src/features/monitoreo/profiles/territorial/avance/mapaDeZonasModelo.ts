import type { DistritoConGeometria } from "./siluetaModel";
import { buscarDistrito } from "./siluetaModel";

/**
 * Las zonas de un envío por cuotas en un mismo encuadre: cada distrito con su
 * contorno real (la cartografía PlanMet de Avance › Mapa) y los vecinos que
 * caen en el encuadre, en gris, para que el mapa tenga contexto. No se inventa
 * geometría: una zona sin distrito en la cartografía no se dibuja.
 */
type Punto = [number, number];

export type ZonaEnMapa = { clave: string; trazo: string; rotulo: { x: number; y: number } };
export type MapaDeZonas = { ancho: number; alto: number; zonas: ZonaEnMapa[]; vecinos: string; proyectar: (lon: number, lat: number) => { x: number; y: number } };

function anillosDe(d: DistritoConGeometria): Punto[][] {
  const g = d.geometry;
  const polis = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polis.flat() as Punto[][];
}

function rotuloDe(d: DistritoConGeometria): Punto | null {
  const p = d.properties as { label_lon?: unknown; label_lat?: unknown };
  const lon = Number(p.label_lon);
  const lat = Number(p.label_lat);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

/**
 * @param claves nombre o ubigeo de cada zona, en el orden en que se quieren.
 * @param ancho, alto la caja del SVG.
 */
export function construirMapaDeZonas(
  distritos: readonly DistritoConGeometria[],
  claves: readonly string[],
  ancho = 600,
  alto = 560,
  margen = 0.05,
): MapaDeZonas | null {
  const elegidos = claves.map((c) => ({ clave: c, d: buscarDistrito(distritos, c) }));
  const conGeo = elegidos.filter((e): e is { clave: string; d: DistritoConGeometria } => e.d != null);
  if (!conGeo.length) return null;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const { d } of conGeo) {
    for (const anillo of anillosDe(d)) {
      for (const [lon, lat] of anillo) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  const mLon = (maxLon - minLon) * margen;
  const mLat = (maxLat - minLat) * margen;
  minLon -= mLon; maxLon += mLon; minLat -= mLat; maxLat += mLat;
  // A la latitud de Lima un grado de longitud mide cos(lat) de uno de latitud.
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const escala = Math.min(ancho / ((maxLon - minLon) * k), alto / (maxLat - minLat));
  const ox = (ancho - (maxLon - minLon) * k * escala) / 2;
  const oy = (alto - (maxLat - minLat) * escala) / 2;
  const proyectar = (lon: number, lat: number) => ({ x: ox + (lon - minLon) * k * escala, y: oy + (maxLat - lat) * escala });
  const trazar = (d: DistritoConGeometria) => anillosDe(d)
    .filter((a) => a.length > 2)
    .map((a) => a.map(([lon, lat], i) => {
      const p = proyectar(lon, lat);
      return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join("") + "Z")
    .join("");
  const zonas = conGeo.map(({ clave, d }) => {
    const r = rotuloDe(d);
    let rotulo = r ? proyectar(r[0], r[1]) : null;
    if (!rotulo) {
      const pts = anillosDe(d)[0] ?? [];
      const cx = pts.reduce((s, p) => s + p[0], 0) / Math.max(1, pts.length);
      const cy = pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length);
      rotulo = proyectar(cx, cy);
    }
    return { clave, trazo: trazar(d), rotulo };
  });
  const usados = new Set(conGeo.map((e) => e.d.properties.ubigeo));
  const vecinos = distritos
    .filter((d) => !usados.has(d.properties.ubigeo))
    .filter((d) => anillosDe(d)[0]?.some(([lon, lat]) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat))
    .map(trazar)
    .join("");
  return { ancho, alto, zonas, vecinos, proyectar };
}
