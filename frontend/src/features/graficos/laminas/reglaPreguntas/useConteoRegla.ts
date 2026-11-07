// El conteo en vivo de la regla de preguntas (POST /api/graficos/resumenes/regla, ADR 0135 §4): cuántas elige, cuáles
// y el texto de la nota. Se pide con espera (350 ms) y el efecto depende de la FIRMA del pedido, un texto, no de `args`:
// la tarjeta re-arma `args` en cada render y, con el objeto como dependencia, efecto → estado → render → objeto nuevo →
// efecto sin fin (el bucle que congeló la maqueta del Sí/No, useConteosMaqueta.ts). El pedido se reconstruye de la firma.

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../api/core";
import { apiGraficosConteoRegla, type ConteoRegla } from "../../../../api/graficosRegla";
import { firmaPedidoRegla, mismoConteo } from "./modeloReglaPreguntas";

export const ESPERA_CONTEO_MS = 350;

type Args = Readonly<Record<string, unknown>>;

export type ConteoEnVivo = {
  /** El último conteo recibido (puede ser del pedido anterior mientras llega el nuevo). */
  conteo: ConteoRegla | null;
  /** El pedido actual todavía no respondió. */
  cargando: boolean;
  error: string | null;
  codigo: string | null;
};

type Estado = { firma: string; conteo: ConteoRegla | null; error: string | null; codigo: string | null };

const VACIO: Estado = { firma: "", conteo: null, error: null, codigo: null };

/** El mensaje del backend sin el código que `ApiError` le pega al final. */
export function mensajeDeError(e: unknown): { mensaje: string; codigo: string | null } {
  if (e instanceof ApiError) {
    // `ApiError` cierra el mensaje con «<punto medio> CÓDIGO» (api/core.ts); el aviso muestra sólo la frase del motor.
    const cola = ` ${String.fromCharCode(0xb7)} ${e.code}`;
    return { mensaje: e.message.endsWith(cola) ? e.message.slice(0, -cola.length) : e.message, codigo: e.code };
  }
  return { mensaje: e instanceof Error ? e.message : "No se pudo contar las preguntas.", codigo: null };
}

/** El pedido que la firma describe (graficador|scope|args en JSON estable). */
export function pedidoDeFirma(firma: string): { graficador: string; scope: string; args: Args } | null {
  const a = firma.indexOf("|");
  const b = a < 0 ? -1 : firma.indexOf("|", a + 1);
  if (a < 0 || b < 0) return null;
  try {
    const args = JSON.parse(firma.slice(b + 1)) as unknown;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    return { graficador: firma.slice(0, a), scope: firma.slice(a + 1, b), args: args as Args };
  } catch {
    return null;
  }
}

/** `activo` en falso (sin regla guardada) no pide nada. */
export function useConteoRegla(graficador: string, args: Args, scope: "active" | "consolidated", activo: boolean): ConteoEnVivo {
  const firma = useMemo(() => (activo ? firmaPedidoRegla(graficador, args, scope) : ""), [activo, graficador, args, scope]);
  const [estado, setEstado] = useState<Estado>(VACIO);
  useEffect(() => {
    const pedido = firma ? pedidoDeFirma(firma) : null;
    if (!pedido) return;
    const control = new AbortController();
    let vivo = true;
    const espera = setTimeout(() => {
      apiGraficosConteoRegla(
        { graficador: pedido.graficador, args: pedido.args, ...(pedido.scope === "consolidated" ? { scope: "consolidated" as const } : {}) },
        { signal: control.signal },
      ).then((conteo) => {
        if (!vivo) return;
        setEstado((prev) => (prev.firma === firma && !prev.error && mismoConteo(prev.conteo, conteo) ? prev : { firma, conteo, error: null, codigo: null }));
      }, (e: unknown) => {
        if (!vivo || control.signal.aborted) return;
        const { mensaje, codigo } = mensajeDeError(e);
        setEstado((prev) => (prev.firma === firma && prev.error === mensaje ? prev : { firma, conteo: null, error: mensaje, codigo }));
      });
    }, ESPERA_CONTEO_MS);
    return () => { vivo = false; clearTimeout(espera); control.abort(); };
  }, [firma]);
  const actual = !!firma && estado.firma === firma;
  return {
    conteo: firma ? estado.conteo : null,
    cargando: !!firma && !actual,
    error: actual ? estado.error : null,
    codigo: actual ? estado.codigo : null,
  };
}
