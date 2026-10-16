// Armonizar usa la misma ayuda «Rangos» que Segmentos (2026-10-16): genérica,
// sin una ayuda por caso. Un «Otro» 88 entre los valores no la apaga y queda
// para asignarse a mano.
import { describe, expect, test } from "vitest";
import { accionesDesdeAsignacion, esMapaNumerico } from "./ArmonizacionAyudaMapa";
import { ayudasDisponibles, mapaPorRangos, valoresParaRangos } from "./segmentos/segmentosModel";

const op = (codigo: string) => ({ codigo, etiqueta: codigo });

describe("ayudas del mapa en Armonizar", () => {
  test("rangos sobre años o números, con un especial etiquetado que queda para asignarse a mano", () => {
    expect(ayudasDisponibles(["2023", "2024", "2025", "88"].map(op).map((o) => (o.codigo === "88" ? { ...o, etiqueta: "Otro" } : o))))
      .toEqual(["rangos"]);
    const rangos = [{ clave: "t1", desde: "2024", hasta: "", destino: "1" }];
    expect(mapaPorRangos(valoresParaRangos(["2020", "2024", "2025", "88"].map(op)), rangos)).toEqual({ "2024": "1", "2025": "1" });
  });

  test("una acción «destinos» por categoría; un valor que sale de los rangos queda sin mapa", () => {
    const conocidos = ["2023", "2024", "2025", "88"];
    const acciones = accionesDesdeAsignacion("2025", { "2025": "0", "2024": "1", "2023": "1", "2020": null }, conocidos);
    expect(acciones).toHaveLength(3);
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2025"], destino: "0", conocidos });
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2023", "2024"], destino: "1", conocidos });
    expect(acciones).toContainEqual({ tipo: "destinos", base: "2025", codigos: ["2020"], destino: null, conocidos });
  });

  test("el mapa es numérico con escala y valores numéricos; un código sin casos no decide", () => {
    const escala = [{ codigo: "1", etiqueta: "Joven" }];
    const cod = (codigo: string, n: number, etiqueta: string | null = null) => ({ codigo, etiqueta, n });
    expect(esMapaNumerico([cod("18", 5), cod("40", 3), cod("0", 0, "Selecciona")], escala)).toBe(true);
    expect(esMapaNumerico([cod("18", 5)], [])).toBe(false);
    expect(esMapaNumerico([cod("1", 5, "Sí"), cod("2", 3, "No")], escala)).toBe(false);
  });
});
