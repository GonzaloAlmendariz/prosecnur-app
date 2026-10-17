import { describe, expect, it } from "vitest";
import { subtituloDelBloque } from "./outlineDelBloque";

describe("subtítulo de una fila del outline", () => {
  it("calla cuando repite el rótulo, aunque venga sin tildes", () => {
    expect(subtituloDelBloque("Registro de aplicacion", "Registro de aplicación")).toBe("");
    expect(subtituloDelBloque("  registro  DE aplicación ", "Registro de aplicación")).toBe("");
  });

  it("enseña lo que pinta cuando es distinto del rótulo", () => {
    expect(subtituloDelBloque("Nombre del curso", "Texto")).toBe("Nombre del curso");
  });

  it("vacío o ausente no produce subtítulo", () => {
    expect(subtituloDelBloque(undefined, "Texto")).toBe("");
    expect(subtituloDelBloque("   ", "Texto")).toBe("");
  });

  it("recorta un texto largo con elipsis", () => {
    expect(subtituloDelBloque("a".repeat(60), "Texto")).toBe(`${"a".repeat(44)}…`);
  });
});
