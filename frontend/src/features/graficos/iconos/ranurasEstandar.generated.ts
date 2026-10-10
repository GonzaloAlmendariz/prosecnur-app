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
      { tipo: "grafico", x: 0.495, y: 1.65, w: 8.6, h: 4.6 },
      { tipo: "texto", x: 9.55, y: 2.45, w: 3.468, h: 3.4 },
    ],
  },
  "p_slide_grafico_texto_izquierda": {
    nombre: "Gráfico con texto a la izquierda",
    ranuras: [
      { tipo: "texto", x: 0.495, y: 2.05, w: 3.45, h: 3.4 },
      { tipo: "grafico", x: 4.55, y: 1.75, w: 8.4, h: 4.5 },
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
      { tipo: "texto", x: 0.495, y: 2.05, w: 3.45, h: 3.6 },
      { tipo: "grafico", x: 4.55, y: 1.7, w: 8.468, h: 1.6 },
      { tipo: "grafico", x: 4.55, y: 3.7, w: 8.468, h: 2.55 },
    ],
  },
  "p_slide_2_graficos_texto_derecha": {
    nombre: "Dos gráficos con texto a la derecha",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.7, w: 8.6, h: 1.9 },
      { tipo: "grafico", x: 0.495, y: 3.8, w: 8.6, h: 2.45 },
      { tipo: "texto", x: 9.55, y: 2.05, w: 3.468, h: 3.4 },
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
      { tipo: "grafico", x: 0.495, y: 1.6, w: 8.4, h: 4.65 },
      { tipo: "grafico", x: 9.35, y: 1.6, w: 3.668, h: 4.65 },
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
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 1.65 },
      { tipo: "grafico", x: 7.007, y: 3.7, w: 6.012, h: 2.55 },
    ],
  },
  "p_slide_3_graficos_1arriba": {
    nombre: "Tres gráficos, uno ancho arriba",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.6, w: 12.523, h: 2.25 },
      { tipo: "grafico", x: 0.495, y: 4.2, w: 6.012, h: 2.05 },
      { tipo: "grafico", x: 7.007, y: 4.2, w: 6.012, h: 2.05 },
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
      { tipo: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 1.18 },
      { tipo: "grafico", x: 0.495, y: 3.33, w: 12.523, h: 1.18 },
      { tipo: "grafico", x: 0.495, y: 5.01, w: 12.523, h: 1.24 },
    ],
  },
  "p_slide_3_graficos_poblacion_corona": {
    nombre: "Tres gráficos en corona",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 5.862, h: 2.15 },
      { tipo: "grafico", x: 7.157, y: 1.65, w: 5.862, h: 2.15 },
      { tipo: "grafico", x: 0.495, y: 4.2, w: 12.523, h: 2.17 },
    ],
  },
  "p_slide_4_graficos": {
    nombre: "Cuatro gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 6.012, h: 2.31 },
      { tipo: "grafico", x: 7.007, y: 1.65, w: 6.012, h: 2.31 },
      { tipo: "grafico", x: 0.495, y: 4.36, w: 6.012, h: 1.89 },
      { tipo: "grafico", x: 7.007, y: 4.36, w: 6.012, h: 1.89 },
    ],
  },
  "p_slide_5_graficos_poblacion": {
    nombre: "Cinco gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 3.908, h: 2.285 },
      { tipo: "grafico", x: 4.803, y: 1.65, w: 3.908, h: 2.285 },
      { tipo: "grafico", x: 9.11, y: 1.65, w: 3.908, h: 2.285 },
      { tipo: "grafico", x: 0.495, y: 4.335, w: 5.862, h: 1.915 },
      { tipo: "grafico", x: 7.157, y: 4.335, w: 5.862, h: 1.915 },
    ],
  },
  "p_slide_6_graficos_poblacion": {
    nombre: "Seis gráficos",
    ranuras: [
      { tipo: "grafico", x: 0.495, y: 1.65, w: 3.908, h: 2.2 },
      { tipo: "grafico", x: 4.803, y: 1.65, w: 3.908, h: 2.2 },
      { tipo: "grafico", x: 9.11, y: 1.65, w: 3.908, h: 2.2 },
      { tipo: "grafico", x: 0.495, y: 4.5, w: 3.908, h: 1.75 },
      { tipo: "grafico", x: 4.803, y: 4.5, w: 3.908, h: 1.75 },
      { tipo: "grafico", x: 9.11, y: 4.5, w: 3.908, h: 1.75 },
    ],
  },
  "p_slide_3_graficos_poblacion_cifras": {
    nombre: "Cifras en columna lateral",
    ranuras: [
      { tipo: "cifras", x: 0.495, y: 1.65, w: 3, h: 4.6 },
      { tipo: "grafico", x: 3.945, y: 1.65, w: 4.312, h: 1.75 },
      { tipo: "grafico", x: 3.945, y: 3.75, w: 4.312, h: 2.5 },
      { tipo: "grafico", x: 8.706, y: 1.65, w: 4.312, h: 4.6 },
    ],
  },
  "p_slide_cifras_y_graficos": {
    nombre: "Cifras en banda superior",
    ranuras: [
      { tipo: "cifras", x: 0.495, y: 1.65, w: 12.523, h: 1.2 },
      { tipo: "grafico", x: 0.495, y: 3.25, w: 6.012, h: 3 },
      { tipo: "grafico", x: 7.007, y: 3.25, w: 6.012, h: 3 },
    ],
  },
};
