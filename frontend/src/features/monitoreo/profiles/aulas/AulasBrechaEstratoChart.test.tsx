import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";

// Plotly no se monta en jsdom: se captura lo que se le pasa, que es lo que
// decide qué barras hay y con qué escala.
const capturado: Array<Record<string, unknown>> = [];
vi.mock("../../../../lib/PlotlyChart", () => ({
  PlotlyChart: (props: Record<string, unknown>) => { capturado.push(props); return null; },
}));

const { AulasBrechaEstratoChart } = await import("./AulasBrechaEstratoChart");

const fila = (estrato: string, brecha: number): MonitoreoRow =>
  ({ stratum: estrato, brecha, respuestas_validas: 10, aulas: 1 }) as unknown as MonitoreoRow;

function render(filas: MonitoreoRow[]) {
  capturado.length = 0;
  const html = renderToStaticMarkup(<AulasBrechaEstratoChart filas={filas} />);
  const data = capturado[0]?.data as Array<{ name: string; y: string[]; x: number[] }>;
  const faltan = data.find((t) => t.name === "Faltan")!;
  return { html, etiquetas: [...faltan.y].reverse(), valores: [...faltan.x].reverse() };
}

describe("el recorte del gráfico de estratos", () => {
  // 20 estratos con brecha de 100 a 81: se dibujan 12 y quedan 8 fuera.
  const muchos = Array.from({ length: 20 }, (_, i) => fila(`E${String(i).padStart(2, "0")}`, 100 - i));

  it("NO mete el resto como barra: la escala la fijaría el agregado", () => {
    // Se probó y hubo que revertirlo: con 858 contra los 89 del mayor, los doce
    // estratos reales quedaban comprimidos en el 10 % izquierdo y comparar
    // estratos entre sí es para lo que existe el panel.
    const { etiquetas, valores } = render(muchos);
    expect(etiquetas).toHaveLength(12);
    expect(etiquetas.some((e) => e.startsWith("Otros"))).toBe(false);
    // La mayor barra sigue siendo un estrato real, no una suma.
    expect(Math.max(...valores)).toBe(100);
  });

  it("declara qué PESO tiene lo que se dibuja, no sólo cuántos faltan", () => {
    // «No se dibujan 8» no dice si eso es el margen o la mitad del problema.
    // 12 de 100..89 suman 1134; el total es 1810; 1134/1810 = 63 %.
    const { html } = render(muchos);
    expect(html).toContain("63 %");
    expect(html).toContain("8 estratos");
    // Y con la concordancia bien: «estrato» es masculino.
    expect(html).toContain("los otros");
    expect(html).not.toContain("las otras");
  });

  it("sin recorte no promete un porcentaje que sería siempre 100", () => {
    const pocos = Array.from({ length: 4 }, (_, i) => fila(`E${i}`, 10 - i));
    const { html, etiquetas } = render(pocos);
    expect(etiquetas).toHaveLength(4);
    expect(html).not.toContain("% de lo que falta");
  });
});
