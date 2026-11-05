import type { HojasRutaTerritory, SelectedBlock } from "../../../../api/hojasRuta";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import type { Caja } from "../lienzo/camara";
import type { LimiteNombrado } from "../lienzo/limites";
import { unirCajas } from "../lienzo/piezas";
import { claveNombre, departamentosDeCiudad } from "../territorio/atlasFoco";
import { ciudadDeUbigeo, type CiudadAtlas } from "../territorio/ciudades";

/**
 * Vista nacional del mapa de Hojas de ruta (pedido de Gonzalo, 2026-11-04: «el mapa debe tener vistas
 * nacionales porque ya estamos integrando estudios representativos a nivel nacional»). Territorio ya
 * tiene su atlas; esto es para las secciones que trabajan lo ya elegido. Con distritos en dos o más
 * ciudades, el mapa abre en el Perú (los departamentos del estudio, una marca por ciudad con la cifra de
 * la sección), baja a una ciudad por el param `ciudad` y a un distrito por su ficha.
 */

export const SECCIONES_NACIONALES = ["poblacion", "muestra", "manzanas", "seleccion"] as const;
export type SeccionNacional = (typeof SECCIONES_NACIONALES)[number];
export const esSeccionNacional = (s: string | null | undefined): s is SeccionNacional => (SECCIONES_NACIONALES as readonly string[]).includes(s ?? "");

export type NivelMapa =
  | { nivel: "nacional" }
  | { nivel: "ciudad"; ciudad: string }
  | { nivel: "distrito"; ciudad: string; distrito: string };

/** Las ciudades con distritos confirmados, en el orden del atlas (de mayor a menor población). */
export function ciudadesConDistritos(confirmados: readonly string[], atlas: readonly Pick<CiudadAtlas, "codigo">[]): string[] {
  const propias = new Set(confirmados.map(ciudadDeUbigeo).filter((c): c is string => Boolean(c)));
  return atlas.map((c) => c.codigo).filter((c) => propias.has(c));
}

/**
 * El nivel del mapa, o `null` si no hay vista nacional (otra sección, o el estudio vive en una sola
 * ciudad: ahí el mapa es el de siempre). Una `ciudad` que no tiene distritos en el estudio —enlace viejo,
 * o se quitó en Territorio— cae al Perú en vez de encuadrar el vacío. El distrito es el enfocado si es
 * del estudio y de esa ciudad.
 */
export function nivelDelMapa(opts: {
  seccion: string | null | undefined;
  ciudades: readonly string[];
  ciudad: string | null;
  distrito: string | null;
  confirmados: readonly string[];
}): NivelMapa | null {
  const { seccion, ciudades, ciudad, distrito, confirmados } = opts;
  if (!esSeccionNacional(seccion) || ciudades.length < 2) return null;
  if (!ciudad || !ciudades.includes(ciudad)) return { nivel: "nacional" };
  if (distrito && confirmados.includes(distrito) && ciudadDeUbigeo(distrito) === ciudad) return { nivel: "distrito", ciudad, distrito };
  return { nivel: "ciudad", ciudad };
}

/** Los departamentos (claves sin tilde) de las ciudades del estudio: Lima y Callao abarca dos. */
export function departamentosDelEstudio(atlas: readonly CiudadAtlas[], ciudades: readonly string[]): string[] {
  return [...new Set(atlas.filter((c) => ciudades.includes(c.codigo)).flatMap(departamentosDeCiudad))];
}

/**
 * Encuadre del nivel nacional: los departamentos del estudio con sus ciudades dentro, no el Perú entero
 * (un estudio de Lima, Arequipa y Trujillo no necesita Loreto en cuadro). Sin límites, las ciudades.
 */
export function cajaNacional(atlas: readonly CiudadAtlas[], departamentos: readonly LimiteNombrado[], ciudades: readonly string[]): Caja | null {
  const deps = new Set(departamentosDelEstudio(atlas, ciudades));
  const cajas = [
    ...departamentos.filter((d) => deps.has(claveNombre(d.nombre))).map((d) => d.caja),
    ...atlas.filter((c) => ciudades.includes(c.codigo)).map((c) => c.caja),
  ];
  return unirCajas(cajas);
}

export type CifraCiudad = { codigo: string; nombre: string; cifra: string; detalle: string };

const enMiles = (n: number) => (n >= 1e6 ? `${formatoDecimal(n / 1e6, 1)} M` : n >= 1e3 ? `${formatoConteo(Math.round(n / 1000))} mil` : formatoConteo(n));
const plural = (n: number, uno: string, varios: string) => `${formatoConteo(n)} ${n === 1 ? uno : varios}`;

/**
 * La cifra de cada ciudad en su marca, la que importa en la sección: población en Población, entrevistas
 * en Muestra, UMP titulares en Manzanas y Selección. Sin el dato (antes de calcular o sortear) la marca
 * dice cuántos distritos tiene y por qué falta la cifra, nunca un cero que no es conteo.
 */
export function cifrasPorCiudad(
  seccion: SeccionNacional,
  ciudades: readonly CiudadAtlas[],
  datos: {
    confirmados: readonly string[];
    territorios: readonly Pick<HojasRutaTerritory, "ubigeo" | "poblacion">[];
    /** Población objetivo por distrito (matriz vigente), o vacío. */
    objetivoPorUbigeo?: Readonly<Record<string, number>>;
    /** Entrevistas por distrito del tamaño vigente, o vacío. */
    entrevistasPorUbigeo?: ReadonlyMap<string, number>;
    titulares?: readonly Pick<SelectedBlock, "ubigeo">[];
  },
): CifraCiudad[] {
  return ciudades.map((c) => {
    const propios = datos.confirmados.filter((u) => ciudadDeUbigeo(u) === c.codigo);
    const set = new Set(propios);
    const distritos = plural(propios.length, "distrito", "distritos");
    const suma = (f: (u: string) => number | undefined) => propios.reduce((a, u) => a + (f(u) ?? 0), 0);
    const tieneAlguno = (f: (u: string) => number | undefined) => propios.some((u) => typeof f(u) === "number");
    let cifra = distritos;
    let detalle = "";
    if (seccion === "poblacion") {
      const objetivo = datos.objetivoPorUbigeo ?? {};
      if (tieneAlguno((u) => objetivo[u])) {
        cifra = `${enMiles(suma((u) => objetivo[u]))} objetivo`;
        detalle = distritos;
      } else {
        const hab = datos.territorios.filter((t) => set.has(t.ubigeo)).reduce((a, t) => a + t.poblacion, 0);
        cifra = `${enMiles(hab)} hab.`;
        detalle = distritos;
      }
    } else if (seccion === "muestra") {
      const m = datos.entrevistasPorUbigeo;
      if (m && tieneAlguno((u) => m.get(u))) {
        cifra = plural(suma((u) => m.get(u)), "entrevista", "entrevistas");
        detalle = distritos;
      } else detalle = "sin tamaño calculado";
    } else {
      const ts = datos.titulares ?? [];
      if (ts.length) {
        cifra = plural(ts.filter((b) => set.has(b.ubigeo)).length, "UMP", "UMP");
        detalle = distritos;
      } else detalle = "sin sorteo";
    }
    return { codigo: c.codigo, nombre: c.nombre, cifra, detalle };
  });
}
