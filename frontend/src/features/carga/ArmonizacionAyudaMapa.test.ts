// Armonizar usa la misma ayuda «Rangos» que Segmentos (2026-10-16): genérica,
// sin una ayuda por caso. Un «Otro» 88 entre los valores no la apaga y queda
// para asignarse a mano.
import { describe, expect, test } from "vitest";
import { accionesDesdeMapa } from "./ArmonizacionAyudaMapa";
import { ayudasDisponibles, mapaPorRangos, valoresParaRangos } from "./segmentos/segmentosModel";

const op = (codigo: string) => ({ codigo, etiqueta: codigo });

describe("ayudas del mapa en Armonizar", () => {
  test("rangos sobre años o números, con un especial etiquetado que queda para asignarse a mano", () => {
    expect(ayudasDisponibles(["2023", "2024", "2025", "88"].map(op).map((o) => (o.codigo === "88" ? { ...o, etiqueta: "Otro" } : o))))
      .toEqual(["rangos"]);
    const rangos = [{ clave: "t1", desde: "2024", hasta: "", destino: "1" }];
    expect(mapaPorRangos(valoresParaRangos(["2020", "2024", "2025", "88"].map(op)), rangos)).toEqual({ "2024": "1", "2025": "1" });
  });

  test("una acción «destinos» por categoría", () => {
    const acciones = accionesDesdeMapa("2025", { "2025": "0", "2024": "1", "2023": "1" }, ["2023", "2024", "2025", "88"]);
    const conocidos = ["2023", "2024", "2025", "88"];
    expect(acciones).toHaveLength(2);
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2025"], destino: "0", conocidos });
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2023", "2024"], destino: "1", conocidos });
  });
});
