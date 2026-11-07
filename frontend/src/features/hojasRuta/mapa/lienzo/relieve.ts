import { useEffect, useState } from "react";
import indice from "../../relieveIndice.json";
import { proyectarLonLat, type Caja } from "./camara";
import type { UtilLienzo } from "./LienzoMapa";

/**
 * Relieve sombreado bajo el mapa (revisión del 7 nov 2026, H10): cerros, valles y costa como contexto, sin
 * competir con los datos. Imágenes de `build_relieve.R` (Copernicus DEM GLO-90) en `public/relieve/`: gris =
 * sombra (255 luz plena), alfa 0 = mar. El Perú va siempre de fondo y la ciudad abierta encima, con el borde
 * difuminado para que no se note el corte. Los colores salen de los tokens del lienzo al componer.
 */

type Entrada = { clave: string; oeste: number; este: number; sur: number; norte: number; ancho: number; alto: number; huella?: string };

const ENTRADAS = new Map<string, Entrada>(((indice as { imagenes?: Entrada[] }).imagenes ?? []).map((e) => [e.clave, e]));
export const FUENTE_RELIEVE = String((indice as { fuente?: string }).fuente ?? "");
export const hayRelieve = (clave: string | null | undefined): clave is string => Boolean(clave && ENTRADAS.has(clave));

/** Cuánto oscurece la sombra más profunda: contexto, no protagonista (la maqueta aprobada usaba 14 %). */
const SOMBRA_MAX = 0.14;
/** Opacidad máxima del velo de sombra que se lee también dentro de los distritos coloreados. */
const VELO_MAX = 0.16;
/** Fracción de cada lado de una imagen que se difumina: la ciudad se funde con el Perú y el Perú, con el fondo. */
const BORDE_DIFUSO = 0.1;

export type Relieve = {
  clave: string;
  /** Caja en el mundo del lienzo: [oeste, norte, este, sur] en metros (y crece hacia el sur). */
  caja: Caja;
  imagen: HTMLImageElement;
  compuesto?: { firma: string; base: HTMLCanvasElement; velo: HTMLCanvasElement };
};

const cache = new Map<string, Promise<Relieve | null>>();

function cargar(clave: string): Promise<Relieve | null> {
  let p = cache.get(clave);
  if (!p) {
    const e = ENTRADAS.get(clave);
    if (!e) return Promise.resolve(null);
    const [x0, y0] = proyectarLonLat(e.oeste, e.norte);
    const [x1, y1] = proyectarLonLat(e.este, e.sur);
    p = new Promise<Relieve | null>((resolve) => {
      const imagen = new Image();
      imagen.decoding = "async";
      imagen.onload = () => resolve({ clave, caja: [x0, y0, x1, y1], imagen });
      // Sin relieve el mapa sigue siendo el de siempre: no es un error que deba ver nadie.
      imagen.onerror = () => {
        cache.delete(clave);
        resolve(null);
      };
      // La huella del archivo en la URL: al regenerar el relieve no se sirve la imagen vieja de la caché.
      imagen.src = `${import.meta.env.BASE_URL}relieve/${clave}.webp${e.huella ? `?v=${e.huella}` : ""}`;
    });
    cache.set(clave, p);
  }
  return p;
}

/** Los relieves de las claves dadas, a medida que llegan (el del Perú primero). */
export function useRelieves(claves: readonly (string | null | undefined)[]): Relieve[] {
  const validas = claves.filter(hayRelieve);
  const firma = validas.join(",");
  const [listos, setListos] = useState<Relieve[]>([]);
  useEffect(() => {
    let vivo = true;
    const lista = firma ? firma.split(",") : [];
    void Promise.all(lista.map(cargar)).then((rs) => vivo && setListos(rs.filter((r): r is Relieve => Boolean(r))));
    return () => {
      vivo = false;
    };
  }, [firma]);
  return listos;
}

const rgb = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number] : [250, 251, 255];
};

/** Base (tierra sombreada y mar) y velo (sólo la sombra), compuestos una vez por imagen y por colores. */
function componer(r: Relieve, fondo: string, mar: string, sombra: string): NonNullable<Relieve["compuesto"]> {
  const firma = `${fondo}|${mar}|${sombra}`;
  if (r.compuesto?.firma === firma) return r.compuesto;
  const { naturalWidth: w, naturalHeight: h } = r.imagen;
  const lienzo = (ancho: number, alto: number) => Object.assign(document.createElement("canvas"), { width: ancho, height: alto });
  const fuente = lienzo(w, h);
  const fctx = fuente.getContext("2d", { willReadFrequently: true });
  const base = lienzo(w, h);
  const velo = lienzo(w, h);
  if (!fctx) return { firma, base, velo };
  fctx.drawImage(r.imagen, 0, 0);
  const px = fctx.getImageData(0, 0, w, h).data;
  const salidaBase = new ImageData(w, h);
  const salidaVelo = new ImageData(w, h);
  const [fr, fg, fb] = rgb(fondo);
  const [mr, mg, mb] = rgb(mar);
  const [sr, sg, sb] = rgb(sombra);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const luz = px[i] / 255;
      const tierra = px[i + 3] >= 128;
      // Borde difuso: sin él la imagen se leía como un rectángulo (el mar cortado en seco en su borde).
      const borde = Math.min(1, Math.min(x, y, w - 1 - x, h - 1 - y) / (BORDE_DIFUSO * Math.min(w, h)));
      const k = tierra ? 1 - SOMBRA_MAX * (1 - luz) : 1;
      salidaBase.data[i] = tierra ? fr * k : mr;
      salidaBase.data[i + 1] = tierra ? fg * k : mg;
      salidaBase.data[i + 2] = tierra ? fb * k : mb;
      salidaBase.data[i + 3] = 255 * borde;
      salidaVelo.data[i] = sr;
      salidaVelo.data[i + 1] = sg;
      salidaVelo.data[i + 2] = sb;
      salidaVelo.data[i + 3] = tierra ? 255 * VELO_MAX * (1 - luz) * borde : 0;
    }
  }
  base.getContext("2d")?.putImageData(salidaBase, 0, 0);
  velo.getContext("2d")?.putImageData(salidaVelo, 0, 0);
  r.compuesto = { firma, base, velo };
  return r.compuesto;
}

/**
 * Dibuja los relieves en coordenadas de mundo: «base» debajo de todo (tierra sombreada y mar), «velo» encima
 * de los rellenos de distrito, para que el relieve también se lea dentro de ellos.
 */
export function dibujarRelieves(ctx: CanvasRenderingContext2D, u: UtilLienzo, relieves: readonly Relieve[], capa: "base" | "velo") {
  if (!relieves.length) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const r of relieves) {
    const c = componer(r, u.colores.fondo, u.colores.mar, u.colores.texto);
    const [x0, y0, x1, y1] = r.caja;
    ctx.drawImage(capa === "base" ? c.base : c.velo, x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}
