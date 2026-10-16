// Armonizar usa las mismas ayudas que Segmentos, con nombres que no suponen
// un estudio (2026-10-16): una variable de años con un «Otro» 88 conserva la
// ayuda y el 88 queda para asignarse a mano.
import { describe, expect, test } from "vitest";
import { accionesDesdeMapa } from "./ArmonizacionAyudaMapa";
import { ayudasDisponibles, mapaPorTramos, aniosParaTramos, sonAnios } from "./segmentos/segmentosModel";

const op = (codigo: string) => ({ codigo, etiqueta: codigo });

describe("ayudas del mapa en Armonizar", () => {
  test("años con códigos especiales siguen siendo años; otros números no", () => {
    expect(sonAnios(["2024", "2025", "88"].map(op))).toBe(true);
    expect(sonAnios(["88", "99"].map(op))).toBe(false);
    expect(sonAnios(["2024", "150"].map(op))).toBe(false);
    expect(ayudasDisponibles(["2023", "2024", "2025", "88"].map(op))).toEqual(["tramos"]);
  });

  test("los tramos van relativos al año de cada base y el 88 no se toca", () => {
    const tramos = [
      { clave: "t1", desde: "0", hasta: "0", destino: "0" },
      { clave: "t2", desde: "1", hasta: "2", destino: "1" },
      { clave: "t3", desde: "3", hasta: "", destino: "3" },
    ];
    const codigos = ["2020", "2023", "2024", "2025", "88"].map(op);
    expect(mapaPorTramos(aniosParaTramos(codigos), 2025, tramos)).toEqual({ "2025": "0", "2024": "1", "2023": "1", "2020": "3" });
    expect(mapaPorTramos(aniosParaTramos(codigos), 2026, tramos)["2025"]).toBe("1");
  });

  test("una acción «destinos» por categoría", () => {
    const acciones = accionesDesdeMapa("2025", { "2025": "0", "2024": "1", "2023": "1" }, ["2023", "2024", "2025", "88"]);
    const conocidos = ["2023", "2024", "2025", "88"];
    expect(acciones).toHaveLength(2);
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2025"], destino: "0", conocidos });
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2023", "2024"], destino: "1", conocidos });
  });
});
