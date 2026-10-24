// Frases de la paleta del gráfico (PaletaDelGrafico.tsx); U7 de CCSS: decía «otras 1 pregunta».
export function fraseOtrasPreguntas(otras: number): string {
  if (otras <= 0) return "Estos colores son los de esta pregunta.";
  return `Estos colores también pintan ${otras === 1 ? "otra pregunta" : `otras ${otras} preguntas`} con las mismas respuestas.`;
}
