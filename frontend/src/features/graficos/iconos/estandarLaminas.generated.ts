// GENERADO desde api/inst/estandar/estandar_pulso.json (`ppt.tipos_lamina`): para qué se usa cada tipo y la familia
// tipográfica que el compositor le aplica. Las ranuras viven en ranurasEstandar.generated.ts. No editar a mano:
// generados.contract.test.ts falla si se desvía del JSON y muestra el valor esperado.

export type FamiliaEstandar = { escala: number; cifra_pt: number; rotulo_pt: number; barra_in: number };

export type LaminaEstandar = { uso: string; layout: string; familia: FamiliaEstandar | null; cifra_valor_pt: number | null };

export const ESTANDAR_LAMINAS: Readonly<Record<string, LaminaEstandar>> = {
  "p_slide_1_grafico": { uso: "La lámina estándar: una pregunta, un gráfico", layout: "Graficos", familia: { escala: 1, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.42 }, cifra_valor_pt: null },
  "p_slide_1_grafico_narrativo": { uso: "Una frase arriba dice lo que hay que retener", layout: "1_Grafico_narrativo", familia: { escala: 1, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.42 }, cifra_valor_pt: null },
  "p_slide_grafico_texto_derecha": { uso: "El gráfico y su lectura al costado", layout: "right_grafico_texto", familia: { escala: 0.6, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.36 }, cifra_valor_pt: null },
  "p_slide_grafico_texto_izquierda": { uso: "Para alternar con la lámina vecina", layout: "left_grafico_texto", familia: { escala: 0.6, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.36 }, cifra_valor_pt: null },
  "p_slide_texto": { uso: "Conclusiones o notas metodológicas breves", layout: "Title and Content", familia: null, cifra_valor_pt: null },
  "p_slide_2_graficos": { uso: "Dos preguntas que se leen juntas", layout: "Graficos_2columnas", familia: { escala: 0.48, cifra_pt: 13, rotulo_pt: 11.5, barra_in: 0.34 }, cifra_valor_pt: null },
  "p_slide_2_graficos_narrativo": { uso: "Dos gráficos con una idea común arriba", layout: "1_Graficos_2columnas_narrativo", familia: { escala: 0.48, cifra_pt: 13, rotulo_pt: 11.5, barra_in: 0.34 }, cifra_valor_pt: null },
  "p_slide_2_graficos_texto_izquierda": { uso: "Perfiles breves con su lectura", layout: "left_2graficos_texto", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_2_graficos_texto_derecha": { uso: "Igual que la anterior, para alternar", layout: "right_2graficos_texto", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_2_graficos_vertical": { uso: "Dos preguntas de escala que comparten leyenda", layout: "graficos_2_vertical", familia: { escala: 1, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.3 }, cifra_valor_pt: null },
  "p_slide_2_graficos_asimetrico": { uso: "Un gráfico manda y el otro lo resume", layout: "graficos_2_asimetrico", familia: { escala: 0.65, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.36 }, cifra_valor_pt: null },
  "p_slide_3_graficos_2mas1": { uso: "Dos preguntas breves y una más larga", layout: "graficos_3_2mas1", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_3_graficos_1mas2": { uso: "La pregunta larga primero", layout: "graficos_3_1mas2", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_3_graficos_1arriba": { uso: "Una pregunta general y dos de detalle", layout: "graficos_3_1arriba", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_3_graficos_fila": { uso: "Tres variables de perfil", layout: "graficos_3_fila", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_3_graficos_poblacion_tira": { uso: "Tres preguntas de sí o no del mismo público", layout: "poblacion_3_tira", familia: { escala: 1, cifra_pt: 14, rotulo_pt: 12, barra_in: 0.3 }, cifra_valor_pt: null },
  "p_slide_3_graficos_poblacion_corona": { uso: "Perfil con una variable más larga", layout: "poblacion_3_corona", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_4_graficos": { uso: "Cuatro variables de perfil del mismo público", layout: "4_paneles", familia: { escala: 0.4, cifra_pt: 12, rotulo_pt: 11, barra_in: 0.26 }, cifra_valor_pt: null },
  "p_slide_5_graficos_poblacion": { uso: "Perfil del egresado o del docente", layout: "poblacion_5", familia: { escala: 0.3, cifra_pt: 12, rotulo_pt: 10.5, barra_in: 0.22 }, cifra_valor_pt: null },
  "p_slide_6_graficos_poblacion": { uso: "El máximo de gráficos en una lámina", layout: "poblacion_6", familia: { escala: 0.3, cifra_pt: 12, rotulo_pt: 10.5, barra_in: 0.22 }, cifra_valor_pt: null },
  "p_slide_3_graficos_poblacion_cifras": { uso: "Tamaño de la muestra y edad en cifras", layout: "poblacion_3_cifras", familia: { escala: 0.3, cifra_pt: 12, rotulo_pt: 10.5, barra_in: 0.22 }, cifra_valor_pt: 34 },
  "p_slide_cifras_y_graficos": { uso: "Abrir un capítulo o resumir el estudio", layout: "cifras_y_graficos", familia: { escala: 0.48, cifra_pt: 13, rotulo_pt: 11.5, barra_in: 0.34 }, cifra_valor_pt: 32 },
};
