import type { MonitoreoTerritorialProductionAnnulmentImpact } from "../../../../../api/client";
import { fmt, nombreDeDistrito, numeroDeUmp } from "../rotulos";

/**
 * Anular un caso o la producción de un aplicador (territorial.md §3.6 P2 y
 * §3.8). La vista previa del motor dice qué cambia; aquí se pone en frases con
 * su base: «UMP 145: 8 → 7 de 8», «Estudio: 1,283 → 1,282 que cuentan».
 */

export type PedidoDeAnulacion =
  | { alcance: "caso"; responseId: string; rotulo: string }
  | { alcance: "produccion"; clave: string; rotulo: string };

export function cuerpoDelPedido(pedido: PedidoDeAnulacion) {
  return pedido.alcance === "caso"
    ? { scope: "response" as const, response_id: pedido.responseId, response_label: pedido.rotulo }
    : { scope: "all_production" as const, responsible_key: pedido.clave, responsible_label: pedido.rotulo };
}

export type LineaDeImpacto = { clave: string; texto: string };

export function impactoEnFrases(impacto: MonitoreoTerritorialProductionAnnulmentImpact | null | undefined): {
  casos: number;
  lineas: LineaDeImpacto[];
} {
  if (!impacto) return { casos: 0, lineas: [] };
  const lineas: LineaDeImpacto[] = [];
  for (const bloque of impacto.blocks ?? []) {
    const antes = Number(bloque.validas_antes);
    const despues = Number(bloque.validas_despues);
    if (!Number.isFinite(antes) || !Number.isFinite(despues) || antes === despues) continue;
    const meta = Number(bloque.meta);
    const ump = numeroDeUmp(bloque.ump);
    lineas.push({
      clave: `ump-${bloque.id_manzana ?? ump}`,
      texto: `UMP ${ump}${bloque.distrito ? ` (${nombreDeDistrito(bloque.distrito)})` : ""}: ${fmt(antes)} → ${fmt(despues)}${Number.isFinite(meta) && meta > 0 ? ` de ${fmt(meta)}` : ""}`,
    });
  }
  const antes = Number(impacto.before?.valid_responses);
  const despues = Number(impacto.after?.valid_responses);
  if (Number.isFinite(antes) && Number.isFinite(despues)) {
    lineas.push({ clave: "estudio", texto: `Estudio: ${fmt(antes)} → ${fmt(despues)} que cuentan` });
  }
  return { casos: Math.max(0, Math.round(Number(impacto.responses_excluded) || 0)), lineas };
}

export function textoDelBoton(pedido: PedidoDeAnulacion, casos: number): string {
  if (pedido.alcance === "caso") return "Anular 1 caso";
  return casos ? `Anular ${fmt(casos)} ${casos === 1 ? "caso" : "casos"}` : "Anular producción";
}
