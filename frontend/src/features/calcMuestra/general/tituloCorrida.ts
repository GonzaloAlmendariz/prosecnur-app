/**
 * Cómo se nombra una corrida en su ficha. El método del sorteo (MAS,
 * sistemático, PPS) es lo que pasa DENTRO de cada estrato; en un diseño
 * estratificado el nombre del diseño es el estratificado con su asignación, y
 * titular «MAS» a secas lo escondía.
 */
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida } from "../../../api/calcMuestraGeneral";
import { ETIQUETA_ASIGNACION, asignacionEstratificada } from "./catalogos";
import { etiquetaMetodo } from "./modelo";

/** Clave con que el motor agrupa un marco sin estrato (`.CM_GENERAL_SIN_ESTRATO`). */
export const CLAVE_SIN_ESTRATO = "(total)";

export type NombreDeCorrida = {
  /** Título de la ficha, con la semilla. */
  titulo: string;
  /** La línea «Modalidad» de la traza. */
  modalidad: string;
};

type ComponenteDeCorrida = Pick<CalcMuestraComponente, "tecnica" | "parametros" | "resultado">;

/** El marco sorteado tiene estratos de verdad, no el grupo único del motor. */
export function corridaEstratificada(corrida: Pick<CalcMuestraGeneralCorrida, "estratos">): boolean {
  return corrida.estratos.some((e) => e.clave !== CLAVE_SIN_ESTRATO);
}

export function nombreDeCorrida(
  corrida: Pick<CalcMuestraGeneralCorrida, "corrida" | "estratos">,
  componente: ComponenteDeCorrida | null,
): NombreDeCorrida {
  const c = corrida.corrida;
  const semilla = `semilla ${c.semilla}`;
  if (c.modalidad === "censo") return { titulo: `Cobertura censal · ${semilla}`, modalidad: "Censo" };
  const metodo = etiquetaMetodo(c.metodo);
  if (componente?.tecnica === "prob_estratificado" && corridaEstratificada(corrida)) {
    const asignacion = ETIQUETA_ASIGNACION[asignacionEstratificada(componente)];
    const diseno = `Estratificado (${asignacion}) · ${metodo} dentro de cada estrato`;
    return { titulo: `${diseno} · ${semilla}`, modalidad: `Probabilística · ${diseno}` };
  }
  return { titulo: `${metodo} · ${semilla}`, modalidad: `Probabilística · ${metodo}` };
}
