import { describe, expect, test } from "vitest";
import { avisoDeVariableNoResuelta } from "../usePlanValidator";

// Un plan que nació con una sola base guarda sus variables sin prefijo ("p7").
// Al sumar bases, esa referencia deja de ser resoluble: el motor aborta con
// «La referencia de `var` requiere prefijo `fuente$` porque `data` contiene
// varias fuentes» y el preview devuelve 400 (reproducido con el estudio de
// 4 bases el 2026-08-03). El plan, mientras tanto, decía que la variable no
// estaba en el instrumento —y el selector mostraba su base al lado—.

describe("aviso de variable que no resolvió", () => {
  test("existe en una sola base: dice cuál y bloquea el export", () => {
    const aviso = avisoDeVariableNoResuelta("p7", ["docentes"]);
    expect(aviso.code).toBe("var-sin-base");
    expect(aviso.severity).toBe("error");
    expect(aviso.detalle).toContain('"docentes"');
    expect(aviso.detalle).not.toContain("renombraste");
  });

  test("existe en varias bases: las enumera y pide elegir", () => {
    const aviso = avisoDeVariableNoResuelta("sexo", ["docentes", "estudiantes", "egresados"]);
    expect(aviso.code).toBe("var-sin-base");
    expect(aviso.severity).toBe("error");
    expect(aviso.detalle).toContain('"docentes", "estudiantes" y "egresados"');
  });

  test("no existe en ninguna base: se mantiene el aviso de variable perdida", () => {
    const aviso = avisoDeVariableNoResuelta("p999", []);
    expect(aviso.code).toBe("var-unknown");
    expect(aviso.severity).toBe("warning");
    expect(aviso.detalle).toContain("no está en el instrumento");
  });
});
