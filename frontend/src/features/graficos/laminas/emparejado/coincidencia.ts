// Coincidencia entre los dos textos de un par en «Revisar emparejado» (ADR 0135 §7). La sugerencia del backend trae un
// puntaje (Jaccard sobre palabras normalizadas, mínimo 0,2); aquí se lee en tres clases para que el analista vea de un
// vistazo qué par es la misma pregunta y cuál sólo comparte palabras:
//   - Idéntico: el texto normalizado es igual o el puntaje es 1.
//   - Parecido: puntaje de 0,5 o más.
//   - Distinto: el resto.
// Un par de la matriz o confirmado a mano no trae puntaje del motor: se mide con las mismas palabras que el backend
// (`.equiv_sugerir_tokens` en graficos_emparejado_sugerido.R).

import type { PreguntaDeBase } from "../../../../api/graficosEmparejado";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { FilaEmparejado } from "./modeloEmparejado";

export type Coincidencia = "identico" | "parecido" | "distinto";
export type FiltroCoincidencia = "todas" | Coincidencia;

/** Puntaje desde el que un par es idéntico aunque el texto difiera (mismas palabras, otro orden o con vacías). */
export const UMBRAL_IDENTICO = 1;
/** Puntaje desde el que un par es parecido. */
export const UMBRAL_PARECIDO = 0.5;

export const COINCIDENCIAS: readonly Coincidencia[] = ["identico", "parecido", "distinto"];

export const ROTULO_COINCIDENCIA: Record<Coincidencia, string> = {
  identico: "Idéntico",
  parecido: "Parecido",
  distinto: "Distinto",
};

// Las mismas palabras vacías que `.EMPAREJADO_VACIAS` del backend.
const VACIAS = new Set([
  "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "le", "les", "lo", "los", "me", "mi",
  "o", "para", "por", "que", "se", "su", "sus", "te", "tu", "u", "un", "una", "uno", "y", "ya",
]);

/** Sin tildes, en minúsculas, sin signos y con un espacio entre palabras. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Las palabras de un enunciado para compararlo: normalizadas, sin vacías y sin repetir. */
export function palabrasDe(texto: string): string[] {
  const t = normalizarTexto(texto);
  return t ? [...new Set(t.split(" ").filter((p) => p && !VACIAS.has(p)))] : [];
}

/** Jaccard entre las palabras de los dos textos, con tres decimales (como el backend). */
export function parecidoDeTexto(a: string, b: string): number {
  const pa = new Set(palabrasDe(a));
  const pb = new Set(palabrasDe(b));
  const union = new Set([...pa, ...pb]).size;
  if (!union) return 0;
  const comunes = [...pa].filter((p) => pb.has(p)).length;
  return Math.round((comunes / union) * 1000) / 1000;
}

export function clasificarCoincidencia(a: string, b: string, puntaje: number): Coincidencia {
  const na = normalizarTexto(a);
  if ((na && na === normalizarTexto(b)) || puntaje >= UMBRAL_IDENTICO) return "identico";
  return puntaje >= UMBRAL_PARECIDO ? "parecido" : "distinto";
}

export type CoincidenciaDePar = {
  clase: Coincidencia;
  puntaje: number;
  /** `motor`: el puntaje vino con la sugerencia; `texto`: se midió aquí. */
  origen: "motor" | "texto";
};

/** El puntaje del motor para el par de la fila: el de la sugerencia mostrada o el de la candidata que coincide. */
function puntajeDelMotor(fila: FilaEmparejado, par: PreguntaDeBase): number | null {
  if (fila.puntaje !== null) return fila.puntaje;
  const s = fila.pregunta.sugerencias.find((x) => x.base === par.base && x.var === par.var);
  return s ? s.puntaje : null;
}

/** La coincidencia de una fila con par; `null` sin par. */
export function coincidenciaDeFila(fila: FilaEmparejado): CoincidenciaDePar | null {
  const par = fila.par;
  if (!par) return null;
  const motor = puntajeDelMotor(fila, par);
  const puntaje = motor ?? parecidoDeTexto(fila.pregunta.etiqueta, par.etiqueta);
  return { clase: clasificarCoincidencia(fila.pregunta.etiqueta, par.etiqueta, puntaje), puntaje, origen: motor === null ? "texto" : "motor" };
}

export function coincidenciasDe(filas: readonly FilaEmparejado[]): Map<string, CoincidenciaDePar | null> {
  return new Map(filas.map((f) => [f.clave, coincidenciaDeFila(f)]));
}

export type ConteoCoincidencia = Record<FiltroCoincidencia, number>;

/** Cuántas filas hay en cada clase; `todas` cuenta también las filas sin par. */
export function contarCoincidencias(
  filas: readonly FilaEmparejado[],
  mapa: ReadonlyMap<string, CoincidenciaDePar | null>,
): ConteoCoincidencia {
  const c: ConteoCoincidencia = { todas: filas.length, identico: 0, parecido: 0, distinto: 0 };
  for (const f of filas) {
    const clase = mapa.get(f.clave)?.clase;
    if (clase) c[clase] += 1;
  }
  return c;
}

export function filtrarPorCoincidencia(
  filas: readonly FilaEmparejado[],
  mapa: ReadonlyMap<string, CoincidenciaDePar | null>,
  filtro: FiltroCoincidencia,
): FilaEmparejado[] {
  return filtro === "todas" ? [...filas] : filas.filter((f) => mapa.get(f.clave)?.clase === filtro);
}

export function rotuloFiltroCoincidencia(filtro: FiltroCoincidencia, c: ConteoCoincidencia): string {
  return `${filtro === "todas" ? "Todas" : ROTULO_COINCIDENCIA[filtro]} (${formatoConteo(c[filtro])})`;
}

/** «Palabras en común 62%». */
export function textoPuntaje(puntaje: number): string {
  return `Palabras en común ${Math.round(puntaje * 100)}%`;
}
