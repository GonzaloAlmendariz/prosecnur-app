import type { MonitoreoRow } from "../../../../api/monitoreo";
import { fechaDeAplicacion } from "./ritmoPorFacultad";

/**
 * Cuándo se termina de aplicar el plan, al ritmo que se lleva.
 *
 * **Por qué se proyectan AULAS y no respuestas.** La meta del estudio está en
 * respuestas atribuidas a un curso-horario, y sobre este corte hay **cero**: las
 * respuestas llegan anónimas. El parte de campo sí cuenta encuestas —4 863 en 10
 * días— pero ésas no son las mismas que la meta mide, e incluyen las aulas
 * extra. Proyectar una serie contra una meta de otro universo daría una fecha de
 * cierre inventada, que es el error más caro que podría cometer esta pantalla.
 *
 * Las aulas, en cambio, viven en un solo universo: el plan tiene 196, el parte
 * dice cuáles se aplicaron y cuándo. La pregunta «¿en qué semana cerramos?» se
 * contesta ahí sin mezclar escalas.
 *
 * **No inventa el futuro**: proyecta el ritmo ya observado y devuelve una banda,
 * nunca un punto. Si no hay días suficientes, lo dice y no proyecta.
 */

export type PronosticoDeCierre = {
  /** Lo observado, acumulado día a día: es la línea sólida del gráfico. */
  serie: Array<{ fecha: string; aulas: number; acumulado: number }>;
  /** Aulas del plan que hay que aplicar. */
  universo: number;
  aplicadas: number;
  faltan: number;
  /** Días del rango en los que se aplicó alguna aula. */
  diasConCampo: number;
  /** Aulas por día con campo: la mediana de lo observado. */
  ritmo: number | null;
  /** El más lento y el más rápido de los días observados, para la banda. */
  ritmoLento: number | null;
  ritmoRapido: number | null;
  /** Días de campo que faltarían al ritmo mediano, lento y rápido. */
  diasQueFaltan: number | null;
  diasLento: number | null;
  diasRapido: number | null;
  /** La última fecha con campo, desde la que se cuenta hacia adelante. */
  ultimaFecha: string;
  /** Por qué no se puede proyectar, cuando no se puede. */
  motivo: "" | "sin-dias" | "pocos-dias" | "ya-cerrado" | "sin-ritmo";
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round(((o[m - 1] + o[m]) / 2) * 10) / 10;
}

/**
 * @param partes filas del parte YA unidas a su facultad.
 * @param plan el plan; el banco NO cuenta: los extras no son aulas que haya que
 *   aplicar para cerrar, son respaldo del estrato.
 */
export function pronosticoDeCierre(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow>,
): PronosticoDeCierre {
  const delPlan = new Set<string>();
  for (const fila of plan) {
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const codigo = texto(fila.operational_code);
    if (codigo) delPlan.add(codigo);
  }

  // Una aula se cuenta el día de su parte, y UNA sola vez: dos partes de la
  // misma aula no son dos aulas aplicadas.
  const diaPorAula = new Map<string, string>();
  for (const fila of partes) {
    const codigo = texto(fila.operational_code);
    if (!codigo || !delPlan.has(codigo)) continue;
    const fecha = fechaDeAplicacion(fila.applied_at ?? fila.applied_date);
    if (!fecha) continue;
    const previa = diaPorAula.get(codigo);
    if (!previa || fecha < previa) diaPorAula.set(codigo, fecha);
  }

  const porDia = new Map<string, number>();
  for (const fecha of diaPorAula.values()) porDia.set(fecha, (porDia.get(fecha) ?? 0) + 1);
  const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const universo = delPlan.size;
  const aplicadas = diaPorAula.size;
  const faltan = Math.max(0, universo - aplicadas);
  let corrido = 0;
  const serie = dias.map(([fecha, n]) => {
    corrido += n;
    return { fecha, aulas: n, acumulado: corrido };
  });
  const base = {
    serie,
    universo, aplicadas, faltan,
    diasConCampo: dias.length,
    ritmo: null, ritmoLento: null, ritmoRapido: null,
    diasQueFaltan: null, diasLento: null, diasRapido: null,
    ultimaFecha: dias.length ? dias[dias.length - 1][0] : "",
  };

  if (!dias.length) return { ...base, motivo: "sin-dias" };
  if (!faltan) return { ...base, motivo: "ya-cerrado" };
  // Con menos de tres días con campo, el «ritmo» es un accidente: dos días
  // buenos seguidos darían una fecha de cierre que nadie puede sostener.
  if (dias.length < 3) return { ...base, motivo: "pocos-dias" };

  const conteos = dias.map(([, n]) => n);
  const ritmo = mediana(conteos);
  const ritmoLento = Math.min(...conteos);
  const ritmoRapido = Math.max(...conteos);
  if (ritmo <= 0) return { ...base, motivo: "sin-ritmo" };

  return {
    ...base,
    ritmo, ritmoLento, ritmoRapido,
    diasQueFaltan: Math.ceil(faltan / ritmo),
    // La banda va al revés de lo que parece: el ritmo LENTO da los días MÁS
    // lejanos.
    diasLento: ritmoLento > 0 ? Math.ceil(faltan / ritmoLento) : null,
    diasRapido: ritmoRapido > 0 ? Math.ceil(faltan / ritmoRapido) : null,
    motivo: "",
  };
}

/**
 * Suma días DE CAMPO a una fecha. **El único día que no se aplica es el domingo.**
 *
 * Saltaba también el sábado, y la justificación era una inferencia sobre los
 * huecos del fixture —«dos días en blanco cada cinco»—. Gonzalo, que lleva el
 * operativo, lo dice al revés: «el único día que no se hace campo es el
 * domingo». Un hueco en el dato no prueba que ese día no se trabaje; prueba que
 * ese día no hay dato, que es justo lo que un fixture sintético produce por
 * construcción. **La regla la pone quien lleva el campo, no la forma del
 * fixture.**
 *
 * Y con esto el pronóstico deja de irse largo: saltando dos días por semana en
 * vez de uno, una proyección de un mes empujaba el cierre unos cuatro días más
 * tarde de lo real.
 */
export function sumarDiasDeCampo(iso: string, dias: number): string {
  // En UTC, como el eje del gráfico: con hora local, `toISOString()` devuelve el
  // día anterior en cualquier zona al este de Greenwich.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || dias <= 0) return iso;
  let quedan = dias;
  // Tope de seguridad: un `dias` corrupto no debe colgar la vista.
  for (let i = 0; quedan > 0 && i < 3000; i += 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) quedan -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Días de campo entre dos fechas, sin contar el `desde` y contando el `hasta`.
 *
 * Misma regla del domingo que `sumarDiasDeCampo`, y por eso vive aquí: en
 * `01c0163d` una segunda copia de los tramos en otro archivo se desincronizó y
 * «Sin agendar» acabó sin contener una sola aula sin agendar.
 */
export function diasDeCampoEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`);
  const b = new Date(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
  let n = 0;
  for (let i = 0; i < 3000; i += 1) {
    a.setUTCDate(a.getUTCDate() + 1);
    if (a > b) break;
    if (a.getUTCDay() !== 0) n += 1;
  }
  return n;
}

/** El inverso de `sumarDiasDeCampo`: cuenta hacia atrás saltando domingos. */
export function restarDiasDeCampo(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || dias <= 0) return iso;
  let quedan = dias;
  for (let i = 0; quedan > 0 && i < 3000; i += 1) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0) quedan -= 1;
  }
  return d.toISOString().slice(0, 10);
}
