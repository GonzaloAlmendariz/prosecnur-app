import { describe, expect, it } from "vitest";
import { notaDeLaPlantillaDeDisponibilidad } from "./entregasDeAulas";

describe("notaDeLaPlantillaDeDisponibilidad", () => {
  it("con aplicadores declarados dice cuántos trae escritos y a dónde volver, con comillas rectas", () => {
    expect(notaDeLaPlantillaDeDisponibilidad({ aplicadores: 12 })).toBe(
      "Trae escritos los 12 aplicadores ya declarados. Al llenarla, vuelve por \"Importar disponibilidad\".",
    );
  });

  it("sin aplicadores dice cómo se llena", () => {
    expect(notaDeLaPlantillaDeDisponibilidad({ aplicadores: 0 })).toMatch(/^Se llena con el nombre de cada aplicador/);
    expect(notaDeLaPlantillaDeDisponibilidad({})).not.toContain("«");
  });
});

describe("pedidoDeCargaDeCampo", () => {
  it("lleva al motor las mismas opciones que la vista, con las ventanas del motor como arreglo", async () => {
    const { pedidoDeCargaDeCampo } = await import("./entregasDeAulas");
    const ventanas = new Map([["CH 1", { fecha: "2026-09-14", inicioMin: 600 }]]);
    expect(pedidoDeCargaDeCampo({ duracionMin: 30, eje: "calendario", ventanas, preparacionMin: 30, salidaMin: 15 })).toEqual({
      duracionMin: 30, eje: "calendario", preparacionMin: 30, salidaMin: 15,
      ventanas: [{ codigo: "CH 1", fecha: "2026-09-14", inicioMin: 600 }],
    });
    expect(pedidoDeCargaDeCampo({ duracionMin: 45 })).toEqual({ duracionMin: 45 });
  });
});
