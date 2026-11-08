// El conteo en vivo de la regla de preguntas (POST /api/graficos/resumenes/regla, ADR 0135 §4): cuántas elige, cuáles
// y el texto de la nota. Se pide con espera (350 ms) y el efecto depende de la FIRMA del pedido, un texto, no de `args`:
// la tarjeta re-arma `args` en cada render y, con el objeto como dependencia, efecto → estado → render → objeto nuevo →
// efecto sin fin (el bucle que congeló la maqueta del Sí/No, useConteosMaqueta.ts). El pedido se reconstruye de la firma.

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../api/core";
import type { ConteoRegla } from "../../../../api/graficosRegla";
import { conteoEnCache, pedirConteoRegla } from "./cacheConteoRegla";
import { pedidoDeFirma } from "./pedidoDeFirma";
import { firmaPedidoRegla, firmaUniversoRegla, mismoConteo } from "./modeloReglaPreguntas";

export const ESPERA_CONTEO_MS = 350;

type Args = Readonly<Record<string, unknown>>;

export type ConteoEnVivo = {
  /**
   * El último conteo recibido del MISMO universo (puede ser de la regla anterior mientras llega el nuevo, para que el
   * corte y el conteo se proyecten en el cliente); de otra lámina, nunca: `null` y espera.
   */
  conteo: ConteoRegla | null;
  /** El pedido actual todavía no respondió. */
  cargando: boolean;
  error: string | null;
  codigo: string | null;
};

type Estado = { firma: string; universo: string; conteo: ConteoRegla | null; error: string | null; codigo: string | null };

const VACIO: Estado = { firma: "", universo: "", conteo: null, error: null, codigo: null };

/** El mensaje del backend sin el código que `ApiError` le pega al final. */
export function mensajeDeError(e: unknown): { mensaje: string; codigo: string | null } {
  if (e instanceof ApiError) {
    // `ApiError` cierra el mensaje con «<punto medio> CÓDIGO» (api/core.ts); el aviso muestra sólo la frase del motor.
    const cola = ` ${String.fromCharCode(0xb7)} ${e.code}`;
    return { mensaje: e.message.endsWith(cola) ? e.message.slice(0, -cola.length) : e.message, codigo: e.code };
  }
  return { mensaje: e instanceof Error ? e.message : "No se pudo contar las preguntas.", codigo: null };
}

export { pedidoDeFirma } from "./pedidoDeFirma";

/** `activo` en falso (sin regla guardada) no pide nada. */
export function useConteoRegla(graficador: string, args: Args, scope: "active" | "consolidated", activo: boolean): ConteoEnVivo {
  const firma = useMemo(() => (activo ? firmaPedidoRegla(graficador, args, scope) : ""), [activo, graficador, args, scope]);
  const universo = useMemo(() => (activo ? firmaUniversoRegla(graficador, args, scope) : ""), [activo, graficador, args, scope]);
  const [estado, setEstado] = useState<Estado>(VACIO);
  useEffect(() => {
    const pedido = firma ? pedidoDeFirma(firma) : null;
    if (!pedido) return;
    const delUniverso = firmaUniversoRegla(pedido.graficador, pedido.args, pedido.scope);
    let soltar: (() => void) | null = null;
    const pedir = () => {
      // La caché de módulo comparte el pedido con la maqueta (y con otra tarjeta de la misma firma): uno solo en vuelo.
      soltar = pedirConteoRegla(firma, (r) => {
        if (r.conteo) {
          const conteo = r.conteo;
          setEstado((prev) => (prev.firma === firma && !prev.error && mismoConteo(prev.conteo, conteo) ? prev : { firma, universo: delUniverso, conteo, error: null, codigo: null }));
          return;
        }
        const { mensaje, codigo } = mensajeDeError(r.error);
        setEstado((prev) => (prev.firma === firma && prev.error === mensaje ? prev : { firma, universo: delUniverso, conteo: null, error: mensaje, codigo }));
      });
    };
    // Con el conteo ya en caché no hay espera: el arrastre de la cifra la necesita para no pedir en cada paso; lo ya
    // contado, no.
    if (conteoEnCache(firma)) { pedir(); return () => soltar?.(); }
    const espera = setTimeout(pedir, ESPERA_CONTEO_MS);
    return () => { clearTimeout(espera); soltar?.(); };
  }, [firma]);
  const actual = !!firma && estado.firma === firma;
  return {
    conteo: firma && estado.universo === universo ? estado.conteo : null,
    cargando: !!firma && !actual,
    error: actual ? estado.error : null,
    codigo: actual ? estado.codigo : null,
  };
}

/**
 * Cuántas elige la regla: las seleccionadas. `total` es el tamaño del universo de candidatas (157 en Arte), no lo que la
 * regla elige (22): la ficha decía «Las 157 bajo 60%» (H1 de la revisión metodológica).
 */
export const elegidasPorRegla = (c: Pick<ConteoRegla, "seleccionadas">): number => c.seleccionadas.length;

/**
 * Cuántas elige cada firma, para quien sólo necesita el número (la ficha de la maqueta: «Las 22 bajo 60%»). Va por
 * la misma caché que `useConteoRegla`, así que el inspector y la maqueta abiertos a la vez hacen un solo pedido. Mientras
 * una firma no responde (o si responde con error), no está en el mapa: la ficha dice la regla sin número.
 */
export function useTotalesRegla(firmas: readonly string[]): ReadonlyMap<string, number> {
  // El efecto depende del texto (las firmas unidas), no del arreglo, que la maqueta re-arma en cada render.
  const clave = useMemo(() => [...new Set(firmas.filter(Boolean))].sort().join("\n"), [firmas]);
  const [totales, setTotales] = useState<ReadonlyMap<string, number>>(() => totalesEnCache(clave));
  useEffect(() => {
    const lista = clave ? clave.split("\n") : [];
    // Lo ya contado entra sin esperar; lo que falta, tras la misma espera que el inspector (que comparte el pedido).
    setTotales((prev) => conMismos(prev, totalesEnCache(clave)));
    const sueltas: Array<() => void> = [];
    const pedir = () => {
      for (const firma of lista) {
        sueltas.push(pedirConteoRegla(firma, (r) => {
          if (!r.conteo) return;
          const total = elegidasPorRegla(r.conteo);
          setTotales((prev) => (prev.get(firma) === total ? prev : new Map([...prev, [firma, total]])));
        }));
      }
    };
    const faltan = lista.some((f) => !conteoEnCache(f));
    const espera = faltan ? setTimeout(pedir, ESPERA_CONTEO_MS) : null;
    if (!faltan) pedir();
    return () => { if (espera) clearTimeout(espera); for (const s of sueltas) s(); };
  }, [clave]);
  return totales;
}

function totalesEnCache(clave: string): ReadonlyMap<string, number> {
  const m = new Map<string, number>();
  for (const f of clave ? clave.split("\n") : []) {
    const c = conteoEnCache(f);
    if (c) m.set(f, elegidasPorRegla(c));
  }
  return m;
}

/** Sólo las firmas vigentes; sin cambios, el mismo mapa (no re-renderiza). */
function conMismos(prev: ReadonlyMap<string, number>, enCache: ReadonlyMap<string, number>): ReadonlyMap<string, number> {
  const out = new Map(enCache);
  if (out.size === prev.size && [...out].every(([k, v]) => prev.get(k) === v)) return prev;
  return out;
}
