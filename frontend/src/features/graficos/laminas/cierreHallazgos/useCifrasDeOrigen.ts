// Las cifras con clave de las láminas de origen del cierre (POST /api/graficos/resumenes/cifras, ADR 0135 §6): las que
// usan sus filas y, con «Elegir cifra» abierto, todas las del informe. El efecto depende de las FIRMAS de los pedidos
// (graficador|scope|args en JSON estable), no de los objetos `args`: el inspector los re-arma en cada render y, con el
// objeto como dependencia, efecto → estado → render → objeto nuevo → efecto sin fin (el bucle de useConteosMaqueta.ts).
// Dos filas que toman cifras de la misma lámina comparten el pedido.

import { useEffect, useState } from "react";
import { apiGraficosCifras, type CifrasDeGrafico } from "../../../../api/graficosCifras";
import { firmaPedidoRegla } from "../reglaPreguntas/modeloReglaPreguntas";
import { mensajeDeError, pedidoDeFirma } from "../reglaPreguntas/useConteoRegla";

type Args = Readonly<Record<string, unknown>>;

export type CifrasEnVivo = {
  cifras: CifrasDeGrafico | null;
  cargando: boolean;
  error: string | null;
};

type Leido = { cifras: CifrasDeGrafico | null; error: string | null };

// Pedidos en curso o resueltos por firma; acotado para no crecer con cada cambio de args.
const EN_VUELO = new Map<string, Promise<CifrasDeGrafico>>();
const TOPE_EN_VUELO = 24;

function pedir(firma: string): Promise<CifrasDeGrafico> | null {
  const previo = EN_VUELO.get(firma);
  if (previo) return previo;
  const pedido = pedidoDeFirma(firma);
  if (!pedido) return null;
  const promesa = apiGraficosCifras({
    graficador: pedido.graficador, args: pedido.args, ...(pedido.scope === "consolidated" ? { scope: "consolidated" as const } : {}),
  });
  promesa.catch(() => EN_VUELO.delete(firma));
  if (EN_VUELO.size >= TOPE_EN_VUELO) {
    const primera = EN_VUELO.keys().next().value;
    if (primera !== undefined) EN_VUELO.delete(primera);
  }
  EN_VUELO.set(firma, promesa);
  return promesa;
}

type Origen = { id: string; graficador: string; args: Args };

const CARGANDO: CifrasEnVivo = { cifras: null, cargando: true, error: null };

/** Las cifras de cada origen, por su id. Un origen todavía sin respuesta sale `cargando`. */
export function useCifrasDeOrigenes(origenes: readonly Origen[], scope: "active" | "consolidated"): Readonly<Record<string, CifrasEnVivo>> {
  const firmas = origenes.map((o) => [o.id, firmaPedidoRegla(o.graficador, o.args, scope)] as const);
  const clave = JSON.stringify([...new Set(firmas.map(([, f]) => f))].sort());
  const [leidos, setLeidos] = useState<Readonly<Record<string, Leido>>>({});
  useEffect(() => {
    let vivo = true;
    for (const firma of JSON.parse(clave) as string[]) {
      const promesa = pedir(firma);
      if (!promesa) continue;
      promesa.then(
        (cifras) => { if (vivo) setLeidos((prev) => (prev[firma]?.cifras === cifras ? prev : { ...prev, [firma]: { cifras, error: null } })); },
        (e: unknown) => {
          if (!vivo) return;
          const { mensaje } = mensajeDeError(e);
          setLeidos((prev) => (prev[firma]?.error === mensaje ? prev : { ...prev, [firma]: { cifras: null, error: mensaje } }));
        },
      );
    }
    return () => { vivo = false; };
  }, [clave]);
  const out: Record<string, CifrasEnVivo> = {};
  for (const [id, firma] of firmas) {
    const l = leidos[firma];
    out[id] = l ? { cifras: l.cifras, cargando: false, error: l.error } : CARGANDO;
  }
  return out;
}
