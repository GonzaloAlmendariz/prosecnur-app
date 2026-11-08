// La caché de módulo del detalle de cifras (POST /api/graficos/resumenes/cifras con `detalle: true`), por FIRMA del
// pedido (graficador|scope|args en JSON estable|caja). Mismo patrón que cacheConteoRegla.ts: varios controles del
// inspector piden el detalle de los mismos args (Excluir, Orden, Destacar y Redondeo piden el actual) y comparten un
// único pedido.
//
// - Las firmas que faltan van en UN pedido de lote (apiGraficosCifrasDetalleLote): Plumber atiende en serie.
// - Una firma en vuelo se comparte: quien la pide se suma a los que esperan.
// - Un lote se aborta sólo cuando TODAS sus firmas quedaron sin nadie que las espere.
// - Una respuesta se reutiliza durante `VIGENCIA_DETALLE_MS`; un error no se guarda (el próximo vuelve a intentar).
// - `detalle: null` sí se guarda: la lámina no lo publica con esos args y volver a pedirlo daría lo mismo.

import { apiGraficosCifrasDetalleLote, errorDeEntrada, type DetalleCifras } from "../../../../api/graficosCifras";
import { jsonEstable } from "../reglaPreguntas/modeloReglaPreguntas";

export const VIGENCIA_DETALLE_MS = 30_000;
const MAX_ENTRADAS = 96;

type Args = Readonly<Record<string, unknown>>;

export type PedidoDetalle = {
  graficador: string;
  scope: "active" | "consolidated";
  args: Args;
  /** Las categorías cuya suma rotulada se pide (la caja del Top Two Box). */
  caja?: readonly string[];
};

export type ResultadoDetalle = { detalle: DetalleCifras | null; error: unknown };

/** La firma del pedido: un texto, para que los efectos dependan de él y no del objeto `args` que se re-arma. */
export function firmaDetalle(p: PedidoDetalle): string {
  return `${p.graficador}|${p.scope}|${jsonEstable(p.args)}|${jsonEstable([...(p.caja ?? [])])}`;
}

type Lote = { control: AbortController; firmas: Set<string> };
type EnVuelo = { lote: Lote; esperan: Set<(r: ResultadoDetalle) => void> };
type Listo = { detalle: DetalleCifras | null; en: number };

const listos = new Map<string, Listo>();
const enVuelo = new Map<string, EnVuelo>();

/** El detalle vigente de esa firma: `undefined` si no hay; `null` si la lámina no lo publica. */
export function detalleEnCache(firma: string, ahora: number = Date.now()): DetalleCifras | null | undefined {
  const e = listos.get(firma);
  if (!e) return undefined;
  if (ahora - e.en > VIGENCIA_DETALLE_MS) { listos.delete(firma); return undefined; }
  return e.detalle;
}

function guardar(firma: string, detalle: DetalleCifras | null) {
  listos.delete(firma);
  listos.set(firma, { detalle, en: Date.now() });
  while (listos.size > MAX_ENTRADAS) {
    const primera = listos.keys().next().value;
    if (primera === undefined) break;
    listos.delete(primera);
  }
}

function lanzar(scope: "active" | "consolidated", faltan: readonly { firma: string; pedido: PedidoDetalle }[]) {
  const lote: Lote = { control: new AbortController(), firmas: new Set(faltan.map((f) => f.firma)) };
  const propios = faltan.map((f) => {
    const vuelo: EnVuelo = { lote, esperan: new Set() };
    enVuelo.set(f.firma, vuelo);
    return vuelo;
  });
  const soltarDelMapa = (firma: string, vuelo: EnVuelo) => { if (enVuelo.get(firma) === vuelo) enVuelo.delete(firma); };
  apiGraficosCifrasDetalleLote({
    laminas: faltan.map((f, i) => ({ id: `d${i}`, graficador: f.pedido.graficador, args: f.pedido.args, caja: f.pedido.caja })),
    ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
  }, { signal: lote.control.signal }).then((por) => {
    faltan.forEach((f, i) => {
      const vuelo = propios[i];
      soltarDelMapa(f.firma, vuelo);
      const entrada = por[`d${i}`];
      const error = errorDeEntrada(entrada);
      if (!error && entrada) guardar(f.firma, entrada.detalle);
      for (const cb of vuelo.esperan) cb(error || !entrada ? { detalle: null, error } : { detalle: entrada.detalle, error: null });
    });
  }, (error: unknown) => {
    faltan.forEach((f, i) => soltarDelMapa(f.firma, propios[i]));
    if (lote.control.signal.aborted) return;
    for (const vuelo of propios) for (const cb of vuelo.esperan) cb({ detalle: null, error });
  });
}

/**
 * Pide el detalle de cada firma (o se suma a las que ya están en vuelo) y avisa a `alResolver` una vez por firma. Las
 * que están en caché avisan en la microtarea siguiente. Devuelve la función que suelta lo pedido.
 */
export function pedirDetalles(
  pedidos: readonly { firma: string; pedido: PedidoDetalle }[],
  alResolver: (firma: string, r: ResultadoDetalle) => void,
): () => void {
  let vivo = true;
  const unicos = new Map(pedidos.map((p) => [p.firma, p.pedido]));
  const enCache: [string, DetalleCifras | null][] = [];
  const faltan = new Map<string, { firma: string; pedido: PedidoDetalle }[]>();
  for (const [firma, pedido] of unicos) {
    const c = detalleEnCache(firma);
    if (c !== undefined) { enCache.push([firma, c]); continue; }
    if (enVuelo.has(firma)) continue;
    faltan.set(pedido.scope, [...(faltan.get(pedido.scope) ?? []), { firma, pedido }]);
  }
  if (enCache.length) void Promise.resolve().then(() => { if (vivo) for (const [f, d] of enCache) alResolver(f, { detalle: d, error: null }); });
  for (const [scope, lista] of faltan) lanzar(scope as "active" | "consolidated", lista);
  const suscritos: [string, EnVuelo, (r: ResultadoDetalle) => void][] = [];
  for (const firma of unicos.keys()) {
    const vuelo = enVuelo.get(firma);
    if (!vuelo) continue;
    const cb = (r: ResultadoDetalle) => { if (vivo) alResolver(firma, r); };
    vuelo.esperan.add(cb);
    suscritos.push([firma, vuelo, cb]);
  }
  return () => {
    vivo = false;
    const lotes = new Set<Lote>();
    for (const [, vuelo, cb] of suscritos) { vuelo.esperan.delete(cb); lotes.add(vuelo.lote); }
    for (const lote of lotes) {
      const vuelos = [...lote.firmas].map((f) => [f, enVuelo.get(f)] as const).filter(([, v]) => v?.lote === lote);
      if (vuelos.some(([, v]) => (v?.esperan.size ?? 0) > 0)) continue;
      for (const [f] of vuelos) enVuelo.delete(f);
      lote.control.abort();
    }
  };
}

/** Vacía la caché y aborta lo que estaba en vuelo. */
export function olvidarDetalles() {
  listos.clear();
  const lotes = new Set([...enVuelo.values()].map((v) => v.lote));
  enVuelo.clear();
  for (const l of lotes) l.control.abort();
}

/** La firma no lleva la sesión, el proyecto ni los datos: estos eventos vacían la caché (H6 de cacheConteoRegla). */
export const EVENTOS_QUE_OLVIDAN_DETALLE = ["pulso:session-changed", "pulso:project-closed", "pulso:analitica-source-changed"] as const;

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  for (const evento of EVENTOS_QUE_OLVIDAN_DETALLE) window.addEventListener(evento, olvidarDetalles);
}
