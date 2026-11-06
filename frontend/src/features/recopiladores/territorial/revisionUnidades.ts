// revisionUnidades.ts — el estado de cada UMP de la campaña territorial con el MISMO
// criterio que la revisión contra el marco de Hojas de ruta › Selección (checklist M4):
// las unidades de la foto se llevan a la forma de bloque que espera `revisarSeleccion`.

import type { SelectedBlock } from "../../../api/hojasRuta";
import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import { revisarSeleccion, type TipoObservacion } from "../../hojasRuta/seleccion/revisionMarco";
import type { SupuestosVisitas } from "../../hojasRuta/seleccion/visitas";
import { estadosPorTitular, type EstadoRuta } from "../../hojasRuta/mapa/seleccion/rutas";

export type EstadoUnidad = { tono: EstadoRuta; motivo: string | null };
export type ResumenDistrito = { clave: string; distrito: string; titulares: number; reemplazos: number; porRevisar: number };

const MOTIVO: Record<TipoObservacion, string> = {
  "titular-sin-viviendas": "sin viviendas",
  "reemplazo-sin-viviendas": "sin viviendas",
  "titular-corta": "no alcanza",
  "reemplazo-corto": "no alcanza",
  "titular-sin-margen": "sin margen",
  "titular-atipica": "muy grande",
  "titular-sin-reemplazo": "sin reemplazo",
};
const PESO: Record<EstadoRuta, number> = { ok: 0, info: 1, aviso: 2, error: 3 };

function comoBloque(u: UnidadTerritorial): SelectedBlock {
  const entrevistas = u.rango_inicio !== null && u.rango_fin !== null ? u.rango_fin - u.rango_inicio + 1 : 0;
  return {
    id_manzana: u.unit_id, ubigeo: u.ubigeo, distrito: u.distrito, zona: u.zona, manzana: u.manzana,
    viviendas: u.viviendas ?? 0, entrevistas, tipo_manzana: u.role, titular_id_manzana: u.titular_id ?? undefined,
  } as unknown as SelectedBlock;
}

/** Estado de cada unidad (por `unit_id`) y, por distrito, cuántas rutas hay que revisar. */
export function revisarUnidades(units: readonly UnidadTerritorial[], supuestos?: SupuestosVisitas): { porUnidad: Map<string, EstadoUnidad>; distritos: ResumenDistrito[]; rutasPorRevisar: Set<string> } {
  const titulares = units.filter((u) => u.role === "titular").map(comoBloque);
  const reemplazos = units.filter((u) => u.role === "reemplazo").map(comoBloque);
  const revision = revisarSeleccion(titulares, reemplazos, supuestos);
  const porUnidad = new Map<string, EstadoUnidad>();
  for (const g of revision.grupos) {
    for (const u of g.umps) {
      const previo = porUnidad.get(u.idManzana);
      if (!previo || PESO[g.tono] > PESO[previo.tono]) porUnidad.set(u.idManzana, { tono: g.tono, motivo: MOTIVO[g.tipo] ?? null });
    }
  }
  // Una ruta está «por revisar» si su titular o alguno de sus reemplazos tiene aviso o error (como Selección).
  const porRuta = estadosPorTitular(titulares, reemplazos, revision);
  const distritos = new Map<string, ResumenDistrito>();
  const rutasPorRevisar = new Set<string>();
  for (const u of units) {
    const clave = u.ubigeo || u.distrito || "—";
    const d = distritos.get(clave) ?? { clave, distrito: u.distrito, titulares: 0, reemplazos: 0, porRevisar: 0 };
    if (u.role === "titular") {
      d.titulares += 1;
      const e = porRuta.get(u.unit_id) ?? "ok";
      if (e === "aviso" || e === "error") {
        d.porRevisar += 1;
        rutasPorRevisar.add(u.unit_id);
      }
    } else d.reemplazos += 1;
    distritos.set(clave, d);
  }
  return { porUnidad, distritos: [...distritos.values()], rutasPorRevisar };
}
