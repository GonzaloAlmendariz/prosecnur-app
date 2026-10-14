import { describe, expect, it } from "vitest";
import { agruparAvisos, rotuloIrALamina } from "./avisosExportacionModel";

describe("avisos antes de exportar, por lámina", () => {
  it("agrupa por lámina en orden y separa cada detalle", () => {
    const g = agruparAvisos([
      "Lámina 60 · “Cifras destacadas (p172)”: el espacio «Cifra izquierda» no tiene título y los demás sí",
      "Lámina 60 · “Cifras destacadas (p172)”: el espacio «Cifra centro» no tiene título y los demás sí",
      "Lámina 110 · “Población: seis gráficos”: «sexo» se grafica dos veces",
      "Faltan colores en la paleta «Sí / No»",
    ]);
    expect(g.map((x) => [x.lamina, x.titulo, x.detalles.length])).toEqual([
      ["60", "Cifras destacadas (p172)", 2],
      ["110", "Población: seis gráficos", 1],
      [null, null, 1],
    ]);
    expect(g[0].detalles[0]).toBe("El espacio «Cifra izquierda» no tiene título y los demás sí");
  });

  it("el botón del error dice a qué lámina va, sin comillas anidadas", () => {
    expect(rotuloIrALamina("Lámina 44 · “Preguntas por grupos (p79)”")).toBe("Ir a la lámina 44");
    expect(rotuloIrALamina("Portada")).toBe("Ir a la lámina");
  });
});
