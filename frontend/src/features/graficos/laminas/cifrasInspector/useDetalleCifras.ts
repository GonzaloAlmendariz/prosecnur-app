// El detalle de cifras de varias variantes de un mismo gráfico (el actual, el de antes, el de lo que se está sondeando)
// para que cada control del inspector muestre su efecto. Se pide con espera (ESPERA_DETALLE_MS), en UN lote por cambio,
// y se cancela al cambiar o desmontar (cacheDetalle.ts). Mientras llega lo nuevo, cada variante conserva lo último que
// tuvo y lo marca `vigente: false`: el control lo muestra atenuado y nunca se bloquea. El efecto depende de las FIRMAS,
// no de los objetos `args` (la tarjeta los re-arma en cada render; el bucle de useConteosMaqueta.ts).

import { useEffect, useRef, useState } from "react";
import type { DetalleCifras } from "../../../../api/graficosCifras";
import { usePlanStore } from "../../store";
import { presetDelGraficador } from "../reglaPreguntas/modeloReglaPreguntas";
import { detalleEnCache, firmaDetalle, pedirDetalles, type PedidoDetalle } from "./cacheDetalle";
import { conDetalle } from "./modeloCifras";

export const ESPERA_DETALLE_MS = 250;

type Args = Readonly<Record<string, unknown>>;

export type VarianteDetalle = { clave: string; args: Args; caja?: readonly string[] };

export type EstadoDetalle = {
  /** Lo último que se supo de esa variante; `null` si aún nada o si la lámina no publica detalle. */
  detalle: DetalleCifras | null;
  /** `detalle` corresponde a los args actuales de la variante. */
  vigente: boolean;
  /** Llegó la respuesta y no hay detalle (null o error): el control queda sin cifra. */
  sinDetalle: boolean;
};

const SIN: EstadoDetalle = { detalle: null, vigente: true, sinDetalle: true };

export function useDetalleCifras(
  graficador: string,
  scope: "active" | "consolidated",
  variantes: readonly VarianteDetalle[],
): Readonly<Record<string, EstadoDetalle>> {
  const activo = conDetalle(graficador);
  // El preset del tipo, con selector: cambiarlo da firmas nuevas (y no se lee `getState()`, que los tests simulan sin él).
  const presets = usePlanStore((s) => s.presets);
  const preset = presetDelGraficador(graficador, presets ?? {});
  const firmas = variantes.map((v) => {
    const pedido: PedidoDetalle = { graficador, scope, args: v.args, ...(v.caja && v.caja.length ? { caja: v.caja } : {}) };
    return { clave: v.clave, firma: firmaDetalle(pedido, preset), pedido };
  });
  const clave = activo ? firmas.map((f) => f.firma).sort().join("\n") : "";
  // El pedido de cada firma: el efecto lo lee de aquí y depende sólo de la clave (un texto).
  const porFirma = useRef(new Map<string, PedidoDetalle>());
  porFirma.current = new Map(firmas.map((f) => [f.firma, f.pedido]));
  const [leidos, setLeidos] = useState<Readonly<Record<string, DetalleCifras | null>>>({});
  const ultimo = useRef<Record<string, DetalleCifras | null>>({});

  useEffect(() => {
    if (!clave) return;
    // Lo que ya está en caché también se suscribe (sin espera): así queda en `leidos` aunque la caché venza después.
    const todas = [...porFirma.current];
    const faltan = todas.some(([f]) => detalleEnCache(f) === undefined);
    let soltar: (() => void) | null = null;
    const espera = setTimeout(() => {
      soltar = pedirDetalles(todas.map(([firma, pedido]) => ({ firma, pedido })), (firma, r) => {
        setLeidos((prev) => (firma in prev && prev[firma] === r.detalle ? prev : { ...prev, [firma]: r.detalle }));
      });
    }, faltan ? ESPERA_DETALLE_MS : 0);
    return () => { clearTimeout(espera); soltar?.(); };
  }, [clave]);

  if (!activo) return Object.fromEntries(variantes.map((v) => [v.clave, SIN]));
  const out: Record<string, EstadoDetalle> = {};
  for (const f of firmas) {
    const enCache = detalleEnCache(f.firma);
    const resuelto = enCache !== undefined ? enCache : f.firma in leidos ? leidos[f.firma] : undefined;
    if (resuelto !== undefined) {
      ultimo.current[f.clave] = resuelto;
      out[f.clave] = { detalle: resuelto, vigente: true, sinDetalle: resuelto === null };
    } else {
      out[f.clave] = { detalle: ultimo.current[f.clave] ?? null, vigente: false, sinDetalle: false };
    }
  }
  return out;
}
