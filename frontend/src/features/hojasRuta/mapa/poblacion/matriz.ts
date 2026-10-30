import type { HojasRutaAgeRange, PopulationPlan } from "../../../../api/hojasRuta";
import { CIUDADES } from "../territorio/ciudades";
import { firmaRangos } from "./rangos";

/**
 * Lectura de la matriz poblacional que devuelve `POST /population-preview`
 * (celdas distrito × rango × sexo). Si los rangos de la matriz no son los que
 * se están viendo (el usuario los cambió y no recalculó), la matriz no sirve:
 * se dice «sin calcular» en vez de mostrar pesos que ya no corresponden.
 */

export type FilaMatriz = { ubigeo: string; territorio: string; porRango: { H: number; M: number }[]; total: number };
export type ResumenMatriz = { vigente: boolean; pesoPorRango: number[]; total: number; porUbigeo: Record<string, number>; filas: FilaMatriz[] };

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function resumirMatriz(poblacion: PopulationPlan | null | undefined, rangos: readonly HojasRutaAgeRange[]): ResumenMatriz {
  const vacio: ResumenMatriz = { vigente: false, pesoPorRango: rangos.map(() => 0), total: 0, porUbigeo: {}, filas: [] };
  if (!poblacion?.ok) return vacio;
  const rangosMatriz = poblacion.config?.age_ranges ?? [];
  if (firmaRangos(rangosMatriz) !== firmaRangos(rangos)) return vacio;
  const indice = new Map(rangos.map((r, i) => [r.id, i]));
  const filas = new Map<string, FilaMatriz>();
  const peso = rangos.map(() => 0);
  for (const c of poblacion.cells ?? []) {
    const i = indice.get(String(c.rango_id ?? ""));
    if (i === undefined) continue;
    const ubigeo = String(c.ubigeo ?? "");
    const fila = filas.get(ubigeo) ?? { ubigeo, territorio: String(c.territorio ?? ubigeo), porRango: rangos.map(() => ({ H: 0, M: 0 })), total: 0 };
    const v = numero(c.poblacion);
    const sexo = String(c.sexo ?? "").toLowerCase().startsWith("m") ? "M" : "H";
    fila.porRango[i][sexo] += v;
    fila.total += v;
    peso[i] += v;
    filas.set(ubigeo, fila);
  }
  const lista = [...filas.values()];
  return { vigente: lista.length > 0, pesoPorRango: peso, total: peso.reduce((a, b) => a + b, 0), porUbigeo: Object.fromEntries(lista.map((f) => [f.ubigeo, f.total])), filas: lista };
}

export type AgruparFilas = "distrito" | "provincia" | "zona";

function provinciaDe(ubigeo: string): string {
  const prov = ubigeo.slice(0, 4);
  if (prov === "1501") return "Lima";
  if (prov === "0701") return "Callao";
  return CIUDADES.find((c) => c.ubigeos.includes(ubigeo))?.nombre ?? prov;
}
export type GrupoDeZona = { etiqueta: string; ubigeos: readonly string[] };

/**
 * Agrupa las filas de la matriz (brecha B29) sumando sus celdas. La población
 * INEI viene por distrito: provincia sale de los cuatro primeros dígitos del ubigeo
 * (Lima, Callao o el nombre de la ciudad principal; antes todo lo que no era 07 caía
 * en «Lima», también Arequipa: checklist del flujo del analista) y zona de las zonas
 * usuales de Lima; un distrito que no cae en ninguna va a «Otros».
 */
export function agruparFilas(filas: readonly FilaMatriz[], por: AgruparFilas, zonas: readonly GrupoDeZona[] = []): FilaMatriz[] {
  if (por === "distrito") return [...filas];
  const grupoDe = (f: FilaMatriz) =>
    por === "provincia" ? provinciaDe(f.ubigeo) : zonas.find((z) => z.ubigeos.includes(f.ubigeo))?.etiqueta ?? "Otros";
  const grupos = new Map<string, FilaMatriz>();
  for (const f of filas) {
    const clave = grupoDe(f);
    const g = grupos.get(clave) ?? { ubigeo: clave, territorio: clave, porRango: f.porRango.map(() => ({ H: 0, M: 0 })), total: 0 };
    f.porRango.forEach((c, i) => {
      g.porRango[i].H += c.H;
      g.porRango[i].M += c.M;
    });
    g.total += f.total;
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}
