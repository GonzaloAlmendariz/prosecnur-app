import type { MonitoreoRow } from "../../../../../api/monitoreo";
import { numeroONulo } from "../avanceCuota";
import { MINIMO_PARA_COMPARAR, PESO_DEL_PRIOR } from "../rendimientoPorFacultad";

/**
 * Rendimiento de un grupo de cursos-horario CONTRA LO QUE SE ESPERABA DE ELLOS.
 *
 * Gonzalo, 2026-10-31: «si hay aulas donde se agendan más el lunes que el
 * martes, lógicamente el lunes va a tener mayor rendimiento… no los estás
 * comparando de forma equitativa». Sumar efectivas por día, hora o aplicador
 * mide cuánto se agendó, no cuánto rinde.
 *
 * El estimando es la razón observadas ÷ esperadas: Σ efectivas del parte entre
 * Σ `expected_valid` del plan (elegibles × tasa prevista de cada aula, G4) de
 * los MISMOS cursos-horario. 100 % es «rindió lo previsto». Al usar lo esperado
 * de cada aula se descuenta la mezcla de facultades: si el lunes se agendan
 * facultades de baja asistencia, la tasa cruda las confundiría con el día.
 *
 * Reglas (revisor-metodológico, 2026-10-31):
 * - Numerador y denominador salen de los MISMOS partes: un parte sin esperadas
 *   en el plan no suma efectivas ni esperadas, y se cuenta en `sinEsperadas`.
 * - Un parte sin cifra de efectivas no es un cero: va a `sinCifra`.
 * - Con menos de `MINIMO_PARA_COMPARAR` cursos-horario el grupo se marca
 *   `pocos` y va al final: no se compara.
 * - `razonAjustada` encoge hacia la razón del estudio con `PESO_DEL_PRIOR`
 *   cursos-horario imaginarios (la misma doctrina de `rendimientoPorFacultad`).
 *   Las dos cifras se muestran; nunca se sustituye la observada.
 * Supuestos declarados: el prior y el mínimo son decisiones, no estimaciones;
 * la tasa prevista por aula se toma como exógena.
 */

export type GrupoDeRendimiento = {
  grupo: string;
  aulas: number;
  efectivas: number;
  esperadas: number;
  asistentes: number;
  /** Observadas ÷ esperadas, 0–1+; `null` sin esperadas. */
  razon: number | null;
  razonAjustada: number | null;
  /** Efectivas ÷ asistentes: lo que depende del trabajo en el aula. */
  deAsistentes: number | null;
  pocos: boolean;
};

export type RendimientoContraEsperado = {
  grupos: GrupoDeRendimiento[];
  /** Razón de todo el estudio, hacia la que se encoge. */
  razonDelEstudio: number | null;
  sinEsperadas: number;
  sinCifra: number;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

/**
 * @param partes filas del parte de campo (ya con su facultad, si hace falta).
 * @param plan el plan, para `expected_valid` de cada curso-horario.
 * @param grupoDe a qué grupo va cada parte («Lunes», «10:00», «P844 · Ana»…).
 */
export function rendimientoContraEsperado(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow>,
  grupoDe: (parte: MonitoreoRow) => string,
): RendimientoContraEsperado {
  const esperadasDe = new Map<string, number>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    const ev = numeroONulo(fila.expected_valid);
    if (codigo && ev != null && ev > 0 && !esperadasDe.has(codigo)) esperadasDe.set(codigo, ev);
  }
  let sinEsperadas = 0;
  let sinCifra = 0;
  const acumulado = new Map<string, { aulas: number; efectivas: number; esperadas: number; asistentes: number }>();
  for (const parte of partes) {
    const efectivas = numeroONulo(parte.effective_surveys);
    const asistentes = numeroONulo(parte.observed_students) ?? 0;
    if (efectivas == null) {
      if (asistentes > 0) sinCifra += 1;
      continue;
    }
    const esperadas = esperadasDe.get(texto(parte.operational_code));
    if (esperadas == null) {
      sinEsperadas += 1;
      continue;
    }
    const grupo = grupoDe(parte);
    const g = acumulado.get(grupo) ?? { aulas: 0, efectivas: 0, esperadas: 0, asistentes: 0 };
    g.aulas += 1;
    g.efectivas += efectivas;
    g.esperadas += esperadas;
    g.asistentes += asistentes;
    acumulado.set(grupo, g);
  }
  const todos = [...acumulado.values()];
  const totalEf = todos.reduce((s, g) => s + g.efectivas, 0);
  const totalEsp = todos.reduce((s, g) => s + g.esperadas, 0);
  const totalAulas = todos.reduce((s, g) => s + g.aulas, 0);
  const razonDelEstudio = totalEsp > 0 ? totalEf / totalEsp : null;
  // El prior en las mismas unidades: PESO_DEL_PRIOR aulas medias del estudio.
  const espPorAula = totalAulas ? totalEsp / totalAulas : 0;
  const grupos = [...acumulado.entries()].map(([grupo, g]): GrupoDeRendimiento => {
    const espPrior = PESO_DEL_PRIOR * espPorAula;
    return {
      grupo,
      ...g,
      razon: g.esperadas > 0 ? g.efectivas / g.esperadas : null,
      razonAjustada: razonDelEstudio != null && g.esperadas + espPrior > 0
        ? (g.efectivas + razonDelEstudio * espPrior) / (g.esperadas + espPrior)
        : null,
      deAsistentes: g.asistentes > 0 ? g.efectivas / g.asistentes : null,
      pocos: g.aulas < MINIMO_PARA_COMPARAR,
    };
  });
  return { grupos, razonDelEstudio, sinEsperadas, sinCifra };
}

/** «94 % de lo esperado». */
export function textoDeRazon(r: number | null): string {
  return r == null ? "—" : `${Math.round(r * 100)} %`;
}
