import type { SelectedBlock } from "../../../../api/hojasRuta";
import type { PiezaManzana } from "../lienzo/piezas";
import { codigoDeUmp, type RevisionMarco, type TonoRevision } from "../../seleccion/revisionMarco";
import { puntoEnAnillo } from "../territorio/puntoEnDistrito";

/**
 * Selección en la página del lienzo (U9): las rutas sorteadas agrupadas por
 * distrito, cada una con el peor tono que le dio la revisión contra el marco
 * (`revisarSeleccion`), sumando lo que se observó en sus reemplazos.
 */

export type EstadoRuta = "ok" | TonoRevision;
export type FilaRuta = { id: string; codigo: string; numero: number; zona: string; viviendas: number; entrevistas: number; estado: EstadoRuta; reemplazos: number };
export type GrupoRutas = { ubigeo: string; distrito: string; filas: FilaRuta[] };

const PESO: Record<EstadoRuta, number> = { error: 3, aviso: 2, info: 1, ok: 0 };
const peor = (a: EstadoRuta, b: EstadoRuta): EstadoRuta => (PESO[b] > PESO[a] ? b : a);
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-PE");

export const porRevisar = (e: EstadoRuta) => e === "error" || e === "aviso";

/** El tono de cada titular: el suyo y el de sus reemplazos, el peor. */
export function estadosPorTitular(titulares: readonly SelectedBlock[], reemplazos: readonly SelectedBlock[], revision: RevisionMarco): Map<string, EstadoRuta> {
  const tonoDe = new Map<string, EstadoRuta>();
  for (const g of revision.grupos) for (const u of g.umps) tonoDe.set(u.idManzana, peor(tonoDe.get(u.idManzana) ?? "ok", g.tono));
  const out = new Map<string, EstadoRuta>(titulares.map((t) => [t.id_manzana, tonoDe.get(t.id_manzana) ?? "ok"]));
  for (const r of reemplazos) {
    const t = r.titular_id_manzana;
    if (t && out.has(t)) out.set(t, peor(out.get(t)!, tonoDe.get(r.id_manzana) ?? "ok"));
  }
  return out;
}

export function reemplazosDe(idTitular: string, reemplazos: readonly SelectedBlock[]): SelectedBlock[] {
  return reemplazos.filter((r) => r.titular_id_manzana === idTitular).sort((a, b) => (a.replacement_order ?? 0) - (b.replacement_order ?? 0));
}

export function rutasPorDistrito(
  titulares: readonly SelectedBlock[],
  reemplazos: readonly SelectedBlock[],
  estados: ReadonlyMap<string, EstadoRuta>,
  filtro: { soloPorRevisar: boolean; busqueda: string },
): GrupoRutas[] {
  const q = normalizar(filtro.busqueda.trim());
  const cuantos = new Map<string, number>();
  for (const r of reemplazos) if (r.titular_id_manzana) cuantos.set(r.titular_id_manzana, (cuantos.get(r.titular_id_manzana) ?? 0) + 1);
  const grupos = new Map<string, GrupoRutas>();
  for (const t of titulares) {
    const estado = estados.get(t.id_manzana) ?? "ok";
    if (filtro.soloPorRevisar && !porRevisar(estado)) continue;
    const codigo = codigoDeUmp(t);
    if (q && !normalizar(`${codigo} ${t.zona} ${t.id_manzana} ${t.distrito}`).includes(q)) continue;
    const g = grupos.get(t.ubigeo) ?? { ubigeo: t.ubigeo, distrito: t.distrito, filas: [] };
    g.filas.push({ id: t.id_manzana, codigo, numero: Number(t.hoja_num ?? t.orden_seleccion ?? 0), zona: t.zona, viviendas: Number(t.viviendas || 0), entrevistas: Number(t.entrevistas || 0), estado, reemplazos: cuantos.get(t.id_manzana) ?? 0 });
    grupos.set(t.ubigeo, g);
  }
  for (const g of grupos.values()) g.filas.sort((a, b) => a.numero - b.numero);
  return [...grupos.values()].sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));
}

/** La manzana (de las dadas) bajo un punto del mundo. Descarta por caja antes de mirar los anillos. */
export function manzanaEnPunto(manzanas: readonly PiezaManzana[], x: number, y: number): PiezaManzana | null {
  for (const m of manzanas) {
    if (x < m.caja[0] || x > m.caja[2] || y < m.caja[1] || y > m.caja[3]) continue;
    if (m.anillos.some((r) => puntoEnAnillo(x, y, r))) return m;
  }
  return null;
}

/** La siguiente o anterior ruta de la lista visible, para recorrerlas con el teclado. */
export function vecina(grupos: readonly GrupoRutas[], actual: string | null, paso: 1 | -1): string | null {
  const ids = grupos.flatMap((g) => g.filas.map((f) => f.id));
  if (!ids.length) return null;
  const i = actual ? ids.indexOf(actual) : -1;
  if (i < 0) return paso === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(i + paso + ids.length) % ids.length];
}
