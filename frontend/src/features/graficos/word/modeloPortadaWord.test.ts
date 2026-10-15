import { describe, expect, it } from "vitest";
import { datosPortada, fichaPortada } from "./modeloPortadaWord";

const lamina = { titulo: "Satisfacción 2026", sub: "Informe final", fecha: "Octubre 2026" };

// W3: la portada del Word con los datos que pinta `.word_portada` (y como los arma `.word_documento`).
describe("portada del Word", () => {
  // Mata: un antetítulo inventado («Informe de resultados») o un «por» vacío cuando el motor pone PULSO PUCP.
  it("sin decisiones: variante A, título/sub/fecha de la lámina, por PULSO PUCP, sin antetítulo", () => {
    expect(datosPortada(lamina, {})).toEqual({ variante: "A", ante: "", titulo: "Satisfacción 2026", sub: "Informe final", por: "PULSO PUCP", fecha: "Octubre 2026", para: "", version: "" });
  });
  it("meta_portada pisa sub y fecha; el título siempre es el de la lámina", () => {
    const d = datosPortada(lamina, { portada: "C", meta_portada: { sub: "Resumen", para: "UNSA", version: "v2" } });
    expect([d.variante, d.titulo, d.sub, d.fecha]).toEqual(["C", "Satisfacción 2026", "Resumen", "Octubre 2026"]);
    expect(fichaPortada(d)).toEqual([
      { k: "Elaborado para", v: "UNSA" }, { k: "Elaborado por", v: "PULSO PUCP" }, { k: "Fecha", v: "Octubre 2026" }, { k: "Versión", v: "v2" },
    ]);
    expect(fichaPortada(datosPortada({ ...lamina, fecha: "" }, { portada: "C" })).map((f) => f.k)).toEqual(["Elaborado por"]);
  });
});
