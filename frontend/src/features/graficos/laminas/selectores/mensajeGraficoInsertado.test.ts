import { describe, expect, it } from "vitest";
import { nombreConVersion, varianteGrafico } from "../../catalogoGraficos";
import { mensajeGraficoInsertado } from "./mensajeGraficoInsertado";

describe("el aviso al insertar un gráfico", () => {
  const divergente = varianteGrafico("p_barras_divergentes:escala_sin_informacion");

  it("con versión: «<tipo>, versión <versión>», con un solo dos puntos y el mismo nombre que el selector", () => {
    const m = mensajeGraficoInsertado("Multiapilada divergente", divergente);
    expect(m).toBe("Gráfico insertado: Multiapilada divergente, versión Con columna de Sin información");
    if (divergente) expect(m.endsWith(nombreConVersion(divergente, "Multiapilada divergente"))).toBe(true);
    expect(m.split(":").length).toBe(2);
    expect(m).not.toContain("·");
  });
  it("la versión base, sólo el tipo", () => {
    expect(mensajeGraficoInsertado("Barras agrupadas", null)).toBe("Gráfico insertado: Barras agrupadas");
  });
  it("en una lámina de varios gráficos dice el espacio", () => {
    expect(mensajeGraficoInsertado("Barras agrupadas", null, 'espacio "Derecha"')).toBe('Gráfico insertado en el espacio "Derecha": Barras agrupadas');
  });
});
