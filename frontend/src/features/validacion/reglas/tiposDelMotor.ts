/**
 * Tipos de la regla propia que el motor ya acepta y que `../types.ts` todavía
 * no nombra (rebanada V2 del plan de fidelidad).
 *
 * El contrato M1 agregó el tipo "Condiciones combinadas" (`condiciones`, con
 * `params.modo` y `params.condiciones`) y la comparación con otra pregunta en
 * "Dos respuestas que deben cuadrar" (`params.valor_y_variable`). `types.ts`
 * no es de esta rebanada: aquí se declara el tipo ampliado y el panel trabaja
 * con él. Los clientes de `api/validacion.ts` siguen tipados con
 * `ReglaCustomTipo`; `comoCuerpoDelCliente` es el único punto donde se
 * estrecha, hasta que `ReglaCustomTipo` sume `"condiciones"`.
 */
import type { ReglaCustom, ReglaCustomTipo, ReglaGateCondition } from "../types";

export type TipoReglaPropia =
  | ReglaCustomTipo
  | "condiciones"
  | "bateria"
  | "comparar_fechas"
  | "formato"
  | "combinacion_catalogo"
  | "moda_en_grupo";

/** "todas": se marca si se cumplen todas; "alguna": si se cumple al menos una. */
export type ModoCondiciones = "todas" | "alguna";

export type OperadorDeCondicion = ReglaGateCondition["op"];

/** Una condición de "Condiciones combinadas": contra un valor o contra otra pregunta, nunca las dos. */
export type CondicionCombinada = {
  variable: string;
  /** "" mientras la fila está a medio llenar. */
  op: OperadorDeCondicion | "";
  valor?: string | number | string[];
  variable_comparada?: string;
};

/** Una regla propia tal como la guarda el motor, con los tipos de M1. */
export type ReglaPropia = Omit<ReglaCustom, "tipo"> & { tipo: TipoReglaPropia };

/** El cuerpo del POST o PUT de `/reglas_custom`. */
export type ReglaPropiaAGuardar = Omit<ReglaPropia, "id" | "created_at"> & { id?: string };

const TIPOS_CONOCIDOS: readonly TipoReglaPropia[] = [
  "no_nulo",
  "rango_num",
  "rango_fecha",
  "outliers_iqr",
  "outliers_z",
  "duplicados",
  "coherencia_2v",
  "fuera_catalogo",
  "select_multiple_hierarchy",
  "select_multiple_exclusive",
  "select_multiple_cardinality",
  "select_multiple_selection",
  "condiciones",
  "bateria",
  "comparar_fechas",
  "formato",
  "combinacion_catalogo",
  "moda_en_grupo",
];

export function esTipoReglaPropia(valor: unknown): valor is TipoReglaPropia {
  return typeof valor === "string" && (TIPOS_CONOCIDOS as readonly string[]).includes(valor);
}

/** Una regla que llega del listado: su `tipo` puede ser `condiciones` aunque `types.ts` no lo diga. */
export function comoReglaPropia(regla: ReglaCustom): ReglaPropia {
  return regla;
}

/**
 * El cuerpo que esperan `apiV2ReglasCustomCreate` y `apiV2ReglasCustomUpdate`.
 * Mismo objeto: solo cambia el tipo estático, porque el cliente todavía no
 * nombra `condiciones`.
 */
export function comoCuerpoDelCliente(
  cuerpo: ReglaPropiaAGuardar,
): Omit<ReglaCustom, "id" | "created_at"> & { id?: string } {
  return cuerpo as Omit<ReglaCustom, "id" | "created_at"> & { id?: string };
}

export const OPERADORES_DE_COMPARACION: readonly OperadorDeCondicion[] = ["==", "!=", ">", ">=", "<", "<="];

export function esOperadorDeComparacion(op: string): boolean {
  return (OPERADORES_DE_COMPARACION as readonly string[]).includes(op);
}
