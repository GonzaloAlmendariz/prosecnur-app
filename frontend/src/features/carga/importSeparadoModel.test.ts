import { describe, expect, it } from "vitest";
import { nombreCortoDeEncuesta, nombreLibreDeBase } from "./importSeparadoModel";

describe("bases separadas desde la plataforma", () => {
  it("la base toma el actor del título de la encuesta, sin tildes, espacios ni $", () => {
    expect(nombreCortoDeEncuesta("Acreditación Arte y Diseño PUCP - Docentes")).toBe("docentes");
    expect(nombreCortoDeEncuesta("Acreditación Arte y Diseño PUCP - Administrativos")).toBe("administrativos");
    expect(nombreCortoDeEncuesta("Encuesta – Personal de apoyo")).toBe("personal_de_apoyo");
    expect(nombreCortoDeEncuesta("Egresados 2026")).toBe("egresados_2026");
    expect(nombreCortoDeEncuesta("$$$")).toBe("base");
  });

  it("no choca con una base que ya existe", () => {
    expect(nombreLibreDeBase("docentes", ["estudiantes"])).toBe("docentes");
    expect(nombreLibreDeBase("docentes", ["docentes", "docentes_2"])).toBe("docentes_3");
  });
});
