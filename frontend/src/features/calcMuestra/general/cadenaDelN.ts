/**
 * Método › «Cómo sale el n»: la cadena del marco al n a campo (patrón 5 de
 * aulas, `FlujoVertical`). Sólo publica lo que el motor ya devolvió; sin
 * cálculo, cada etapa dice «—» y está pendiente, nunca una estimación.
 */
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { FlujoEtapa } from "../universidad/ui";
import { fmtInt, fmtPct, safeNumber } from "../sharedCore";

export function cadenaDelN(
  comp: Pick<CalcMuestraComponente, "resultado" | "parametros">,
  N: number,
): FlujoEtapa[] {
  const r = comp.resultado ?? null;
  const n = safeNumber(r?.n_objetivo, 0);
  const campo = safeNumber(r?.n_operativo, 0);
  const tasa = safeNumber(r?.tasa_respuesta_esperada ?? comp.parametros?.tasa_respuesta, NaN);
  const sobre = safeNumber(comp.parametros?.oversample_pct, 0);
  const esperadas = safeNumber(r?.n_completas_esperadas, NaN);
  // Si se aborda el marco entero (censo, o el tope del marco), el n a campo no
  // sale de dividir por la respuesta: «÷ respuesta 70 %» junto a 2,000 describía
  // una cuenta que no ocurrió (L18). Se dice qué es y cuántas vuelven.
  const todoElMarco = N > 0 && campo >= N;
  const detalleCampo = todoElMarco
    ? [
        "todo el marco",
        Number.isFinite(esperadas) ? `se esperan ${fmtInt(Math.round(esperadas))} completas` : null,
      ].filter(Boolean).join(" · ")
    : [
        Number.isFinite(tasa) && tasa > 0 ? `÷ respuesta ${fmtPct(tasa)}` : null,
        sobre > 0 ? `+${fmtPct(sobre)} sobremuestra` : null,
      ].filter(Boolean).join(" · ");
  return [
    {
      id: "N",
      label: "N del marco",
      valor: N > 0 ? fmtInt(N) : "—",
      detalle: N > 0 ? "unidades del marco" : "sin declarar",
      estado: N > 0 ? "ready" : "pending",
    },
    {
      id: "n",
      label: "n completas",
      valor: n > 0 ? fmtInt(n) : "—",
      detalle: n > 0 ? "lo que pide la fórmula" : "sin calcular",
      estado: n > 0 ? "ready" : "pending",
    },
    {
      id: "campo",
      label: "n a campo",
      valor: campo > 0 ? fmtInt(campo) : "—",
      detalle: campo > 0 ? detalleCampo || "casos a abordar" : "sin calcular",
      estado: campo > 0 ? "ready" : "pending",
    },
  ];
}
