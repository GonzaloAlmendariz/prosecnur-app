import { alcanzaManzana, type SupuestosVisitas } from "./visitas";
import type { SelectedBlock } from "../../../api/hojasRuta";

// Revisión contra el marco: cada UMP sorteada cruzada con las viviendas
// censales de su manzana. No cambia la muestra ni bloquea la entrega; dice lo
// que conviene mirar antes de imprimir. Con datos reales de acnur_acg (Ate) salen
// un reemplazo con 0 viviendas, uno con 4 viviendas para 8 entrevistas y una
// titular con 1.071 viviendas: nada de eso se veía en Titulares ni Reemplazos.

export type TonoRevision = "error" | "aviso" | "info";

export type TipoObservacion =
  | "titular-sin-viviendas"
  | "reemplazo-sin-viviendas"
  | "titular-corta"
  | "reemplazo-corto"
  | "titular-sin-margen"
  | "titular-atipica"
  | "titular-sin-reemplazo";

export type UmpObservada = {
  idManzana: string;
  codigo: string;
  distrito: string;
  zona: string;
  viviendas: number;
  entrevistas: number;
  /** Para un reemplazo, la UMP titular a la que reemplaza. */
  titular?: string;
};

export type GrupoRevision = {
  tipo: TipoObservacion;
  tono: TonoRevision;
  titulo: string;
  detalle: string;
  umps: UmpObservada[];
};

export type DistritoRevision = {
  distrito: string;
  titulares: number;
  reemplazos: number;
  observaciones: number;
  errores: number;
};

export type RevisionMarco = {
  grupos: GrupoRevision[];
  conteo: Record<TonoRevision, number>;
  /** UMP con al menos una observación de error o aviso: es lo que cuenta la pestaña. */
  porRevisar: number;
  distritos: DistritoRevision[];
  /** Viviendas de cada titular y de cada reemplazo, para la tira de distribución. */
  viviendasTitulares: number[];
  viviendasReemplazos: number[];
  /** Entrevistas por ruta más frecuentes: la línea de referencia de la tira. */
  entrevistasPorRuta: number;
};

/** Una manzana es atípica cuando tiene más de diez veces las viviendas de la mediana de su distrito. */
export const FACTOR_ATIPICA = 10;

const ORDEN_TONO: Record<TonoRevision, number> = { error: 0, aviso: 1, info: 2 };

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function entero(...valores: unknown[]): number {
  for (const valor of valores) {
    const n = Math.trunc(numero(valor));
    if (n > 0) return n;
  }
  return 0;
}

