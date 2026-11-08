// Las cifras con clave de las láminas de origen del cierre (POST /api/graficos/resumenes/cifras, ADR 0135 §6): las que
// usan sus filas y, con «Elegir cifra» abierto, todas las del informe. El efecto depende de las FIRMAS de los pedidos
// (graficador|scope|args en JSON estable), no de los objetos `args`: el inspector los re-arma en cada render y, con el
// objeto como dependencia, efecto → estado → render → objeto nuevo → efecto sin fin (el bucle de useConteosMaqueta.ts).
// Dos filas que toman cifras de la misma lámina comparten el pedido. Las firmas que faltan van en UN pedido de lote
// (apiGraficosCifrasLote): Plumber atiende en serie, así que N pedidos sueltos hacían esperar N renders seguidos. Cada
// firma conserva su promesa en `EN_VUELO`, de modo que la caché y el «Leyendo las cifras» por grupo siguen por firma.
// El pedido manda la config del editor, como `/regla` (R5-12), y la firma lleva el hash de `presets[tipo]`: el hook lee
// los presets del store, así que un cambio de preset da firmas nuevas y no sirve cifras de antes.

import { useEffect, useState } from "react";
import { apiGraficosCifrasLote, errorDeEntrada, type CifrasDeGrafico } from "../../../../api/graficosCifras";
import { buildGraficosConfigFromStore } from "../../configSnapshot";
import { usePlanStore } from "../../store";
import { firmaPedidoRegla, presetDelGraficador } from "../reglaPreguntas/modeloReglaPreguntas";
import { mensajeDeError, pedidoDeFirma } from "../reglaPreguntas/useConteoRegla";

type Args = Readonly<Record<string, unknown>>;

export type CifrasEnVivo = {
  cifras: CifrasDeGrafico | null;
  cargando: boolean;
  error: string | null;
};

type Leido = { cifras: CifrasDeGrafico | null; error: string | null };

// Pedidos en curso o resueltos por firma; acotado para no crecer con cada cambio de args. El tope cubre un informe con
// muchas láminas de resumen: una firma desalojada sólo se vuelve a pedir en la apertura siguiente.
const EN_VUELO = new Map<string, Promise<CifrasDeGrafico>>();
const TOPE_EN_VUELO = 64;

function recordar(firma: string, promesa: Promise<CifrasDeGrafico>): void {
  promesa.catch(() => EN_VUELO.delete(firma));
  if (EN_VUELO.size >= TOPE_EN_VUELO) {
    const primera = EN_VUELO.keys().next().value;
    if (primera !== undefined) EN_VUELO.delete(primera);
  }
  EN_VUELO.set(firma, promesa);
}

/** Las promesas de cada firma: las que ya estaban en vuelo, y las que faltan en un solo pedido de lote por scope. */
function pedirTodas(firmas: readonly string[]): Map<string, Promise<CifrasDeGrafico>> {
  const out = new Map<string, Promise<CifrasDeGrafico>>();
  const faltan = new Map<string, { firma: string; graficador: string; args: Args }[]>();
  for (const firma of firmas) {
    const previo = EN_VUELO.get(firma);
    if (previo) { out.set(firma, previo); continue; }
    const pedido = pedidoDeFirma(firma);
    if (!pedido) continue;
    const scope = pedido.scope === "consolidated" ? "consolidated" : "";
    faltan.set(scope, [...(faltan.get(scope) ?? []), { firma, graficador: pedido.graficador, args: pedido.args }]);
  }
  for (const [scope, laminas] of faltan) {
    const lote = apiGraficosCifrasLote({
      laminas: laminas.map((l, i) => ({ id: String(i), graficador: l.graficador, args: l.args })),
      config: buildGraficosConfigFromStore(),
      ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
    });
    laminas.forEach((l, i) => {
      const promesa = lote.then((por) => {
        const entrada = por[String(i)];
        const error = errorDeEntrada(entrada);
        if (error || !entrada) throw error;
        return entrada.cifras;
      });
      recordar(l.firma, promesa);
      out.set(l.firma, promesa);
    });
  }
  return out;
}

type Origen = { id: string; graficador: string; args: Args };

const CARGANDO: CifrasEnVivo = { cifras: null, cargando: true, error: null };

/** Las cifras de cada origen, por su id. Un origen todavía sin respuesta sale `cargando`. */
export function useCifrasDeOrigenes(origenes: readonly Origen[], scope: "active" | "consolidated"): Readonly<Record<string, CifrasEnVivo>> {
  const presets = usePlanStore((s) => s.presets);
  const firmas = origenes.map((o) => [o.id, firmaPedidoRegla(o.graficador, o.args, scope, presetDelGraficador(o.graficador, presets))] as const);
  const clave = JSON.stringify([...new Set(firmas.map(([, f]) => f))].sort());
  const [leidos, setLeidos] = useState<Readonly<Record<string, Leido>>>({});
  useEffect(() => {
    let vivo = true;
    for (const [firma, promesa] of pedirTodas(JSON.parse(clave) as string[])) {
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
