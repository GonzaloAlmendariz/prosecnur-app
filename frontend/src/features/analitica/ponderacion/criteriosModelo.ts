// Guía de criterios para ponderar: dos respuestas dan una recomendación. Es la
// misma regla que traía la guía del panel, separada de su vista.

export type Recomendacion = {
  tono: "conviene" | "no-conviene";
  texto: string;
};

export function recomendacion(describePoblacion: boolean | null, cifrasConfiables: boolean | null): Recomendacion | null {
  if (describePoblacion === null || cifrasConfiables === null) return null;
  if (describePoblacion && cifrasConfiables) {
    return { tono: "conviene", texto: "Conviene ponderar: hay una población que describir y cifras para fijar las metas, del mismo universo que la muestra." };
  }
  if (!describePoblacion) {
    return { tono: "no-conviene", texto: "Para comparar grupos con un diseño balanceado, ponderar probablemente no hace falta: resta precisión y corrige poco sesgo." };
  }
  return { tono: "no-conviene", texto: "Sin cifras confiables de la población no hay con qué fijar las metas. Consíguelas antes de ponderar." };
}
