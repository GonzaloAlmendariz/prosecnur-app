import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Cuántas mujeres y cuántos hombres declara el padrón de un curso-horario.
 *
 * **`sex_top_1` es el sexo MÁS FRECUENTE, no «mujeres».** El motor guarda la
 * tabla de frecuencias del sexo en el marco y publica sus dos primeras
 * entradas: `sex_top_1` es la etiqueta de la mayoritaria —«F» o «M»— y
 * `sex_top_1_n` su conteo. Leerlo como si el primero fuera siempre mujeres
 * invierte la composición en la mitad de las aulas, y ésa es una confusión que
 * este perfil ya pagó una vez.
 *
 * Vive en su propio módulo porque lo leen dos sitios —la puntuación de ayuda de
 * un candidato y el chip que la enseña— y dos lecturas del mismo campo acaban
 * separándose. El vocabulario «F»/«M» es el mismo que fija `etiquetaDeSexo`.
 */
export type ComposicionDelAula = { mujeres: number; hombres: number; total: number };

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function composicionDelAula(
  fila: (MonitoreoAulasPlanRow & {
    sex_top_1?: string; sex_top_1_n?: number; sex_top_2?: string; sex_top_2_n?: number;
  }) | null | undefined,
): ComposicionDelAula {
  const n1 = numero(fila?.sex_top_1_n);
  const n2 = numero(fila?.sex_top_2_n);
  const dominante = String(fila?.sex_top_1 ?? "").trim().toUpperCase();
  // Sin etiqueta reconocible no se reparte: publicar un cero por sexo diría que
  // el aula no tiene mujeres, cuando lo que pasa es que no se sabe.
  if (dominante !== "F" && dominante !== "M") {
    return { mujeres: 0, hombres: 0, total: n1 + n2 };
  }
  const mujeres = dominante === "F" ? n1 : n2;
  const hombres = dominante === "F" ? n2 : n1;
  return { mujeres, hombres, total: mujeres + hombres };
}
