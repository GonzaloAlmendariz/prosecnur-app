import { describe, expect, test } from "vitest";
import { contar, textoDeActualizacion, textoDeAlias, textoDeCanalPorDefecto, textoDeHerencia } from "./vocabulario";

// Cada caso reemplaza una cadena literal medida en `acrconta`
// (docs/plan-fuentes-legibles-2026-07.md §1.1, hallazgo A5).

describe("textoDeHerencia", () => {
  test("reemplaza «20 heredan · 0 excepciones»", () => {
    expect(textoDeHerencia(20, 0)).toBe("20 recopiladores usan este canal · ninguno con excepción");
  });

  test("mantiene la excepción visible cuando la hay", () => {
    expect(textoDeHerencia(4, 1)).toBe("4 recopiladores usan este canal · 1 con excepción");
    expect(textoDeHerencia(4, 3)).toBe("4 recopiladores usan este canal · 3 con excepción");
  });

  test("singular y estado vacío", () => {
    expect(textoDeHerencia(1, 0)).toBe("1 recopilador usa este canal · ninguno con excepción");
    expect(textoDeHerencia(0, 0)).toBe("Sin recopiladores");
  });
});

describe("textoDeCanalPorDefecto", () => {
  test("reemplaza «Base Ficha QR»", () => {
    expect(textoDeCanalPorDefecto("Ficha QR")).toBe("Canal por defecto: Ficha QR");
    expect(textoDeCanalPorDefecto("")).toBe("Sin canal por defecto");
  });
});

describe("textoDeAlias", () => {
  test("reemplaza «Sin alias operativo» por lo que el usuario realmente ve", () => {
    expect(textoDeAlias("", "Email Invitation 10")).toBe("Usa el nombre de la plataforma");
    expect(textoDeAlias("Docentes ronda 2", "Email Invitation 10")).toBe("Docentes ronda 2");
    expect(textoDeAlias("", "")).toBe("Sin nombre");
  });
});

describe("textoDeActualizacion", () => {
  test("dice cuándo, no «Snapshot local listo»", () => {
    expect(textoDeActualizacion("2026-07-23T18:09:00Z")).toMatch(/^Actualizada /);
  });

  test("sin fecha o con fecha ilegible no inventa una", () => {
    expect(textoDeActualizacion(null)).toBe("Sin actualizar");
    expect(textoDeActualizacion("")).toBe("Sin actualizar");
    expect(textoDeActualizacion("no es una fecha")).toBe("Sin actualizar");
  });
});

describe("contar (R3)", () => {
  test("un cero se lee como estado, no como dato", () => {
    expect(contar(0, "encuesta", "encuestas")).toBe("Sin encuestas");
    expect(contar(1, "encuesta", "encuestas")).toBe("1 encuesta");
    expect(contar(7, "encuesta", "encuestas")).toBe("7 encuestas");
  });

  test("los miles se separan como en el resto de la app", () => {
    expect(contar(1277, "registro", "registros")).toBe("1,277 registros");
  });
});
