// Compatibilidad de escalas de multi-apiladas, compartida entre el
// constructor (que avisa mientras editas) y el validador del plan (que
// bloquea el export).
//
// Vivían separados y esa fue justamente la falla medida: el constructor
// mostraba "Estas preguntas no comparten una escala compatible" en rojo
// mientras el toolbar decía "Plan listo" y el PPT salía con la lámina
// degradada a "Sin datos". Un solo criterio, dos consumidores.
//
// El criterio es la FIRMA de la lista (`código=etiqueta|…`), nunca su
// nombre: el importador de SurveyMonkey genera un `list_name` por pregunta
// (`lst_p9`, `lst_p13`, …), así que en un estudio real conviven decenas de
// nombres para un puñado de escalas — medido en Acreditación Contabilidad:
// 35 nombres distintos para 6 juegos de opciones en la base de docentes.

export type ScaleVar = {
  name: string;
  list_name?: string;
  scale_signature?: string;
  choices?: { name: string; label: string }[];
};

/** Rótulo del veredicto de escalas distintas que se grafican igual (una contiene a las demás). */
export const ESCALAS_DISTINTAS = "Cada público con su escala";

export type ScaleTone = "idle" | "ok" | "warning" | "error";

export type ScaleVerdict = {
  tone: ScaleTone;
  /** Etiqueta corta para el chip de síntesis. */
  label: string;
  /** Frase completa para el aviso bajo el campo. */
  message: string;
};

export function scaleKeyOf(v: ScaleVar | undefined): string {
  if (!v) return "";
  return v.scale_signature || v.list_name || "";
}

/**
 * Nombra una escala por lo que el analista reconoce —sus categorías— y no
 * por el `list_name`, que es un identificador técnico por pregunta.
 */
export function describeScale(v: ScaleVar | undefined): string {
  const choices = v?.choices ?? [];
  const labels = choices
    .map((c) => (c?.label ?? c?.name ?? "").trim())
    .filter((label) => label.length > 0);
  if (!labels.length) return "escala sin categorías declaradas";
  if (labels.length <= 3) return labels.join(" / ");
  return `${labels[0]} … ${labels[labels.length - 1]} (${labels.length} categorías)`;
}

/**
 * Decide si un conjunto de referencias puede ir en un mismo bloque apilado.
 * `resolve` traduce una ref (`base$pregunta` o `pregunta`) a su variable.
 */
export function evaluateScaleCompat(
  refs: string[],
  resolve: (ref: string) => ScaleVar | undefined,
): ScaleVerdict {
  if (!refs.length) {
    return {
      tone: "idle",
      label: "Escala por detectar",
      message: "Cuando elijas preguntas, se revisará si comparten escala.",
    };
  }
  const found = refs.map(resolve);
  if (found.some((v) => !v)) {
    return {
      tone: "warning",
      label: "Variables por revisar",
      message: "Hay variables que no aparecen en el instrumento cargado.",
    };
  }
  const keys = found.map(scaleKeyOf).filter(Boolean);
  if (!keys.length) {
    return {
      tone: "warning",
      label: "Escala no detectada",
      message: "No se detectó escala en estas preguntas. El preview confirmará si esta combinación se puede graficar.",
    };
  }
  const unique = Array.from(new Set(keys));
  // Cada público con su escala (Gonzalo, 2026-10-14): si una escala contiene las respuestas de las demás, el motor
  // dibuja sobre ella y cada fila con la suya (api/R/graficos_escala_union.R). Mismo criterio aquí.
  if (unique.length > 1 && escalaQueContiene(found)) {
    // Es un respaldo y no lo normal (Gonzalo: «lo ideal es que tengan la misma»): se grafica, pero avisa.
    return {
      tone: "warning",
      label: ESCALAS_DISTINTAS,
      message: `Las preguntas usan escalas distintas (${describeDistinctScales(found)}). Cada fila sale con la suya, pero lo habitual es que una premisa tenga la misma escala en todos los públicos: revisa el instrumento.`,
    };
  }
  if (unique.length > 1) {
    const escalas = describeDistinctScales(found);
    return {
      tone: "error",
      label: "Escalas distintas",
      message: `Estas preguntas no comparten una escala compatible: ${escalas}. Usa Combinar bloques si necesitas mezclar escalas.`,
    };
  }
  const first = found.find(Boolean);
  return {
    tone: "ok",
    label: describeScale(first),
    message: `Estas preguntas comparten escala: ${describeScale(first)}.`,
  };
}

