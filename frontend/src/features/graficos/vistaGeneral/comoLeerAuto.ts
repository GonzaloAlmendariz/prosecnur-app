// «Cómo leer este informe» en modo automático: espejo puro de `.word_como_leer_auto`
// (api/R/reporte_word_como_leer_auto.R). Cada sección que depende de un recurso (Top Two Box, Bottom Two Box, una misma
// escala, cifras pequeñas) entra solo si el recurso aparece en >= 2 láminas; Redondeo y Bases chicas acompañan solo si
// alguna de esas cuatro entra; si ninguna entra, el capítulo se omite (lista vacía).
//
// APROXIMACIONES de la vista previa (el R mide sobre el PPT real con datos):
//  · láminas: una ranura de gráfico cuenta como 1 lámina; no se replica la partición `.word_particion_ppt` (gráficos
//    partidos en varias láminas), así que un gráfico partido puede quedar subcontado aquí.
//  · cifras pequeñas: el R lo decide por el ancho de barra de cada segmento (`.lam_tiene_peq`, barra de 7 in), que
//    necesita los datos; la maqueta no los tiene, por eso el llamador pasa 0 y la sección no se propone.

export type ClaveComoLeer = "top_two_box" | "bottom_two_box" | "redondeo" | "misma_escala" | "cifras_pequenas" | "bases_chicas";

export type ConteoComoLeer = { escala: number; topTwoBox: number; bottomTwoBox: number; cifrasPequenas: number };

export const MIN_LAMINAS_COMO_LEER = 2;

export const ROTULO_COMO_LEER: Record<ClaveComoLeer, string> = {
  top_two_box: "Top Two Box",
  bottom_two_box: "Bottom Two Box",
  redondeo: "Redondeo de las cifras",
  misma_escala: "Una misma escala, muchas redacciones",
  cifras_pequenas: "Cifras muy pequeñas",
  bases_chicas: "Bases chicas e información faltante",
};

export function comoLeerAuto(n: ConteoComoLeer): ClaveComoLeer[] {
  if (n.escala < 1) return [];
  const ok = (v: number) => v >= MIN_LAMINAS_COMO_LEER;
  const top = ok(n.topTwoBox), bottom = ok(n.bottomTwoBox), misma = ok(n.escala), peq = ok(n.cifrasPequenas);
  if (!(top || bottom || misma || peq)) return [];
  return [
    ...(top ? ["top_two_box" as const] : []), ...(bottom ? ["bottom_two_box" as const] : []),
    "redondeo",
    ...(misma ? ["misma_escala" as const] : []), ...(peq ? ["cifras_pequenas" as const] : []),
    "bases_chicas",
  ];
}
