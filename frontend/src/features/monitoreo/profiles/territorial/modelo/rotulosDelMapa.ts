/**
 * Ubica el nombre de cada distrito donde no pise los puntos de la muestra ni
 * otro nombre (hallazgo del cierre: en Modelo › Metas los rótulos caían sobre
 * las manzanas). Puro: recibe candidatos ya proyectados y devuelve uno por
 * distrito, el que menos choca; a igualdad, el primero (el punto del rótulo).
 */

export type Punto = { x: number; y: number };
export type RotuloAUbicar = { clave: string; texto: string; candidatos: readonly Punto[] };
export type RotuloUbicado = { clave: string; texto: string; x: number; y: number };

const ALTO = 24;
const ANCHO_POR_LETRA = 11.6;
const HOLGURA = 4;

type Caja = { x0: number; y0: number; x1: number; y1: number };

function cajaDe(texto: string, centro: Punto): Caja {
  const ancho = texto.length * ANCHO_POR_LETRA;
  return {
    x0: centro.x - ancho / 2 - HOLGURA,
    x1: centro.x + ancho / 2 + HOLGURA,
    y0: centro.y - ALTO + 2 - HOLGURA,
    y1: centro.y + 4 + HOLGURA,
  };
}

function contiene(caja: Caja, punto: Punto): boolean {
  return punto.x >= caja.x0 && punto.x <= caja.x1 && punto.y >= caja.y0 && punto.y <= caja.y1;
}

function seCruzan(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

export function ubicarRotulos(rotulos: readonly RotuloAUbicar[], puntos: readonly Punto[]): RotuloUbicado[] {
  const puestas: Caja[] = [];
  return rotulos.map((rotulo) => {
    let mejor: { punto: Punto; costo: number } | null = null;
    for (const candidato of rotulo.candidatos) {
      const caja = cajaDe(rotulo.texto, candidato);
      const pisados = puntos.reduce((total, punto) => total + (contiene(caja, punto) ? 1 : 0), 0);
      const cruces = puestas.reduce((total, otra) => total + (seCruzan(caja, otra) ? 1 : 0), 0);
      const costo = pisados + cruces * 100;
      if (!mejor || costo < mejor.costo) mejor = { punto: candidato, costo };
      if (costo === 0) break;
    }
    const elegido = mejor?.punto ?? rotulo.candidatos[0] ?? { x: 0, y: 0 };
    puestas.push(cajaDe(rotulo.texto, elegido));
    return { clave: rotulo.clave, texto: rotulo.texto, x: elegido.x, y: elegido.y };
  });
}

/** Candidatos de un distrito: su punto de rótulo y, dentro de su caja, arriba, abajo y a los lados. */
export function candidatosDeCaja(rotulo: Punto, caja: Caja | null): Punto[] {
  if (!caja) return [rotulo];
  const centroX = (caja.x0 + caja.x1) / 2;
  const centroY = (caja.y0 + caja.y1) / 2;
  const margen = 14;
  return [
    rotulo,
    { x: centroX, y: caja.y0 + margen },
    { x: centroX, y: caja.y1 - 4 },
    { x: centroX, y: centroY },
    { x: caja.x0 + (caja.x1 - caja.x0) * 0.3, y: centroY },
    { x: caja.x0 + (caja.x1 - caja.x0) * 0.7, y: centroY },
  ];
}

/** Caja proyectada de una geometría GeoJSON (Polygon o MultiPolygon). */
export function cajaProyectada(coordenadas: unknown, proyectar: (lon: number, lat: number) => Punto): Caja | null {
  let caja: Caja | null = null;
  const recorrer = (valor: unknown) => {
    if (!Array.isArray(valor)) return;
    if (valor.length >= 2 && typeof valor[0] === "number" && typeof valor[1] === "number") {
      const punto = proyectar(valor[0], valor[1]);
      caja = caja
        ? { x0: Math.min(caja.x0, punto.x), y0: Math.min(caja.y0, punto.y), x1: Math.max(caja.x1, punto.x), y1: Math.max(caja.y1, punto.y) }
        : { x0: punto.x, y0: punto.y, x1: punto.x, y1: punto.y };
      return;
    }
    for (const item of valor) recorrer(item);
  };
  recorrer(coordenadas);
  return caja;
}