// Espejo de `.norm_label_scale` y `.es_categoria_especial` (reporte_plan_ppt.R).
const normEtiqueta = (x: string) => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ");
const ESPECIALES = new Set(["sin inf", "sin informacion", "ns nr", "no sabe", "no responde", "no sabe no responde", "no aplica", "no precisa"]);
const esEspecial = (c: { name: string; label: string }) =>
  ["90", "94", "95", "96", "97", "98", "99"].includes(String(c.name).trim()) || ESPECIALES.has(normEtiqueta(c.label ?? ""));

/**
 * ¿Hay una escala que contiene las respuestas de todas las demás? Por etiqueta normalizada y sin las especiales (SIN
 * INF), cuyas etiquetas deben existir en la mayor. Espejo de `.escala_union_spec` (api/R/graficos_escala_union.R).
 */
export function escalaQueContiene(found: (ScaleVar | undefined)[]): boolean {
  const escalas = found.map((v) => v?.choices ?? []);
  if (!escalas.length || escalas.some((c) => !c.length)) return false;
  const sustantivas = escalas.map((c) => new Set(c.filter((x) => !esEspecial(x)).map((x) => normEtiqueta(x.label ?? x.name))));
  const mayor = escalas.findIndex((_, i) => sustantivas.every((o) => [...o].every((e) => sustantivas[i].has(e))));
  if (mayor < 0) return false;
  const todas = new Set(escalas[mayor].map((x) => normEtiqueta(x.label ?? x.name)));
  return escalas.every((c) => c.filter(esEspecial).every((x) => todas.has(normEtiqueta(x.label ?? x.name))));
}

/** Enumera las escalas en conflicto por sus categorías, sin repetir. */
function describeDistinctScales(found: (ScaleVar | undefined)[]): string {
  const seen = new Map<string, string>();
  for (const v of found) {
    const key = scaleKeyOf(v);
    if (!key || seen.has(key)) continue;
    seen.set(key, describeScale(v));
  }
  return Array.from(seen.values()).join(" vs ");
}

/**
 * Grupos de refs que el renderer exige homogéneos dentro de un mismo
 * gráfico de multi-apiladas. Devuelve un grupo por bloque apilado, porque
 * `multilista` existe justamente para mezclar escalas ENTRE bloques: cada
 * bloque se valida solo contra sí mismo.
 */
export function multiApiladasScaleGroups(args: Record<string, unknown>): string[][] {
  const modo = typeof args.modo === "string" ? args.modo : "";

  if (modo === "multilista") {
    const bloques = Array.isArray(args.bloques) ? args.bloques : [];
    return bloques.flatMap((block) => (
      block && typeof block === "object" && !Array.isArray(block)
        ? multiApiladasScaleGroups(block as Record<string, unknown>)
        : []
    ));
  }

  // `cruce` apila las opciones de UNA pregunta: no hay nada que conciliar.
  if (modo === "cruce") return [];

  const vars = args.vars;
  if (Array.isArray(vars)) {
    const refs = vars.filter((v): v is string => typeof v === "string" && v.length > 0);
    return refs.length > 1 ? [refs] : [];
  }
  // "Comparar públicos por tema": `vars` es {tema: [refs]}. Cada tema es su
  // propio bloque… pero `var_cruce` los apila con una escala común, así que
  // el conjunto entero debe conciliar.
  if (vars && typeof vars === "object") {
    const refs = Object.values(vars as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    return refs.length > 1 ? [refs] : [];
  }
  return [];
}
