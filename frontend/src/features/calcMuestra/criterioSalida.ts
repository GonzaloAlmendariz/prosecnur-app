/**
 * Criterio de salida de un componente: qué condición lo da por terminado en
 * campo. Vive fuera de `CalcMuestraPage` porque esa página está congelada a
 * crecimiento y porque la regla tiene que poder probarse sin montarla.
 *
 * La cuota se lee del RESULTADO del motor, no de la meta pedida. `n_objetivo`
 * ya incorpora la meta del usuario cuando la fijó y la regla canónica del
 * cuadro maestro cuando no; es la única cifra que coincide con lo que se va a
 * levantar. Antes se recomponía en el cliente con
 * `meta.valor || inferencia_acreditacion?.minimo_cuota || 150`, y ese `150`
 * —la regla de docentes con N ≥ 251— se publicaba como criterio de cualquier
 * componente de cuotas al que le faltaran las dos primeras: un componente de
 * egresados con marco de 40 salía calculado en 20 y la tabla anunciaba 150.
 */
import { fmtInt, fmtPct } from "./sharedCore";
import type { CalcMuestraComponente } from "../../api/client";

const ACTORES_CON_REGLA_PROPIA = [
  "administrativos",
  "docentes",
  "estudiantes",
  "egresados",
];

function cifraPositiva(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Cuota efectiva de un componente de cuotas, o `null` si todavía no está
 * fijada. No inventa un número por defecto: un criterio de salida inventado se
 * lee igual que uno decidido.
 */
export function cuotaDelComponente(comp: CalcMuestraComponente): number | null {
  return (
    cifraPositiva(comp.resultado?.n_objetivo) ?? cifraPositiva(comp.meta?.valor)
  );
}

/**
 * Meta de cuota que el usuario fijó a mano, o `null` si no fijó ninguna. Es lo
 * que debe mostrar el campo editable: el campo escribe `meta.valor`, así que
 * enseñar ahí la cifra derivada del motor haría creer que está fijada.
 */
export function metaCuotaFijada(comp: CalcMuestraComponente): number | null {
  return cifraPositiva(comp.meta?.valor);
}

/**
 * Cifra que el motor usará si nadie fija la meta. Sirve de sugerencia junto al
 * campo vacío, nunca de valor precargado.
 */
export function sugerenciaCuota(comp: CalcMuestraComponente): number | null {
  return cifraPositiva(comp.resultado?.n_objetivo);
}

export function criterioSalida(comp: CalcMuestraComponente): string {
  if (!comp.resultado) return "Pendiente";
  if (ACTORES_CON_REGLA_PROPIA.includes(comp.actor_categoria)) {
    if (comp.tecnica === "no_prob_cuotas") {
      const cuota = cuotaDelComponente(comp);
      return cuota == null ? "Cuota sin fijar" : `Cuota ${fmtInt(cuota)}`;
    }
    if (comp.tecnica === "no_prob_conveniencia") {
      return `Cobertura ${fmtPct(comp.parametros.cobertura_objetivo)}`;
    }
    if (comp.tecnica === "prob_conglomerado_multietapico") {
      return `Sobremuestra ${fmtPct(comp.parametros.oversample_pct)}`;
    }
    return `Cobertura ${fmtPct(comp.parametros.cobertura_objetivo)}`;
  }
  if ((comp.resultado.cuotas_matriz?.length ?? 0) > 0) {
    return "Cuotas por celda";
  }
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") {
    return `Cobertura ${fmtPct(comp.resultado.cobertura_objetivo)}`;
  }
  if (comp.tecnica === "no_prob_cuotas" || comp.tecnica === "no_prob_conveniencia") {
    return "Cuotas";
  }
  return "Muestra";
}
