import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { esRefuerzoPedido } from "./seguimientoDeRefuerzos";

/**
 * **Qué ofrecer cuando todavía no se ha tecleado ningún código.**
 *
 * La pestaña era un input y nada más: 300 px de 3.200, el 90 % en blanco. Un
 * buscador vacío no es un vacío legítimo —hay mucho que ofrecer— y esconderlo
 * obliga a saber de memoria qué código se quiere mirar.
 *
 * La regla del Sistema Pabellón manda aquí: **listas completas, sin «…y N más»**.
 * Lo que se prioriza se declara; lo que no cabe se organiza, no se esconde.
 *
 * **Ninguna cifra se calcula en este módulo**: `cuadra` lo decide el motor
 * (`monitoreo_aulas_parte_descuadre()`) y el estado de refuerzo lo decide
 * `esRefuerzoPedido`. Aquí sólo se agrupa lo que ya está resuelto.
 */

export type AtajoDeFicha = {
  clave: string;
  titulo: string;
  /** Por qué merece mirarse, en una frase. */
  motivo: string;
  codigos: string[];
};

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

/** Los partes que el motor marcó como no cuadrados, en el orden en que llegan. */
function noCuadran(partes: ReadonlyArray<Record<string, unknown>>): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const p of partes) {
    // `cuadra === false` y no `!cuadra`: el nulo significa «sin identidad que
    // comprobar» —un parte sin asistentes ni efectivas—, y contarlo como
    // descuadre mandaría a revisar lo que no tiene nada que revisar.
    if (p.cuadra !== false) continue;
    const codigo = texto(p.operational_code);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    out.push(codigo);
  }
  return out;
}

function refuerzosPedidos(plan: ReadonlyArray<MonitoreoAulasPlanRow>): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const f of plan) {
    if (!esRefuerzoPedido(f)) continue;
    const codigo = texto(f.operational_code);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    out.push(codigo);
  }
  return out;
}

export function porDondeEmpezarLaFicha(
  plan: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  partes: ReadonlyArray<Record<string, unknown>> | null | undefined,
): AtajoDeFicha[] {
  const atajos: AtajoDeFicha[] = [];

  const descuadrados = noCuadran(partes ?? []);
  if (descuadrados.length) {
    atajos.push({
      clave: "no-cuadran",
      titulo: "No cuadran",
      motivo: "asistentes menos rechazos y duplicados no dan las encuestas que declara el parte",
      codigos: descuadrados,
    });
  }

  const refuerzos = refuerzosPedidos(plan ?? []);
  if (refuerzos.length) {
    atajos.push({
      clave: "refuerzos",
      titulo: "Refuerzos pedidos",
      motivo: "están en la cola del agendador y su ficha dice en qué punto va cada uno",
      codigos: refuerzos,
    });
  }

  return atajos;
}
