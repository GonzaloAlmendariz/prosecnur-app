// Mata: convertir en segmentado un mando de cuatro opciones, uno cuyo rótulo no cabe en la tarjeta o uno con un valor
// guardado retirado (que necesita el desplegable para verse con su aviso).
import { describe, expect, it } from "vitest";
import { opcionesEnSegmentado } from "./opcionesEnSegmentado";

const op = (...labels: string[]) => labels.map((label, i) => ({ value: `v${i}`, label }));

describe("opciones de la tarjeta en segmentado", () => {
  it("tres rótulos cortos van en la línea del rótulo", () => {
    expect(opcionesEnSegmentado(op("Automática", "Siempre", "Nunca"))).toEqual({
      opciones: [{ clave: "v0", rotulo: "Automática" }, { clave: "v1", rotulo: "Siempre" }, { clave: "v2", rotulo: "Nunca" }],
      apilado: false,
    });
  });
  it("un rótulo que dice qué rige hoy pasa debajo del rótulo, a todo el ancho", () => {
    expect(opcionesEnSegmentado(op("Como el informe (sin casos)", "Siempre", "Nunca"))?.apilado).toBe(true);
  });
  it("cuatro opciones o rótulos que no caben siguen en desplegable", () => {
    expect(opcionesEnSegmentado(op("A", "B", "C", "D"))).toBeNull();
    expect(opcionesEnSegmentado(op("Percentiles 10 a 90 de la distribución", "Mínimo a máximo"))).toBeNull();
    expect(opcionesEnSegmentado(op("Solo"))).toBeNull();
  });
  it("un valor guardado que ya no se ofrece deja el desplegable, que lo muestra con su aviso", () => {
    expect(opcionesEnSegmentado(op("Sí", "No"), "retirado")).toBeNull();
    expect(opcionesEnSegmentado(op("Sí", "No"), "v1")).not.toBeNull();
  });
});
