// Preguntas clave del estudio (H14 del checklist de usabilidad del editor, 2026-11-05). El analista marca en la tarjeta de
// cada gráfico qué preguntas importan y el motor propone a partir de ellas los hallazgos del resumen ejecutivo
// (api/R/graficos_hallazgos_resumen.R). Viven en `plan.preguntas_clave`: la referencia de la pregunta tal como la escribe
// el gráfico (`var` sin base o `base$var`). Vacía o ausente, ninguna. Puro, sin React.

import type { PlanJson, Slide } from "../../../../api/graficos";

/** La ayuda del interruptor, en la tarjeta del gráfico. */
export const AYUDA_CLAVE = "El resumen ejecutivo propone sus hallazgos a partir de las preguntas clave.";

/** Lo guardado, defensivo: R puede devolver una lista de uno como texto suelto y una vacía como `{}`. */
export function leerPreguntasClave(plan: Pick<PlanJson, "preguntas_clave"> | null | undefined): string[] {
  const crudo: unknown = plan?.preguntas_clave;
  const lista = Array.isArray(crudo) ? crudo : typeof crudo === "string" ? [crudo] : [];
  const vistas = new Set<string>();
  for (const v of lista) {
    if (typeof v !== "string") continue;
    const ref = v.trim();
    if (ref) vistas.add(ref);
  }
  return [...vistas];
}

export const esClave = (claves: readonly string[], ref: string): boolean => claves.includes(ref.trim());

/** La lista con `ref` marcada o desmarcada; el orden de marcado se conserva. */
export function conClave(claves: readonly string[], ref: string, marcada: boolean): string[] {
  const r = ref.trim();
  if (!r) return [...claves];
  const sin = claves.filter((c) => c !== r);
  return marcada ? [...sin, r] : sin;
}

/** Varias a la vez (todas las preguntas de una multiapilada). */
export function conClaves(claves: readonly string[], refs: readonly string[], marcadas: boolean): string[] {
  return refs.reduce<string[]>((acc, ref) => conClave(acc, ref, marcadas), [...claves]);
}

type Args = Readonly<Record<string, unknown>>;

/** Las citas son texto abierto: no dan una cifra que proponer. */
const SIN_CIFRA: ReadonlySet<string> = new Set(["p_citas"]);

/**
 * Las preguntas de un gráfico que se pueden marcar como clave: su `var` o, en las de varias preguntas, cada una de
 * `vars` como la escribe el gráfico. Las láminas de temas por público (`vars` como objeto) no se marcan desde aquí.
 */
export function preguntasDelGrafico(graficador: string, args: Args): string[] {
  if (SIN_CIFRA.has(graficador)) return [];
  const una = typeof args.var === "string" ? args.var.trim() : "";
  if (una) return [una];
  if (!Array.isArray(args.vars)) return [];
  const vistas = new Set<string>();
  for (const v of args.vars) {
    if (typeof v !== "string") continue;
    const ref = v.trim();
    if (ref) vistas.add(ref);
  }
  return [...vistas];
}

/** Cuántas de las preguntas del gráfico están marcadas. */
export const marcadasDe = (claves: readonly string[], refs: readonly string[]): number => refs.filter((r) => esClave(claves, r)).length;

/**
 * El primer gráfico del informe con una pregunta que marcar (y que `cuenta` acepta), como lámina y ranura (1-based): adonde lleva el aviso de la
 * propuesta cuando el estudio no tiene ninguna. `null` si el informe no tiene gráficos con pregunta.
 */
export function primerGraficoConPregunta(slides: readonly Slide[], slotsPorTipo: Readonly<Record<string, readonly string[]>>,
  cuenta: (tipoLamina: string, graficador: string, args: Args) => boolean = () => true): { id: string; ranura: number } | null {
  for (const s of slides) {
    const slots = slotsPorTipo[s.tipo] ?? [];
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    for (let i = 0; i < slots.length; i += 1) {
      const g = payload[slots[i]];
      if (!g || typeof g !== "object" || Array.isArray(g)) continue;
      const ref = g as { graficador?: unknown; args?: unknown };
      const args = ref.args && typeof ref.args === "object" && !Array.isArray(ref.args) ? (ref.args as Args) : {};
      if (typeof ref.graficador === "string" && preguntasDelGrafico(ref.graficador, args).length && cuenta(s.tipo, ref.graficador, args)) {
        return { id: s.id, ranura: i + 1 };
      }
    }
  }
  return null;
}

// ---- Qué gráficos cuentan -----------------------------------------------------------------------------------------
// Espejo de `.resumen_dif_preguntas_plan` (api/R/graficos_resumen_diferencias.R), que usan el resumen ejecutivo y el
// resumen de diferencias: una pregunta clave sólo entra a la propuesta si su gráfico es candidato. Lámina de un gráfico
// (con o sin texto narrativo), de barras o dicotómica, sin «Dividir por» y, si es una batería, con su Top Two Box.

const LAMINAS_CANDIDATAS: ReadonlySet<string> = new Set(["p_slide_1_grafico", "p_slide_1_grafico_narrativo"]);
const GRAFICOS_CANDIDATOS: ReadonlySet<string> = new Set(["p_barras_agrupadas", "p_barras_categoricas", "p_barras_multiapiladas", "p_dicotomica"]);

export type MotivoNoCuenta = "lamina" | "tipo" | "cruce" | "sin_two_box";

const lleno = (v: unknown): boolean =>
  typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.some((x) => typeof x === "string" && x.trim() !== "") : false;

/** Por qué las preguntas de este gráfico no entran al resumen ejecutivo; `null` si entran. */
export function motivoNoCuenta(p: { tipoLamina: string; graficador: string; args: Args; conTwoBox: boolean }): MotivoNoCuenta | null {
  if (!LAMINAS_CANDIDATAS.has(p.tipoLamina)) return "lamina";
  if (!GRAFICOS_CANDIDATOS.has(p.graficador)) return "tipo";
  const ov = p.args.overrides && typeof p.args.overrides === "object" && !Array.isArray(p.args.overrides) ? (p.args.overrides as Args) : {};
  if (lleno(p.args.cruces) || lleno(p.args.cruce) || lleno(ov.cruces)) return "cruce";
  if (preguntasDelGrafico(p.graficador, p.args).length > 1 && !p.conTwoBox) return "sin_two_box";
  return null;
}

export const TEXTO_NO_CUENTA: Readonly<Record<MotivoNoCuenta, string>> = {
  lamina: "Esta pregunta no entra al resumen ejecutivo: solo cuentan las láminas de un gráfico.",
  tipo: "Esta pregunta no entra al resumen ejecutivo: solo cuentan los gráficos de barras.",
  cruce: "Esta pregunta no entra al resumen ejecutivo: solo cuentan los gráficos sin «Dividir por».",
  sin_two_box: "Estas preguntas no entran al resumen ejecutivo: una batería cuenta solo con su Top Two Box.",
};
