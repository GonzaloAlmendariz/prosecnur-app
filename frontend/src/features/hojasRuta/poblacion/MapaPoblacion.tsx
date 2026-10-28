import { useMemo } from "react";
// La secuencia de datos aún no entra por theme.css (@import junto a
// tokens-formularios.css); mientras tanto la carga quien la usa.
import "../../../app/tokens-datos.css";
import districtCoverage from "../limaDistrictCoverage.json";
import "./mapaPoblacion.css";

// Población como mapa: los distritos confirmados pintados por su población
// censal en la secuencia navy de datos (no en el acento del módulo), con la
// cámara encuadrada en ellos. Solo lectura: la selección se hace en Territorio.

type Posicion = [number, number];
type Geometria = { type: "Polygon"; coordinates: Posicion[][] } | { type: "MultiPolygon"; coordinates: Posicion[][][] };
type Distrito = {
  properties: { ubigeo: string; distrito: string; label_lon: number; label_lat: number };
  geometry: Geometria;
};

const DISTRITOS = (districtCoverage as unknown as { features: Distrito[] }).features;
/** Secuencia navy de datos (dirección creativa v3): de menor a mayor. */
export const SECUENCIA_POBLACION = 6;
const COS_LAT = Math.cos((-12.05 * Math.PI) / 180);

function anillos(g: Geometria): Posicion[][] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

/** Escalón 0..5 de la secuencia, por raíz de la proporción del máximo para no aplastar a los chicos. */
export function escalonDePoblacion(valor: number, maximo: number): number {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  return Math.min(SECUENCIA_POBLACION - 1, Math.floor(Math.sqrt(valor / maximo) * SECUENCIA_POBLACION));
}

function nombreCorto(nombre: string): string {
  const t = nombre.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase());
  return t.replace("San Juan De ", "S. J. de ").replace("San Martin De ", "S. M. de ").replace(/ De /g, " de ").replace(/ Del /g, " del ");
}

export function MapaPoblacion({ territorios }: { territorios: { ubigeo: string; distrito: string; poblacion: number }[] }) {
  const modelo = useMemo(() => {
    const elegidos = new Map(territorios.map((t) => [t.ubigeo, t]));
    const x = (lon: number) => lon * COS_LAT;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const d of DISTRITOS) {
      if (elegidos.size && !elegidos.has(d.properties.ubigeo)) continue;
      for (const anillo of anillos(d.geometry)) for (const [lon, lat] of anillo) {
        x0 = Math.min(x0, x(lon)); x1 = Math.max(x1, x(lon)); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
      }
    }
    const margen = Math.max((x1 - x0) * 0.08, (y1 - y0) * 0.08, 0.01);
    x0 -= margen; x1 += margen; y0 -= margen; y1 += margen;
    const escala = 1000 / Math.max(x1 - x0, y1 - y0);
    const ancho = (x1 - x0) * escala;
    const alto = (y1 - y0) * escala;
    const P = (lon: number, lat: number): Posicion => [(x(lon) - x0) * escala, (y1 - lat) * escala];
    const trazo = (g: Geometria) => anillos(g).map((anillo) => anillo.map(([lon, lat], i) => {
      const [px, py] = P(lon, lat);
      return `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
    }).join("") + "Z").join("");
    const maximo = Math.max(0, ...territorios.map((t) => t.poblacion));
    const distritos = DISTRITOS.map((d) => {
      const t = elegidos.get(d.properties.ubigeo);
      return { ubigeo: d.properties.ubigeo, d: trazo(d.geometry), escalon: t ? escalonDePoblacion(t.poblacion, maximo) : -1 };
    });
    const etiquetas = territorios.length <= 12
      ? DISTRITOS.filter((d) => elegidos.has(d.properties.ubigeo)).map((d) => {
          const t = elegidos.get(d.properties.ubigeo)!;
          const [px, py] = P(d.properties.label_lon, d.properties.label_lat);
          return { ubigeo: t.ubigeo, x: px, y: py, nombre: nombreCorto(t.distrito), valor: `${Math.round(t.poblacion / 1000).toLocaleString("es-PE")} mil` };
        })
      : [];
    // La etiqueta se mide en unidades del encuadre: ~11 px con el mapa a 260 px de alto.
    const letra = Math.max(ancho, alto) / 24;
    return { ancho, alto, distritos, etiquetas, maximo, letra };
  }, [territorios]);

  if (!territorios.length) return null;
  return (
    <figure className="hr-mapa-poblacion">
      <svg viewBox={`0 0 ${modelo.ancho.toFixed(0)} ${modelo.alto.toFixed(0)}`} role="img" aria-label={`Población censal de los ${territorios.length} distritos confirmados`}>
        {modelo.distritos.map((d) => (
          <path key={d.ubigeo} d={d.d} className="hr-mapa-poblacion-distrito" data-escalon={d.escalon} />
        ))}
        {modelo.etiquetas.map((e) => (
          <g key={e.ubigeo} className="hr-mapa-poblacion-etiqueta">
            <text x={e.x} y={e.y - modelo.letra * 0.2} textAnchor="middle" fontSize={modelo.letra} strokeWidth={modelo.letra * 0.22}>{e.nombre}</text>
            <text x={e.x} y={e.y + modelo.letra * 0.85} textAnchor="middle" className="is-valor" fontSize={modelo.letra * 0.85} strokeWidth={modelo.letra * 0.22}>{e.valor}</text>
          </g>
        ))}
      </svg>
      <figcaption>
        <span>Población censal 2017</span>
        <span className="hr-mapa-poblacion-escala" aria-hidden="true">
          {Array.from({ length: SECUENCIA_POBLACION }, (_v, i) => <span key={i} data-escalon={i} />)}
        </span>
        <span>hasta {modelo.maximo.toLocaleString("es-PE")}</span>
      </figcaption>
    </figure>
  );
}
