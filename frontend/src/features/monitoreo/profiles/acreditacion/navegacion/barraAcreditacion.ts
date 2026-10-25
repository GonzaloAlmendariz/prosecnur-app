import type { BarraDelModo } from "../../../shell/BarraDelModo";
import type { MetricaDeSeccion } from "../../../shell/metricaDeSeccion";
import type { AcreditacionAdvanceCard } from "../avance/tarjetasDeAvance";
import type { CasosDelCorte } from "../control/casos/tiposDeCaso";
import { fmt } from "../formato";

/**
 * Lo que la barra del modo de acreditación dice en todas las pestañas (G1):
 * cuántos públicos hay, los casos que esperan decisión (insignia de Control) y
 * el avance contra la meta (insignia de Avance). Las cifras salen de
 * `advanceCardsFromRows` y de `internal_queries.issues`, las mismas que leen
 * Avance y Control › Por resolver.
 */

/** «4», «9 + Piloto» o «9 + 2 sin meta». */
export function valorDePublicos(tarjetas: readonly AcreditacionAdvanceCard[]): string {
  const conMeta = tarjetas.filter((tarjeta) => tarjeta.meta != null && tarjeta.meta > 0);
  const sinMeta = tarjetas.filter((tarjeta) => !(tarjeta.meta != null && tarjeta.meta > 0));
  if (!conMeta.length || !sinMeta.length) return fmt(tarjetas.length);
  if (sinMeta.length === 1) return `${fmt(conMeta.length)} + ${sinMeta[0].actor}`;
  return `${fmt(conMeta.length)} + ${fmt(sinMeta.length)} sin meta`;
}

export function indicadoresDeAcreditacion(
  tarjetas: readonly AcreditacionAdvanceCard[] | null,
  declarados: number,
): BarraDelModo["indicadores"] {
  if (tarjetas?.length) {
    const sinMeta = tarjetas.filter((tarjeta) => !(tarjeta.meta != null && tarjeta.meta > 0)).length;
    return [{
      etiqueta: "Públicos",
      valor: valorDePublicos(tarjetas),
      detalle: sinMeta
        ? `${fmt(tarjetas.length)} públicos; ${fmt(sinMeta)} sin meta declarada`
        : `${fmt(tarjetas.length)} públicos con meta`,
    }];
  }
  return [{ etiqueta: "Públicos", valor: declarados ? fmt(declarados) : "Sin declarar" }];
}

/** Avance contra la meta, redondeado para la insignia («146 %»). */
export function porcentajeDeAvance(efectivas: number, meta: number): string | null {
  if (!(meta > 0)) return null;
  return `${fmt(Math.round((efectivas / meta) * 100))} %`;
}

/**
 * La insignia de Avance lleva su base (L20): efectivas sobre meta, el mismo
 * par que Avance › Resumen publica como «418 de 287 meta».
 */
export function insigniasDeAcreditacion(
  avance: { efectivas: number; meta: number } | null,
  casos: CasosDelCorte | null,
): Partial<Record<"control" | "avance", MetricaDeSeccion>> {
  const insignias: Partial<Record<"control" | "avance", MetricaDeSeccion>> = {};
  if (casos && casos.esperan > 0) insignias.control = fmt(casos.esperan);
  const porcentaje = avance ? porcentajeDeAvance(avance.efectivas, avance.meta) : null;
  if (avance && porcentaje) {
    insignias.avance = {
      valor: porcentaje,
      base: `${fmt(avance.efectivas)}/${fmt(avance.meta)}`,
      lectura: `${fmt(avance.efectivas)} efectivas de una meta de ${fmt(avance.meta)}`,
    };
  }
  return insignias;
}
