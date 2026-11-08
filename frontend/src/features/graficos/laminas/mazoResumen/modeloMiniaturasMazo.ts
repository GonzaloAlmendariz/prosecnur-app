// Las miniaturas reales de las tarjetas del mazo (oleada M, paso 7). Reutiliza las funciones puras de la tira
// (miniaturas/loteMiniaturas.ts: marcarPedidas, fusionarLote, fallarLote, olvidarPendientes) con su propio plan, porque
// el mazo nunca cancela nada: pide siempre con `reemplazar = false` para no tirar los lotes de la tira (el backend
// cancela TODOS los lotes de la sesión ante un `reemplazar = true`). Un solo lote del mazo a la vez: lo editado mientras
// corre espera a que termine. Pura: el hook la orquesta y el test la prueba sola.

import type { Slide } from "../../../../api/graficos";
import { clavePreview } from "../../previewLaminaCoordinador";
import type { EntradaMiniatura, Entradas, LaminaClave } from "../miniaturas/loteMiniaturas";
import { laminaDePropuesta, TIPO_CIERRE, type PropuestaMazo } from "./modeloMazo";

export type LaminaDelMazo = LaminaClave & { propuesta: string; slide: Slide };

/** Un id de lámina estable y sin caracteres raros por propuesta («fortalezas:docentes» → «mazo-fortalezas-docentes»). */
export function idMiniatura(propuesta: string): string {
  return `mazo-${propuesta.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

/**
 * Las propuestas que se dibujan: con gráfico y sin nada que les falte. El cierre lee las láminas anteriores del informe
 * (aún no existen) y aperturas sin la pregunta que divide no tiene qué dibujar.
 */
export function laminasConMiniatura(propuestas: readonly PropuestaMazo[], global: string): LaminaDelMazo[] {
  return propuestas
    .filter((p) => p.tipo !== TIPO_CIERRE && !!p.graficador && !p.falta)
    .map((p) => {
      const id = idMiniatura(p.id);
      const slide = laminaDePropuesta(p, id);
      return { id, propuesta: p.id, slide, clave: `${global}|${clavePreview(slide)}` };
    });
}

/**
 * Qué pedir. Con un lote del mazo corriendo, nada (lo editado espera: pedirlo ahora lo dibujaría dos veces). Sin lote:
 * las que no tienen entrada, las que cambiaron de clave y las pendientes que quedaron huérfanas. null = nada que pedir.
 */
export function planMazo(laminas: readonly LaminaClave[], entradas: Entradas, lotesCorriendo: number): LaminaClave[] | null {
  if (lotesCorriendo > 0) return null;
  const pedir = laminas.filter((l) => {
    const e = entradas[l.id];
    return !e || e.clave !== l.clave || e.estado === "pendiente";
  });
  return pedir.length ? pedir : null;
}

/**
 * La imagen a pintar: la de su clave vigente si llegó; mientras se rehace, la anterior de esa lámina (la caja no se
 * vacía, C2). null: se pinta el glifo del tipo.
 */
export function imagenDeTarjeta(e: EntradaMiniatura | undefined): string | null {
  if (!e || e.estado === "error") return null;
  return e.src ?? e.anterior ?? null;
}
