/**
 * Control › Correo (ficha Ctl1): cómo rinde cada envío y cuándo insistir.
 * La matriz «Secuencia de envíos por público» (una fila por público, una
 * columna por posición en su serie: invitación, 2.º, 3.º…) y las campañas con
 * su papel en cada público (de qué invitación es recordatorio cada envío).
 * El orden dentro del público es `envios[].orden` cuando el envío es del
 * público (ADR 0111); si no, la posición por fecha. Puro y con test.
 */

import type { MonitoreoMailchimpEnvio, MonitoreoMailchimpPublico } from "../../../../../../api/monitoreoMailchimp";
import { tramosDelPublico } from "../../avanceCorreoEmbudoModelo";

export type CeldaDeEnvio = {
  posicion: number;
  campaignId: string;
  titulo: string;
  fecha: string;
  entregados: number | null;
  respuestas: number | null;
};

export type FilaDeSecuencia = {
  publico: MonitoreoMailchimpPublico;
  celdas: Array<CeldaDeEnvio | null>;
};

export type Secuencia = { columnas: number; filas: FilaDeSecuencia[] };

/** Columnas mínimas: la invitación y el siguiente envío, aunque no haya salido. */
export const COLUMNAS_MINIMAS = 2;

export function celdasDelPublico(envios: readonly MonitoreoMailchimpEnvio[], publico: string): CeldaDeEnvio[] {
  const tramos = tramosDelPublico(envios, publico);
  const usadas = new Set<number>();
  return tramos.map((tramo, indice) => {
    const propia = tramo.envio.actor === publico && tramo.envio.orden != null && tramo.envio.orden >= 1 ? tramo.envio.orden : null;
    let posicion = propia ?? indice + 1;
    while (usadas.has(posicion)) posicion += 1;
    usadas.add(posicion);
    return {
      posicion,
      campaignId: tramo.envio.campaign_id,
      titulo: tramo.envio.titulo || tramo.envio.etiqueta || tramo.envio.campaign_id,
      fecha: tramo.envio.enviado_at,
      entregados: tramo.cifras.entregados,
      respuestas: tramo.cifras.respuestas,
    };
  }).sort((a, b) => a.posicion - b.posicion);
}

export function secuenciaDeEnvios(publicos: readonly MonitoreoMailchimpPublico[], envios: readonly MonitoreoMailchimpEnvio[]): Secuencia {
  const conCeldas = publicos.map((publico) => ({ publico, propias: celdasDelPublico(envios, publico.actor) }));
  const maximo = Math.max(0, ...conCeldas.flatMap((fila) => fila.propias.map((celda) => celda.posicion)));
  // Siempre queda visible el siguiente envío de la serie, vacío.
  const columnas = Math.max(COLUMNAS_MINIMAS, maximo + 1);
  const filas = conCeldas
    .map(({ publico, propias }) => ({
      publico,
      celdas: Array.from({ length: columnas }, (_, indice) => propias.find((celda) => celda.posicion === indice + 1) ?? null),
    }))
    .sort((a, b) => {
      const enviosA = a.celdas.filter(Boolean).length;
      const enviosB = b.celdas.filter(Boolean).length;
      return enviosB - enviosA || (b.publico.universo ?? 0) - (a.publico.universo ?? 0) || a.publico.actor.localeCompare(b.publico.actor, "es");
    });
  return { columnas, filas };
}

/** «Invitación», «2.º», «3.º»… */
export function rotuloDeColumna(posicion: number) {
  return posicion <= 1 ? "Invitación" : `${posicion}.º`;
}

export type PapelEnPublico = { publico: string; posicion: number; rotulo: string; recordatorioDe: string | null };

export type Campana = {
  campaignId: string;
  titulo: string;
  fecha: string;
  etiqueta: string;
  entregados: number | null;
  respuestas: number | null;
  papeles: PapelEnPublico[];
};