export function codigoDeUmp(block: SelectedBlock): string {
  if (block.tipo_manzana === "reemplazo") {
    const titular = entero(block.titular_hoja_num, block.titular_orden_seleccion);
    const orden = entero(block.replacement_order);
    if (!titular) return "R";
    return orden > 1 ? `R ${titular}.${orden}` : `R ${titular}`;
  }
  const ump = entero(block.hoja_num, block.orden_seleccion);
  return ump ? `UMP ${ump}` : "UMP";
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

function moda(valores: number[]): number {
  const cuenta = new Map<number, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor = 0;
  let veces = 0;
  for (const [v, n] of cuenta) if (n > veces || (n === veces && v > mejor)) { mejor = v; veces = n; }
  return mejor;
}

function titularDe(block: SelectedBlock, titulares: Map<string, SelectedBlock>): SelectedBlock | undefined {
  return block.titular_id_manzana ? titulares.get(block.titular_id_manzana) : undefined;
}

/**
 * Con `supuestos` (respuesta y ocupación, ADR 0116) una manzana «corta» es la que no alcanza para las
 * visitas del 90 % de las rutas; sin ellos se compara con las entrevistas, como antes.
 */
export function revisarSeleccion(titulares: readonly SelectedBlock[], reemplazos: readonly SelectedBlock[], supuestos?: SupuestosVisitas): RevisionMarco {
  const corta = (viv: number, ent: number) => (supuestos ? !alcanzaManzana(viv, ent, supuestos) : viv < ent);
  const porId = new Map(titulares.map((b) => [b.id_manzana, b]));
  const medianaPorDistrito = new Map<string, number>();
  const agrupado = new Map<string, number[]>();
  for (const b of titulares) {
    const lista = agrupado.get(b.ubigeo) ?? [];
    lista.push(numero(b.viviendas));
    agrupado.set(b.ubigeo, lista);
  }
  for (const [ubigeo, lista] of agrupado) medianaPorDistrito.set(ubigeo, mediana(lista));

  const ump = (b: SelectedBlock, entrevistas?: number, titular?: SelectedBlock): UmpObservada => ({
    idManzana: b.id_manzana,
    codigo: codigoDeUmp(b),
    distrito: b.distrito,
    zona: b.zona,
    viviendas: numero(b.viviendas),
    entrevistas: entrevistas ?? numero(b.entrevistas),
    titular: titular ? codigoDeUmp(titular) : undefined,
  });

  const grupos = new Map<TipoObservacion, UmpObservada[]>();
  const agregar = (tipo: TipoObservacion, item: UmpObservada) => {
    const lista = grupos.get(tipo) ?? [];
    lista.push(item);
    grupos.set(tipo, lista);
  };

  const conReemplazo = new Set(reemplazos.map((r) => r.titular_id_manzana).filter(Boolean));
  for (const b of titulares) {
    const viv = numero(b.viviendas);
    const ent = numero(b.entrevistas);
    if (viv === 0) agregar("titular-sin-viviendas", ump(b));
    else if (corta(viv, ent)) agregar("titular-corta", ump(b));
    else if (!supuestos && viv === ent) agregar("titular-sin-margen", ump(b));
    const med = medianaPorDistrito.get(b.ubigeo) ?? 0;
    if (med > 0 && viv > FACTOR_ATIPICA * med) agregar("titular-atipica", ump(b));
    if (reemplazos.length && !conReemplazo.has(b.id_manzana)) agregar("titular-sin-reemplazo", ump(b));
  }
  for (const r of reemplazos) {
    const titular = titularDe(r, porId);
    const ent = numero(titular?.entrevistas ?? r.entrevistas);
    const viv = numero(r.viviendas);
    if (viv === 0) agregar("reemplazo-sin-viviendas", ump(r, ent, titular));
    else if (corta(viv, ent)) agregar("reemplazo-corto", ump(r, ent, titular));
  }

  const DEF: Record<TipoObservacion, { tono: TonoRevision; titulo: (n: number) => string; detalle: string }> = {
    "titular-sin-viviendas": { tono: "error", titulo: (n) => n === 1 ? "1 UMP titular no tiene viviendas" : `${n} UMP titulares no tienen viviendas`, detalle: "La manzana figura con 0 viviendas en el censo: el equipo llegaría a un lugar sin hogares." },
    "reemplazo-sin-viviendas": { tono: "error", titulo: (n) => n === 1 ? "1 reemplazo no tiene viviendas" : `${n} reemplazos no tienen viviendas`, detalle: "Si la titular no completa, el reemplazo lleva al equipo a una manzana sin hogares." },
    // ADR 0116: al agotar la manzana no se sigue por las vecinas; se pasa al reemplazo pareado.
    "titular-corta": supuestos
      ? { tono: "aviso", titulo: (n) => n === 1 ? "1 UMP no alcanza para sus visitas" : `${n} UMP no alcanzan para sus visitas`, detalle: `Con la respuesta y la ocupación supuestas, la manzana se agota antes de completar la ruta: el equipo pasará al reemplazo.` }
      : { tono: "aviso", titulo: (n) => n === 1 ? "1 UMP tiene menos viviendas que entrevistas" : `${n} UMP tienen menos viviendas que entrevistas`, detalle: "La manzana se agota antes de completar la ruta: el equipo pasará al reemplazo." },
    "reemplazo-corto": supuestos
      ? { tono: "aviso", titulo: (n) => n === 1 ? "1 reemplazo no alcanza para sus visitas" : `${n} reemplazos no alcanzan para sus visitas`, detalle: "Si se activa, el reemplazo también se agotaría antes de completar la ruta." }
      : { tono: "aviso", titulo: (n) => n === 1 ? "1 reemplazo tiene menos viviendas que entrevistas" : `${n} reemplazos tienen menos viviendas que entrevistas`, detalle: "Si se activa, el reemplazo también se agotaría antes de completar la ruta." },
    "titular-sin-margen": { tono: "aviso", titulo: (n) => n === 1 ? "1 UMP tiene tantas viviendas como entrevistas" : `${n} UMP tienen tantas viviendas como entrevistas`, detalle: "No queda margen para rechazos ni viviendas desocupadas dentro de la manzana." },
    "titular-atipica": { tono: "info", titulo: (n) => n === 1 ? "1 UMP es atípica por su tamaño" : `${n} UMP son atípicas por su tamaño`, detalle: `Tienen más de ${FACTOR_ATIPICA} veces las viviendas de la mediana de su distrito. El PPS las favorece; conviene fijar por dónde empieza la ruta.` },
    "titular-sin-reemplazo": { tono: "aviso", titulo: (n) => n === 1 ? "1 UMP no tiene reemplazo" : `${n} UMP no tienen reemplazo`, detalle: "Si la titular no completa, no hay manzana prevista para seguir." },
  };

  const lista: GrupoRevision[] = [...grupos.entries()]
    .map(([tipo, umps]) => ({ tipo, tono: DEF[tipo].tono, titulo: DEF[tipo].titulo(umps.length), detalle: DEF[tipo].detalle, umps }))
    .sort((a, b) => ORDEN_TONO[a.tono] - ORDEN_TONO[b.tono] || b.umps.length - a.umps.length);

  const conteo: Record<TonoRevision, number> = { error: 0, aviso: 0, info: 0 };
  for (const g of lista) conteo[g.tono] += g.umps.length;

  const marcadas = new Set<string>();
  for (const g of lista) if (g.tono !== "info") for (const u of g.umps) marcadas.add(u.idManzana);

  const distritos = new Map<string, DistritoRevision>();
  const fila = (nombre: string) => {
    const actual = distritos.get(nombre) ?? { distrito: nombre, titulares: 0, reemplazos: 0, observaciones: 0, errores: 0 };
    distritos.set(nombre, actual);
    return actual;
  };
  for (const b of titulares) fila(b.distrito).titulares += 1;
  for (const r of reemplazos) fila(r.distrito).reemplazos += 1;
  for (const g of lista) for (const u of g.umps) {
    const d = fila(u.distrito);
    d.observaciones += 1;
    if (g.tono === "error") d.errores += 1;
  }

  return {
    grupos: lista,
    conteo,
    porRevisar: marcadas.size,
    distritos: [...distritos.values()].sort((a, b) => b.errores - a.errores || b.observaciones - a.observaciones || a.distrito.localeCompare(b.distrito, "es")),
    viviendasTitulares: titulares.map((b) => numero(b.viviendas)),
    viviendasReemplazos: reemplazos.map((r) => numero(r.viviendas)),
    entrevistasPorRuta: moda(titulares.map((b) => numero(b.entrevistas))) || 0,
  };
}
