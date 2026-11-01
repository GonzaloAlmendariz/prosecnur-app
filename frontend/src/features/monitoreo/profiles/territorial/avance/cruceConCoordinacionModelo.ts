import type { TerritorialQuotaObservedCross } from "../../../../../api/client";
import type { UmpPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";

/**
 * 2h parte 2 · Lo que declara coordinación por celda de cuota, al lado de lo
 * que llegó a Kobo en la misma celda, por marginal (sexo y edad por separado,
 * que es como el coordinador lo anota). Nunca se suman: el avance oficial sigue
 * siendo Kobo; esto sólo señala dónde no cuadra.
 *
 * «Kobo» son las efectivas validadas de la celda —las mismas que cuenta el
 * avance (`advance_valid`), sin las subsanaciones—, no los casos con
 * consentimiento (Gonzalo, 1 nov). Salen de `observed_valid_cross`, que el motor
 * arma sobre las filas válidas de la manzana en uso con todos los rangos de la
 * meta (también los de meta 0) y una celda «Sin dato» para lo que no cae en
 * ninguno.
 */

export type CeldaCruzada = { celda: string; coordinacion: number | null; kobo: number; diferencia: number | null };
/** `evaluable: false`: sin meta o sin la variable en la base; se muestra sin diferencias. */
export type MarginalCruzada = { variable: "Sexo" | "Edad"; celdas: CeldaCruzada[]; noCuadran: number; evaluable: boolean };
export type CruceConCoordinacion =
  | { estado: "sin-registro" }
  | { estado: "listo"; marginales: MarginalCruzada[]; noCuadran: number };

/** Clave de comparación: sin tildes ni mayúsculas; los rangos de edad por sus números; H/M por su inicial. */
export function claveDeCelda(raw: string, variable: "Sexo" | "Edad"): string {
  const t = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (variable === "Edad") {
    const numeros = t.match(/\d+/g);
    return numeros ? numeros.join("-") + (/\+|mas/.test(t) ? "+" : "") : t;
  }
  return t.charAt(0);
}

function marginal(
  variable: "Sexo" | "Edad",
  declaradas: Array<{ celda: string; valor: number }>,
  observadas: Array<{ label: string; total: number }>,
  evaluable = true,
): MarginalCruzada | null {
  if (!declaradas.length) return null;
  if (!evaluable) {
    const celdas = declaradas.map((d) => ({ celda: d.celda, coordinacion: d.valor, kobo: 0, diferencia: null }));
    return { variable, celdas, noCuadran: 0, evaluable: false };
  }
  const kobo = new Map(observadas.map((o) => [claveDeCelda(o.label, variable), o]));
  const vistas = new Set<string>();
  const celdas: CeldaCruzada[] = observadas
    .filter((o) => o.label !== "Sin dato" || o.total > 0)
    .map((o) => {
      const clave = claveDeCelda(o.label, variable);
      vistas.add(clave);
      const d = declaradas.find((x) => claveDeCelda(x.celda, variable) === clave);
      const coordinacion = d ? d.valor : null;
      return { celda: o.label, coordinacion, kobo: o.total, diferencia: coordinacion == null ? null : coordinacion - o.total };
    });
  // Lo que coordinación anota en una celda que Kobo no tiene también se ve.
  for (const d of declaradas) {
    const clave = claveDeCelda(d.celda, variable);
    if (!vistas.has(clave) && !kobo.has(clave)) celdas.push({ celda: d.celda, coordinacion: d.valor, kobo: 0, diferencia: d.valor });
  }
  return { variable, celdas, noCuadran: celdas.filter((c) => c.diferencia != null && c.diferencia !== 0).length, evaluable: true };
}

export function construirCruceConCoordinacion(
  cruce: TerritorialQuotaObservedCross | null | undefined,
  ump: UmpPlanificada | null | undefined,
): CruceConCoordinacion {
  if (!ump || (!ump.coordinacionPorSexo.length && !ump.coordinacionPorEdad.length)) return { estado: "sin-registro" };
  const n = (v: unknown) => Math.round(Number(v) || 0);
  // `total` es lo observado, sin el ajuste de subsanación (`adjusted_total`).
  const porSexo = (cruce?.rows ?? []).map((r) => ({ label: String(r.label ?? ""), total: n(r.total) }));
  const porEdad = (cruce?.columns ?? []).map((c) => ({ label: String(c.label ?? ""), total: n(c.total) }));
  const marginales = [
    marginal("Sexo", ump.coordinacionPorSexo, porSexo, cruce?.sex_evaluable !== false),
    marginal("Edad", ump.coordinacionPorEdad, porEdad, cruce?.age_evaluable !== false),
  ].filter((m): m is MarginalCruzada => m != null);
  return { estado: "listo", marginales, noCuadran: marginales.reduce((a, m) => a + m.noCuadran, 0) };
}