/**
 * Cada campaña con su papel en cada público que tocó: invitación o
 * recordatorio N, y de qué invitación es recordatorio (la que abrió la serie
 * de ese público).
 */
export function campanas(publicos: readonly MonitoreoMailchimpPublico[], envios: readonly MonitoreoMailchimpEnvio[]): Campana[] {
  const series = new Map(publicos.map((publico) => [publico.actor, celdasDelPublico(envios, publico.actor)]));
  // Públicos que solo aparecen en los envíos también tienen serie.
  for (const envio of envios) {
    for (const actor of [envio.actor, ...envio.por_actor.map((fila) => fila.actor)]) {
      if (actor && !series.has(actor)) series.set(actor, celdasDelPublico(envios, actor));
    }
  }
  const instante = (iso: string) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  return [...envios]
    .sort((a, b) => instante(a.enviado_at) - instante(b.enviado_at))
    .map((envio) => {
      const papeles: PapelEnPublico[] = [];
      for (const [publico, celdas] of series) {
        const celda = celdas.find((item) => item.campaignId === envio.campaign_id);
        if (!celda) continue;
        const invitacion = celdas.find((item) => item.posicion === 1);
        papeles.push({
          publico,
          posicion: celda.posicion,
          rotulo: celda.posicion <= 1 ? "Invitación" : `Recordatorio ${celda.posicion - 1}`,
          recordatorioDe: celda.posicion > 1 && invitacion && invitacion.campaignId !== envio.campaign_id ? invitacion.titulo : null,
        });
      }
      return {
        campaignId: envio.campaign_id,
        titulo: envio.titulo || envio.etiqueta || envio.campaign_id,
        fecha: envio.enviado_at,
        etiqueta: envio.etiqueta,
        entregados: envio.entregados,
        respuestas: envio.respuestas,
        papeles: papeles.sort((a, b) => a.publico.localeCompare(b.publico, "es")),
      };
    });
}

/**
 * Sobre esta tasa de apertura el conteo no mide lectura: los filtros de
 * seguridad del correo institucional abren cada mensaje al recibirlo
 * (Acreditación 29/10: 92–96 % en los públicos con correo PUCP frente a 15–21 %
 * en egresados, que usan correos personales, ya sin contar Apple). El clic es
 * entonces la primera señal de que alguien leyó.
 */
export const APERTURA_AUTOMATICA = 0.85;

export function aperturaAutomatica(aperturas: number | null | undefined, entregados: number | null | undefined) {
  return aperturas != null && entregados != null && entregados > 0 && aperturas / entregados >= APERTURA_AUTOMATICA;
}

/** Una campaña dice su papel sólo si no es la invitación de un único público. */
export function papelesQueInforman(campana: Campana) {
  return campana.papeles.length > 1 || campana.papeles.some((papel) => papel.posicion > 1) ? campana.papeles : [];
}

/** Tasa sobre la base alcanzable, de mayor a menor; sin dato al final. */
export function tasasPorPublico(publicos: readonly MonitoreoMailchimpPublico[]) {
  return [...publicos]
    .map((publico) => ({ publico: publico.actor, tasa: publico.tasa_alcanzable, alcanzable: publico.alcanzable, efectivas: publico.efectivas }))
    .sort((a, b) => (b.tasa ?? -1) - (a.tasa ?? -1) || a.publico.localeCompare(b.publico, "es"));
}

/** CSV de los correos inválidos: solo tokens, ningún correo. */
export function csvDeInvalidos(filas: ReadonlyArray<{ token: string; actor: string; motivo: string; campaign_id: string; fecha: string }>, titulos: ReadonlyMap<string, string>, motivo: (valor: string) => string) {
  const celda = (valor: string) => (/[",\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor);
  return [
    ["Token", "Público", "Motivo", "Campaña", "Fecha"].join(","),
    ...filas.map((fila) => [fila.token, fila.actor, motivo(fila.motivo), titulos.get(fila.campaign_id) ?? fila.campaign_id, fila.fecha].map(celda).join(",")),
  ].join("\n");
}
