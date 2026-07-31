import { describe, expect, it } from "vitest";

import { inicialesDeActor } from "./inicialesDeActor";

describe("inicialesDeActor", () => {
  it("da dos letras a un actor de una sola palabra", () => {
    // Los cuatro del elenco de acreditación, tal como los dibuja hoy
    // Fuentes › Actores.
    expect(inicialesDeActor("Administrativos")).toBe("AD");
    expect(inicialesDeActor("Docentes")).toBe("DO");
    expect(inicialesDeActor("Egresados")).toBe("EG");
    expect(inicialesDeActor("Estudiantes")).toBe("ES");
  });

  it("da una inicial por palabra cuando el actor tiene varias", () => {
    expect(inicialesDeActor("Personal administrativo")).toBe("PA");
    expect(inicialesDeActor("Jefes de práctica de pregrado")).toBe("JD");
  });

  it("ignora los acentos al sacar la inicial", () => {
    expect(inicialesDeActor("Álumnos")).toBe("AL");
    expect(inicialesDeActor("Ómnibus escolar")).toBe("OE");
  });

  it("no se traga los espacios de más", () => {
    expect(inicialesDeActor("  Docentes  ")).toBe("DO");
    expect(inicialesDeActor("Personal   administrativo")).toBe("PA");
  });

  it("marca con «?» lo que no nombra a nadie", () => {
    expect(inicialesDeActor("")).toBe("?");
    expect(inicialesDeActor("   ")).toBe("?");
    expect(inicialesDeActor("Sin actor")).toBe("?");
    expect(inicialesDeActor("sin actor")).toBe("?");
  });
});
