// GENERADO por scripts/generar-ranuras-iconos.mjs desde api/inst/estandar/estandar_pulso.json. No editar a mano.
// Ranuras en pulgadas de la lámina 13,333 × 7,5, tal cual las declara el estándar.

export type TipoRanuraEstandar = "grafico" | "texto" | "cifras";

export type RanuraEstandar = { tipo: TipoRanuraEstandar; x: number; y: number; w: number; h: number };

export const RANURAS_ESTANDAR: Readonly<Record<string, { nombre: string; ranuras: readonly RanuraEstandar[] }>> = {
  "p_slide_1_grafico": {
    nombre: "Un gráfico",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 4.6 },
    ],
  },
  "p_slide_1_grafico_narrativo": {
    nombre: "Un gráfico con narrativa",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 1.65, w: 12.523, h: 0.8 },
      { tipo: "grafico", x: 0.495, y: 2.6, w: 12.523, h: 3.7 },
    ],
  },
  "p_slide_grafico_texto_derecha": {
    nombre: "Gráfico con texto a la derecha",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 7.6, h: 4.6 },
      { tipo: "texto", x: 8.6, y: 1.9, w: 4.418, h: 3 },
    ],
  },
  "p_slide_grafico_texto_izquierda": {
    nombre: "Gráfico con texto a la izquierda",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 1.9, w: 4.2, h: 3 },
      { tipo: "grafico", x: 5.2, y: 1.65, w: 7.818, h: 4.6 },
    ],
  },
  "p_slide_texto": {
    nombre: "Texto",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 1.65, w: 12.523, h: 4.6 },
    ],
  },
  "p_slide_2_graficos": {
    nombre: "Dos gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 4.6 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 4.6 },
    ],
  },
  "p_slide_2_graficos_narrativo": {
    nombre: "Dos gráficos con narrativa",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 1.65, w: 12.523, h: 0.8 },
      { tipo: "grafico", x: 0.495, y: 2.6, w: 6.012, h: 3.7 },
      { tipo: "grafico", x: 7.007, y: 2.6, w: 6.012, h: 3.7 },
    ],
  },
  "p_slide_2_graficos_texto_izquierda": {
    nombre: "Dos gráficos con texto a la izquierda",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 1.9, w: 3.5, h: 3 },
      { tipo: "grafico", x: 4.4, y: 1.65, w: 4.2, h: 4.6 },
      { tipo: "grafico", x: 8.85, y: 1.65, w: 4.168, h: 4.6 },
    ],
  },
  "p_slide_2_graficos_texto_derecha": {
    nombre: "Dos gráficos con texto a la derecha",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 4.1, h: 4.6 },
      { tipo: "grafico", x: 4.85, y: 1.65, w: 4.1, h: 4.6 },
      { tipo: "texto", x: 9.25, y: 1.9, w: 3.768, h: 3 },
    ],
  },
  "p_slide_2_graficos_vertical": {
    nombre: "Dos gráficos apilados",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 12.523, h: 2.2 },
    ],
  },
  "p_slide_2_graficos_asimetrico": {
    nombre: "Gráfico principal y de apoyo",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 7.9, h: 4.6 },
      { tipo: "grafico", x: 8.85, y: 1.65, w: 4.168, h: 4.6 },
    ],
  },
  "p_slide_3_graficos_2mas1": {
    nombre: "Tres gráficos, dos apilados y uno alto",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 4.6 },
    ],
  },
  "p_slide_3_graficos_1mas2": {
    nombre: "Tres gráficos, uno alto y dos apilados",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 4.6 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 4.05, w: 6.012, h: 2.2 },
    ],
  },
  "p_slide_3_graficos_1arriba": {
    nombre: "Tres gráficos, uno ancho arriba",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 4.05, w: 6.012, h: 2.2 },
    ],
  },
  "p_slide_3_graficos_fila": {
    nombre: "Tres gráficos en fila",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 3.841, h: 4.6 },
      { tipo: "grafico", x: 4.836, y: 1.65, w: 3.841, h: 4.6 },
      { tipo: "grafico", x: 9.177, y: 1.65, w: 3.841, h: 4.6 },
    ],
  },
  "p_slide_3_graficos_poblacion_tira": {
    nombre: "Tres gráficos en tira",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 1.4 },
      { tipo: "grafico", x: 0.495, y: 3.25, w: 12.523, h: 1.4 },
      { tipo: "grafico", x: 0.495, y: 4.85, w: 12.523, h: 1.4 },
    ],
  },
  "p_slide_3_graficos_poblacion_corona": {
    nombre: "Tres gráficos en corona",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 4.6 },
    ],
  },
  "p_slide_4_graficos": {
    nombre: "Cuatro gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 4.05, w: 6.012, h: 2.2 },
    ],
  },
  "p_slide_5_graficos_poblacion": {
    nombre: "Cinco gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 4.836, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 9.177, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 6.012, h: 2.2 },
      { tipo: "grafico", x: 7.007, y: 4.05, w: 6.012, h: 2.2 },
    ],
  },
  "p_slide_6_graficos_poblacion": {
    nombre: "Seis gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 4.836, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 9.177, y: 1.65, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.05, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 4.836, y: 4.05, w: 3.841, h: 2.2 },
      { tipo: "grafico", x: 9.177, y: 4.05, w: 3.841, h: 2.2 },
    ],
  },
  "p_slide_3_graficos_poblacion_cifras": {
    nombre: "Cifras en columna lateral",
    ranuras: [
      { tipo: "cifras", x: 0.495, y: 1.65, w: 3, h: 4.6 },
      { tipo: "grafico", x: 3.9, y: 1.65, w: 4.4, h: 2.2 },
      { tipo: "grafico", x: 3.9, y: 4.05, w: 4.4, h: 2.2 },
      { tipo: "grafico", x: 8.75, y: 1.65, w: 4.268, h: 4.6 },
    ],
  },
  "p_slide_cifras_y_graficos": {
    nombre: "Cifras en banda superior",
    ranuras: [
      { tipo: "cifras", x: 0.495, y: 1.65, w: 12.523, h: 1.2 },
      { tipo: "grafico", x: 0.495, y: 3.05, w: 6.012, h: 3.2 },
      { tipo: "grafico", x: 7.007, y: 3.05, w: 6.012, h: 3.2 },
    ],
  },
};
