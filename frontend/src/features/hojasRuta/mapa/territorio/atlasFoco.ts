import type { Caja } from "../lienzo/camara";
import type { LimiteNombrado } from "../lienzo/limites";
import { unirCajas } from "../lienzo/piezas";
import { LIMA, type CiudadAtlas } from "./ciudades";
import { puntoEnAnillo } from "./puntoEnDistrito";

/**
 * Niveles del atlas de Territorio (pedido de Gonzalo, 2026-10-30): el Perú, un departamento (zoom a sus
 * ciudades) y una ciudad (zoom a sus distritos). El índice nombra el departamento con tilde («San Martín»)
 * y los límites igual o sin ella («Ancash»): se comparan sin tildes ni mayúsculas.
 */

export const claveNombre = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Departamentos de una ciudad: Lima y Callao abarca dos. */
export function departamentosDeCiudad(c: Pick<CiudadAtlas, "codigo" | "departamento">): string[] {
  return c.codigo === LIMA ? ["lima", "callao"] : [claveNombre(c.departamento)];
}

export function ciudadesDeDepartamento(atlas: readonly CiudadAtlas[], departamento: string): CiudadAtlas[] {
  const k = claveNombre(departamento);
  return atlas.filter((c) => departamentosDeCiudad(c).includes(k));
}

/** El departamento bajo un punto del mundo, o `null` (par-impar, como los distritos). */
export function departamentoEnPunto(departamentos: readonly LimiteNombrado[], x: number, y: number): LimiteNombrado | null {
  for (const d of departamentos) {
    if (x < d.caja[0] || x > d.caja[2] || y < d.caja[1] || y > d.caja[3]) continue;
    if (d.anillos.filter((r) => puntoEnAnillo(x, y, r)).length % 2 === 1) return d;
  }
  return null;
}

/**
 * Encuadre del atlas: la ciudad enfocada (sus distritos si ya llegaron, si no su silueta); si no, el
 * departamento enfocado con sus ciudades dentro (sólo la silueta de una ciudad dejaba el departamento
 * fuera de cuadro); si no, el país.
 */
export function cajaDelAtlas(opts: {
  atlas: readonly CiudadAtlas[];
  departamentos: readonly LimiteNombrado[];
  pais: Caja | null;
  departamento: string | null;
  ciudad: string | null;
  distritosCiudad: readonly Caja[];
}): Caja | null {
  const { atlas, departamentos, pais, departamento, ciudad, distritosCiudad } = opts;
  if (ciudad) {
    const c = atlas.find((x) => x.codigo === ciudad);
    return unirCajas([...distritosCiudad]) ?? c?.caja ?? pais;
  }
  if (departamento) {
    const propio = departamentos.find((d) => claveNombre(d.nombre) === claveNombre(departamento))?.caja;
    const cajas = [...(propio ? [propio] : []), ...ciudadesDeDepartamento(atlas, departamento).map((c) => c.caja)];
    return unirCajas(cajas) ?? pais;
  }
  return pais;
}
