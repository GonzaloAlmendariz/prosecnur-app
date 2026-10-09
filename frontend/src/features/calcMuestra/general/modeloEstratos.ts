/**
 * Método › Estratos de Muestra general: qué columnas lleva la tabla, cómo se
 * lee la proporción esperada de cada estrato y qué parche escribe cada
 * edición. Sin React, para probarlo sin montar nada.
 *
 * El motor general sólo usa del estrato su rótulo, su N_h y —en el
 * estratificado— su `p_facultad`: con ella el n se calcula por estrato
 * (Cochran 5.25/5.26) y Neyman puede repartir ∝ N_h·S_h. Las columnas de aulas
 * (sub A/B, promedio de la unidad, tasa de la facultad) no mueven nada aquí.
 */
import type {
  CalcMuestraComponente,
  CalcMuestraDistribucionEstrato,
  CalcMuestraEstrato,
} from "../../../api/calcMuestra";
import { estrato as sembrarEstrato } from "../ComponenteTablas";
import { safeNumber, type ComponentePatch } from "../sharedCore";

type ComponenteEstratos = Pick<CalcMuestraComponente, "id" | "tecnica" | "marco" | "resultado">;

/**
 * La columna «p esperada» sólo existe donde el motor la consume: el
 * estratificado de una proporción. Con una media el motor calcula con el CV
 * global e ignora la p de cada estrato, así que pedirla sería decorativo.
 */
export function usaProporcionPorEstrato(tecnica: string, tipoIndicador?: string | null): boolean {
  return tecnica === "prob_estratificado" && tipoIndicador !== "media";
}

/** Una p utilizable por el motor: número en (0, 1) abierto. */
export function esProporcionValida(p: unknown): p is number {
  return typeof p === "number" && Number.isFinite(p) && p > 0 && p < 1;
}

export type EntradaProporcion =
  | { tipo: "vacia" }
  | { tipo: "valida"; valor: number }
  | { tipo: "invalida" };

/** Lee lo tecleado: vacío borra la p del estrato; fuera de (0, 1) no se escribe. */
export function leerProporcion(texto: string): EntradaProporcion {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return { tipo: "vacia" };
  const valor = Number(limpio);
  return esProporcionValida(valor) ? { tipo: "valida", valor } : { tipo: "invalida" };
}

function estratosDe(comp: ComponenteEstratos): CalcMuestraEstrato[] {
  return comp.marco.estratos ?? [];
}

/** El N del marco se recompone con los N_h (sólo sin marco declarado). */
function conTotales(estratos: CalcMuestraEstrato[]): ComponentePatch {
  const total = estratos.reduce((suma, e) => suma + safeNumber(e.N), 0);
  return { marco: { estratos, marco_validado: total, universo_bruto: total, marco_contactable: total } };
}

/**
 * El parche de editar la p de un estrato, o `null` si lo tecleado no es una
 * proporción: no se escribe basura, el campo lo marca inválido. Sólo toca
 * `estratos`: el N del marco no cambia por declarar una p.
 */
export function patchProporcion(comp: ComponenteEstratos, index: number, texto: string): ComponentePatch | null {
  const entrada = leerProporcion(texto);
  if (entrada.tipo === "invalida") return null;
  const estratos = estratosDe(comp).map((e, i) => {
    if (i !== index) return e;
    if (entrada.tipo === "vacia") {
      const { p_facultad: _descartada, ...sinP } = e;
      return sinP;
    }
    return { ...e, p_facultad: entrada.valor };
  });
  return { marco: { estratos } };
}

export function patchRotulo(comp: ComponenteEstratos, index: number, label: string): ComponentePatch {
  return { marco: { estratos: estratosDe(comp).map((e, i) => (i === index ? { ...e, label } : e)) } };
}

export function patchTamano(comp: ComponenteEstratos, index: number, N: number): ComponentePatch {
  const n = Math.max(0, Math.round(safeNumber(N)));
  return conTotales(estratosDe(comp).map((e, i) => (i === index ? { ...e, N: n } : e)));
}

export function patchAgregar(comp: ComponenteEstratos): ComponentePatch {
  const actuales = estratosDe(comp);
  return conTotales([...actuales, sembrarEstrato(`Estrato ${actuales.length + 1}`, 0)]);
}

export function patchQuitar(comp: ComponenteEstratos, index: number): ComponentePatch {
  return conTotales(estratosDe(comp).filter((_, i) => i !== index));
}

export type FilaEstrato = {
  estrato: CalcMuestraEstrato;
  /** Lo que el motor asignó a este estrato en el último cálculo, si lo hay. */
  reparto: CalcMuestraDistribucionEstrato | null;
};

/**
 * Cada estrato con su reparto. Se empareja por rótulo —es como el motor
 * nombra el estrato en `distribucion_estratos`—; un estrato renombrado
 * después de calcular queda sin reparto en vez de heredar el de otro.
 */
export function filasDeEstratos(comp: ComponenteEstratos): FilaEstrato[] {
  const reparto = comp.resultado?.distribucion_estratos ?? [];
  const porRotulo = new Map(reparto.map((r) => [r.estrato, r]));
  return estratosDe(comp).map((e) => ({ estrato: e, reparto: porRotulo.get(e.label) ?? null }));
}

/** La regla del reparto en palabras. Con Neyman, «proporcional» sería falso. */
export function reglaEnPalabras(regla: string | undefined, formulaN: string | undefined): string {
  if (!regla) return "—";
  if (regla === "censo_estrato") return "Censo del estrato";
  const piso = /^piso_(\d+)$/.exec(regla);
  if (piso) return `Piso de ${piso[1]}`;
  if (regla === "proporcional") return formulaN === "neyman" ? "Neyman" : "Proporcional";
  return regla.replace(/_/g, " ");
}
