/**
 * La memoria de cálculo llega del motor como texto plano con Unicode
 * (`calc_muestra_general_memoria`, R). Aquí se traduce cada fórmula conocida a
 * LaTeX para pintarla con `FormulaLatex`, y se arman los términos del glosario
 * con el valor vivo del estudio. Una fórmula que no se reconoce no se inventa:
 * `latexDeFormula` devuelve `null` y la vista la pinta tal cual llegó.
 */
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { fmtInt, safeNumber } from "../sharedCore";
import type { FormulaTermino } from "../universidad/ui";

/** Quita espacios y unifica el signo menos para comparar sin fragilidad. */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, "").replace(/−/g, "-");
}

const FORMULAS: ReadonlyArray<{ texto: string; latex: string }> = [
  {
    texto: "n0 = z² · p · (1 − p) · deff / e²",
    latex: String.raw`n_0 = \frac{z^2\, p\,(1-p)\,\mathit{deff}}{e^2}`,
  },
  {
    texto: "n = n0 / (1 + (n0 − 1) / N)",
    latex: String.raw`n = \frac{n_0}{1 + \dfrac{n_0 - 1}{N}}`,
  },
  {
    texto: "n objetivo = n (o la meta declarada, si la hay)",
    latex: String.raw`n_{\text{obj}} = n \quad \text{(o la meta declarada)}`,
  },
  {
    texto: "⌈n objetivo / tasa de respuesta⌉",
    latex: String.raw`n_{\text{abordar}} = \left\lceil \frac{n_{\text{obj}}}{\text{tasa de respuesta}} \right\rceil`,
  },
  {
    texto: "mín(casos a abordar + ⌈casos · sobremuestra⌉, N)",
    latex: String.raw`n_{\text{campo}} = \min\!\left(n_{\text{abordar}} + \lceil n_{\text{abordar}} \cdot s \rceil,\; N\right)`,
  },
  {
    texto: "casos a abordar + ⌈casos · sobremuestra⌉, con tope en N",
    latex: String.raw`n_{\text{campo}} = \min\!\left(n_{\text{abordar}} + \lceil n_{\text{abordar}} \cdot s \rceil,\; N\right)`,
  },
  {
    texto: "e = z · √(p(1 − p) · deff · (N − n) / (n (N − 1)))",
    latex: String.raw`e = z \sqrt{\frac{p\,(1-p)\,\mathit{deff}\,(N-n)}{n\,(N-1)}}`,
  },
  {
    texto: "Σ W_h · p_h(1 − p_h) · deff",
    latex: String.raw`V = \sum_h W_h\, p_h\,(1-p_h)\,\mathit{deff}`,
  },
  {
    texto: "(Σ W_h · S_h)², con S_h² = p_h(1 − p_h) · deff",
    latex: String.raw`V = \Big(\sum_h W_h S_h\Big)^2, \qquad S_h^2 = p_h\,(1-p_h)\,\mathit{deff}`,
  },
  {
    texto: "Σ W_h² S_h² / a_h (asignación de potencia, Bankier)",
    latex: String.raw`V = \sum_h \frac{W_h^2 S_h^2}{a_h}`,
  },
  {
    texto: "n = varianza / ((e / z)² + Σ W_h S_h² / N)",
    latex: String.raw`n = \frac{V}{(e/z)^2 + \frac{1}{N}\sum_h W_h S_h^2}`,
  },
  {
    texto: "e = z · √(Σ W_h² S_h² (1 − n_h / N_h) / n_h), con el reparto efectivo",
    latex: String.raw`e = z \sqrt{\sum_h \frac{W_h^2 S_h^2\,(1 - n_h/N_h)}{n_h}}`,
  },
  {
    texto: "n0 = z² · CV² · deff / r²",
    latex: String.raw`n_0 = \frac{z^2\, CV^2\,\mathit{deff}}{r^2}`,
  },
  {
    texto: "r = z · CV · √(deff · (N − n) / (n (N − 1)))",
    latex: String.raw`r = z\, CV \sqrt{\frac{\mathit{deff}\,(N-n)}{n\,(N-1)}}`,
  },
];

const POR_TEXTO = new Map(FORMULAS.map((f) => [normalizar(f.texto), f.latex]));

/** LaTeX de una fórmula del motor, o `null` si no se reconoce. */
export function latexDeFormula(formula: string): string | null {
  if (!formula.trim()) return null;
  return POR_TEXTO.get(normalizar(formula)) ?? null;
}

function num(valor: unknown, decimales = 3): string | undefined {
  const n = safeNumber(valor, NaN);
  if (!Number.isFinite(n)) return undefined;
  return String(Number(n.toFixed(decimales)));
}

/**
 * Los términos del glosario que usa la memoria, con el valor de este estudio.
 * El `termino` es el prefijo con que `TerminoChip` busca en el GLOSARIO.
 */
export function terminosDeMemoria(comp: Pick<CalcMuestraComponente, "parametros" | "marco" | "tecnica">): FormulaTermino[] {
  const p = comp.parametros;
  const media = p?.tipo_indicador === "media";
  const N = safeNumber(comp.marco?.marco_validado, 0);
  const terminos: FormulaTermino[] = [
    { symbol: "z", termino: "nivel de confianza", value: num(p?.z) },
    media
      ? { symbol: "CV", termino: "coeficiente de variación", value: num(p?.cv) }
      : { symbol: "p", termino: "p (", value: num(p?.p) },
    { symbol: media ? "r" : "e", termino: "margen de error", value: num(p?.e, 4) },
  ];
  // El MAS y el sistemático no llevan efecto de diseño: el motor usa 1.
  if (comp.tecnica !== "prob_aleatorio_simple" && comp.tecnica !== "sistematico") {
    terminos.push({ symbol: "deff", termino: "deff", value: num(p?.deff) });
  }
  terminos.push(
    { symbol: "N", termino: "población objetivo", value: N > 0 ? fmtInt(N) : undefined },
    { symbol: "s", termino: "sobremuestra", value: num(p?.oversample_pct) },
  );
  if (comp.tecnica === "prob_estratificado") terminos.push({ symbol: "W_h", termino: "estrato" });
  return terminos;
}
