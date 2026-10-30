import type { HojasRutaAlert } from "../../../../api/hojasRuta";

/**
 * Muestra sorteada con el reparto por zonas v1 (ADR 0117; checklist del flujo del analista F11–F13).
 * El backend la reconoce y adjunta un aviso `W_SAMPLE_DRAWN_WITH_V1` por distrito afectado, con el
 * porcentaje de viviendas del marco elegible que quedaron sin probabilidad de salir. Aquí sólo se lee.
 */

export const CODIGO_V1 = "W_SAMPLE_DRAWN_WITH_V1";

export type DistritoV1 = { distrito: string; pct: number | null };
export type MuestraV1 = { distritos: DistritoV1[]; peor: DistritoV1 | null };

const titulo = (s: string) =>
  s.toLocaleLowerCase("es-PE").split(/\s+/).map((p) => (["de", "del", "la", "las", "los", "y"].includes(p) ? p : p.charAt(0).toLocaleUpperCase("es-PE") + p.slice(1))).join(" ");

/** Distritos afectados por el reparto v1, del peor al menos malo; null si la muestra no es v1. */
export function muestraV1(alerts: readonly HojasRutaAlert[] | undefined | null): MuestraV1 | null {
  const avisos = (alerts ?? []).filter((a) => a.code === CODIGO_V1);
  if (!avisos.length) return null;
  const distritos = avisos
    .map((a) => {
      const m = /^([^:]+):.*?([\d.,]+)\s*%/.exec(a.message ?? "");
      return { distrito: m ? titulo(m[1].trim()) : "Un distrito", pct: m ? Number(m[2].replace(",", ".")) : null };
    })
    .sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0));
  return { distritos, peor: distritos[0] ?? null };
}

/** El resumen que lee el analista: cuántos distritos y el peor caso. */
export function resumenV1(v1: MuestraV1): string {
  const n = v1.distritos.length;
  const peor = v1.peor && v1.peor.pct !== null ? ` En ${v1.peor.distrito}, el ${v1.peor.pct.toLocaleString("es-PE", { maximumFractionDigits: 1 })} % de las viviendas del marco no tenía cómo salir.` : "";
  return `Se sorteó con el reparto por zonas anterior, que dejó manzanas sin probabilidad de salir en ${n} distrito${n === 1 ? "" : "s"}.${peor}`;
}
