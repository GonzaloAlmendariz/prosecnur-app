// La caché de módulo del conteo de la regla (POST /api/graficos/resumenes/regla), por FIRMA del pedido
// (`firmaPedidoRegla`: graficador|scope|args en JSON estable, que incluye la regla). El inspector (ReglaPreguntas) y la
// maqueta (MaquetaLamina) piden lo mismo al abrir una lámina: con la caché comparten un único pedido.
//
// - Un pedido en vuelo se comparte: el segundo que lo pide se suma a los que esperan, no pide otra vez.
// - Se aborta sólo cuando lo sueltan TODOS los que esperaban (cambio de regla en el arrastre, lámina cerrada).
// - Una respuesta se reutiliza durante `VIGENCIA_CONTEO_MS`: la firma no lleva la base activa ni los datos, así que un
//   conteo viejo no se presta para siempre. Un error no se guarda: el próximo que lo pida vuelve a intentar.

import { apiGraficosConteoRegla, type ConteoRegla } from "../../../../api/graficosRegla";
import { pedidoDeFirma } from "./pedidoDeFirma";

export const VIGENCIA_CONTEO_MS = 30_000;
const MAX_ENTRADAS = 64;

export type ResultadoConteo = { conteo: ConteoRegla; error: null } | { conteo: null; error: unknown };

type EnVuelo = { control: AbortController; esperan: Set<(r: ResultadoConteo) => void> };
type Listo = { conteo: ConteoRegla; en: number };

const listos = new Map<string, Listo>();
const enVuelo = new Map<string, EnVuelo>();

/** El conteo ya recibido y vigente de esa firma; `null` si no hay. */
export function conteoEnCache(firma: string, ahora: number = Date.now()): ConteoRegla | null {
  const e = listos.get(firma);
  if (!e) return null;
  if (ahora - e.en > VIGENCIA_CONTEO_MS) { listos.delete(firma); return null; }
  return e.conteo;
}

function guardar(firma: string, conteo: ConteoRegla) {
  listos.delete(firma);
  listos.set(firma, { conteo, en: Date.now() });
  while (listos.size > MAX_ENTRADAS) {
    const primera = listos.keys().next().value;
    if (primera === undefined) break;
    listos.delete(primera);
  }
}

/**
 * Pide el conteo de la firma (o se suma al pedido en vuelo) y avisa a `alResolver` una vez. Con el conteo en caché,
 * avisa en la microtarea siguiente sin pedir. Devuelve la función que suelta el pedido: soltado por todos antes de
 * responder, se aborta. Una firma ilegible no pide nada.
 */
export function pedirConteoRegla(firma: string, alResolver: (r: ResultadoConteo) => void): () => void {
  const enCache = conteoEnCache(firma);
  if (enCache) {
    let vivo = true;
    void Promise.resolve().then(() => { if (vivo) alResolver({ conteo: enCache, error: null }); });
    return () => { vivo = false; };
  }
  const pedido = pedidoDeFirma(firma);
  if (!pedido) return () => undefined;
  let vuelo = enVuelo.get(firma);
  if (!vuelo) {
    const nuevo: EnVuelo = { control: new AbortController(), esperan: new Set() };
    vuelo = nuevo;
    enVuelo.set(firma, nuevo);
    apiGraficosConteoRegla(
      { graficador: pedido.graficador, args: pedido.args, ...(pedido.scope === "consolidated" ? { scope: "consolidated" as const } : {}) },
      { signal: nuevo.control.signal },
    ).then((conteo) => {
      if (enVuelo.get(firma) === nuevo) enVuelo.delete(firma);
      guardar(firma, conteo);
      for (const f of nuevo.esperan) f({ conteo, error: null });
    }, (error: unknown) => {
      if (enVuelo.get(firma) === nuevo) enVuelo.delete(firma);
      if (nuevo.control.signal.aborted) return;
      for (const f of nuevo.esperan) f({ conteo: null, error });
    });
  }
  const propio = vuelo;
  propio.esperan.add(alResolver);
  return () => {
    propio.esperan.delete(alResolver);
    if (propio.esperan.size === 0 && enVuelo.get(firma) === propio) {
      enVuelo.delete(firma);
      propio.control.abort();
    }
  };
}

/** Vacía la caché (tests; también sirve si algún día la base cambia por fuera). */
export function olvidarConteosRegla() {
  listos.clear();
  for (const v of enVuelo.values()) v.control.abort();
  enVuelo.clear();
}
