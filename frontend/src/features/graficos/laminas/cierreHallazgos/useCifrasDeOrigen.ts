// Las cifras con clave de una lámina de origen del cierre (POST /api/graficos/resumenes/cifras, ADR 0135 §6). El efecto
// depende de la FIRMA del pedido (graficador|scope|args en JSON estable), no del objeto `args`: el inspector lo re-arma en
// cada render y, con el objeto como dependencia, efecto → estado → render → objeto nuevo → efecto sin fin (el bucle de
// useConteosMaqueta.ts). Dos filas que toman cifras de la misma lámina comparten el pedido.

import { useEffect, useMemo, useState } from "react";
import { apiGraficosCifras, type CifrasDeGrafico } from "../../../../api/graficosCifras";
import { firmaPedidoRegla } from "../reglaPreguntas/modeloReglaPreguntas";
import { mensajeDeError, pedidoDeFirma } from "../reglaPreguntas/useConteoRegla";

type Args = Readonly<Record<string, unknown>>;

export type CifrasEnVivo = {
  cifras: CifrasDeGrafico | null;
  cargando: boolean;
  error: string | null;
};

type Estado = { firma: string; cifras: CifrasDeGrafico | null; error: string | null };

const VACIO: Estado = { firma: "", cifras: null, error: null };

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

/** Sin origen no pide nada. */
export function useCifrasDeOrigen(origen: { graficador: string; args: Args } | null, scope: "active" | "consolidated"): CifrasEnVivo {
  const firma = useMemo(() => (origen ? firmaPedidoRegla(origen.graficador, origen.args, scope) : ""), [origen, scope]);
  const [estado, setEstado] = useState<Estado>(VACIO);
  useEffect(() => {
    if (!firma) return;
    const promesa = pedir(firma);
    if (!promesa) return;
    let vivo = true;
    promesa.then(
      (cifras) => { if (vivo) setEstado((prev) => (prev.firma === firma && prev.cifras === cifras ? prev : { firma, cifras, error: null })); },
      (e: unknown) => {
        if (!vivo) return;
        const { mensaje } = mensajeDeError(e);
        setEstado((prev) => (prev.firma === firma && prev.error === mensaje ? prev : { firma, cifras: null, error: mensaje }));
      },
    );
    return () => { vivo = false; };
  }, [firma]);
  const actual = !!firma && estado.firma === firma;
  return { cifras: actual ? estado.cifras : null, cargando: !!firma && !actual, error: actual ? estado.error : null };
}
