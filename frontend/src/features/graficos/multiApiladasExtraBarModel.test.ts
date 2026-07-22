import { describe, expect, test } from "vitest";
import { mergeMultiApiladasArgsPatch } from "./multiApiladasExtraBarModel";

function extraBarValue(args: Record<string, unknown>): unknown {
  const overrides = args.overrides as Record<string, unknown> | undefined;
  return overrides?.mostrar_barra_extra;
}

describe("mergeMultiApiladasArgsPatch", () => {
  test("declara la barra extra apagada por defecto", () => {
    const merged = mergeMultiApiladasArgsPatch({}, { vars: ["estudiantes$p1"] });

    expect(extraBarValue(merged)).toBe(false);
  });

  test.each([
    [true, true],
    [false, false],
  ])("sincroniza Top 2=%s con barra extra=%s", (top2box, expected) => {
    const merged = mergeMultiApiladasArgsPatch(
      { overrides: { mostrar_barra_extra: !expected } },
      { top2box },
    );

    expect(extraBarValue(merged)).toBe(expected);
  });

  test.each([
    [true, false],
    [false, true],
  ])(
    "Top 2=%s cede ante el override explicito barra extra=%s",
    (top2box, mostrarBarraExtra) => {
      const merged = mergeMultiApiladasArgsPatch(
        { overrides: { mostrar_barra_extra: top2box } },
        {
          top2box,
          overrides: { mostrar_barra_extra: mostrarBarraExtra },
        },
      );

      expect(extraBarValue(merged)).toBe(mostrarBarraExtra);
    },
  );

  test("preserva el override actual durante cambios ajenos", () => {
    const merged = mergeMultiApiladasArgsPatch(
      {
        top2box: true,
        overrides: { mostrar_barra_extra: false, ancho_max_eje_y: 44 },
      },
      { top2box_labels: ["Satisfecho", "Muy satisfecho"] },
    );

    expect(extraBarValue(merged)).toBe(false);
  });

  test("aplica el mismo contrato a un subbloque", () => {
    const mergedBlock = mergeMultiApiladasArgsPatch(
      {
        modo: "var",
        vars: ["docentes$p2"],
        overrides: { mostrar_barra_extra: false },
      },
      { top2box: true },
    );

    expect(mergedBlock.modo).toBe("var");
    expect(extraBarValue(mergedBlock)).toBe(true);
  });
});
