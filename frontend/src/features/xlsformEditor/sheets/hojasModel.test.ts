// Mata: la hoja activa que se pierde al recargar, un foco ajeno que deja la tabla sin hoja, y columnas fijas que no van
// pegadas a # (sticky con huecos se monta sobre las vecinas).
import { describe, expect, test } from "vitest";
import { columnasFijas, focoDeHoja, hojaDesdeFoco, ordenarConFijas } from "./hojasModel";

describe("hojasModel: dirección y columnas fijas", () => {
  test("la hoja viaja en el foco; survey no se escribe", () => {
    expect(hojaDesdeFoco("choices")).toBe("choices");
    expect(hojaDesdeFoco(null)).toBe("survey");
    expect(hojaDesdeFoco("p_edad")).toBe("survey");
    expect(focoDeHoja("survey")).toBeNull();
    expect(focoDeHoja("settings")).toBe("settings");
  });

  test("survey fija type y name; choices fija list_name y name", () => {
    expect(columnasFijas("survey", ["label", "name", "type"])).toEqual(["type", "name"]);
    expect(ordenarConFijas("survey", ["label", "type", "hint", "name"])).toEqual(["type", "name", "label", "hint"]);
    expect(ordenarConFijas("choices", ["list_name", "name", "label"])).toEqual(["list_name", "name", "label"]);
    expect(columnasFijas("settings", ["form_title"])).toEqual([]);
  });
});
