import { describe, expect, it } from "vitest";
import { compactColumns } from "./AcreditacionMonitoreoPage";

describe("compactColumns", () => {
  const filas = [
    { Actor: "Egresados", Universo: 270, Efectivas: 178, "Avance universo": "65.9%" },
    { Actor: "Docentes", Universo: 53, Efectivas: 52, "Avance universo": "98.1%" },
  ];

  it("no inventa una columna que ninguna fila trae", () => {
    // El bloque canónico "Resumen por actor" no publica Meta/Mínimo: pedirla
    // dibujaba un encabezado con las cuatro celdas vacías.
    const cols = compactColumns(filas, ["Actor", "Universo", "Efectivas", "Meta"]);
    expect(cols).not.toContain("Meta");
    expect(cols).toEqual(["Actor", "Universo", "Efectivas", "Avance universo"]);
  });

  it("respeta el orden pedido para las columnas que sí existen", () => {
    const cols = compactColumns(filas, ["Efectivas", "Actor"]);
    expect(cols.slice(0, 2)).toEqual(["Efectivas", "Actor"]);
  });

  it("una columna ausente ya no gasta un espacio del tope", () => {
    // Con el tope en 3 y una preferida inexistente, antes se perdía una
    // columna real; ahora entran las tres que tienen datos.
    const cols = compactColumns(filas, ["Meta", "Actor", "Universo"], 3);
    expect(cols).toHaveLength(3);
    expect(cols).toContain("Efectivas");
  });

  it("ignora claves internas y respeta el tope", () => {
    const conInternas = [{ _oculta: 1, Actor: "X", Universo: 2 }];
    expect(compactColumns(conInternas, [], 8)).toEqual(["Actor", "Universo"]);
  });
});
