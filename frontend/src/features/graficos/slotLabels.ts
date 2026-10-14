// Nombre humano de cada ranura de graficador (izquierda, derecha, grafico_1…). Si no mapea, se muestra el nombre crudo.
export const SLOT_LABELS: Record<string, string> = {
  grafico: "Gráfico",
  izquierda: "Izquierda",
  derecha: "Derecha",
  grafico_1: "Gráfico 1",
  grafico_2: "Gráfico 2",
  superior_izquierda: "Superior izquierda",
  superior_derecha: "Superior derecha",
  inferior_izquierda: "Inferior izquierda",
  inferior_derecha: "Inferior derecha",
  grafico_superior_1: "Superior 1",
  grafico_superior_2: "Superior 2",
  grafico_superior_3: "Superior 3",
  grafico_inferior_1: "Inferior 1",
  grafico_inferior_2: "Inferior 2",
  grafico_inferior_3: "Inferior 3",
};

export function getSlotLabel(slotName: string): string {
  return SLOT_LABELS[slotName] ?? slotName;
}
