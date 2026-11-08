import { describe, expect, test } from "vitest";
import { mergeMultiApiladasArgsPatch } from "./multiApiladasExtraBarModel";
import { sinGruposHuerfanos } from "./laminas/argsDatosGrafico";
import { mergeSlotArgsPatch } from "./store";

describe("mergeMultiApiladasArgsPatch", () => {
  test("cambiar de lectura conserva la barra extra de la lámina y no inventa overrides", () => {
    const merged = mergeMultiApiladasArgsPatch(
      { barra_extra: ["top2box"], top2box_labels: ["De acuerdo", "Totalmente de acuerdo"] },
      { modo: "var" },
    );

    expect(merged.barra_extra).toEqual(["top2box"]);
    expect(merged.overrides).toBeUndefined();
    expect(merged).not.toHaveProperty("mostrar_barra_extra");
  });

  test("ya no declara una barra extra apagada por defecto ni escribe claves viejas", () => {
    const merged = mergeMultiApiladasArgsPatch({}, { vars: ["estudiantes$p1"] });

    expect(merged).toEqual({ vars: ["estudiantes$p1"] });
  });

  test("un patch con barra_extra la escribe en el bloque; false se conserva (apagada propia)", () => {
    expect(mergeMultiApiladasArgsPatch({ vars: ["a"] }, { barra_extra: ["conteos"] }).barra_extra).toEqual(["conteos"]);
    expect(mergeMultiApiladasArgsPatch({ vars: ["a"] }, { barra_extra: false }).barra_extra).toBe(false);
  });

  test("barra_extra: null quita la declaración para que el bloque vuelva a heredar", () => {
    const merged = mergeMultiApiladasArgsPatch({ barra_extra: false, titulo: "x" }, { barra_extra: null });

    expect(merged).toEqual({ titulo: "x" });
  });

  test("fusiona los overrides clave a clave y preserva los ajenos", () => {
    const merged = mergeMultiApiladasArgsPatch(
      { overrides: { ancho_max_eje_y: 44, barra_extra: false } },
      { overrides: { barra_extra: ["top2box"] }, top2box_labels: ["Satisfecho", "Muy satisfecho"] },
    );

    expect(merged.overrides).toEqual({ ancho_max_eje_y: 44, barra_extra: ["top2box"] });
    expect(merged.top2box_labels).toEqual(["Satisfecho", "Muy satisfecho"]);
  });
});

describe("R7-19: excluir_grupos huérfano en la multiapilada", () => {
  test("dejar el modo con cruce quita los grupos excluidos del plan", () => {
    const actual = { modo: "cruce", var: "b$p1", cruces: "b$sexo", excluir_grupos: ["Otro"] };
    expect(mergeMultiApiladasArgsPatch(actual, { modo: "var", vars: ["b$p1"], cruces: null }).excluir_grupos).toBeNull();
    expect(mergeSlotArgsPatch(actual, mergeMultiApiladasArgsPatch(actual, { modo: "multilista" }))).not.toHaveProperty("excluir_grupos");
  });
  test("entre modos con cruce, o sin cambio de modo, se conservan", () => {
    const actual = { modo: "cruce", excluir_grupos: ["Otro"] };
    expect(mergeMultiApiladasArgsPatch(actual, { modo: "var_cruce" }).excluir_grupos).toEqual(["Otro"]);
    expect(mergeMultiApiladasArgsPatch(actual, { cruces: "b$edad" }).excluir_grupos).toEqual(["Otro"]);
    expect(sinGruposHuerfanos({ modo: "cruce" }, { modo: "var" })).toEqual({ modo: "var" });
  });
});
