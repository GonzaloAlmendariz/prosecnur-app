import { describe, expect, test } from "vitest";
import { nodoPorClave } from "../../../lib/navegacion/manifiesto";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import { PESTANAS_EDITOR, resolverPestanaEditor } from "./pestanaEditor";

describe("pestañas del editor de formularios", () => {
  test("once pestañas en el rail, en el orden de trabajo, con Impreso al final", () => {
    // 2026-10-16: «Listas de opciones» deja de ser panel lateral y es pestaña, junto al Editor XLSForm.
    expect(PESTANAS_EDITOR.map((p) => p.key)).toEqual([
      "constructor", "hojas", "opciones", "cuestionario", "logica", "restricciones", "calculos", "filtros", "probar", "resumen", "impreso",
    ]);
    for (const p of PESTANAS_EDITOR) {
      expect(p.to).toBe(`/editor-xlsform?pestana=${p.key}`);
      expect(nodoPorClave(`editor-xlsform/formularios/${p.key}`), p.key).not.toBeNull();
    }
  });

  test("sin pestaña o con una que no existe abre el Constructor; los nombres de antes se leen como alias", () => {
    expect(resolverPestanaEditor(null)).toBe("constructor");
    expect(resolverPestanaEditor("no-existe")).toBe("constructor");
    expect(resolverPestanaEditor("impreso")).toBe("impreso");
    expect(resolverPestanaEditor("sheets")).toBe("hojas");
    expect(resolverPestanaEditor("catalogos")).toBe("opciones");
    expect(resolverPestanaEditor("summary")).toBe("resumen");
    expect(resolverPestanaEditor("pdf")).toBe("impreso");
  });

  test("lo transitorio sigue siendo panel: listas, editor de listas y lógica de SurveyMonkey", () => {
    const ids = (PANELES_POR_MODULO["editor-xlsform"] ?? []).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["listas-opciones", "catalogos", "logica-surveymonkey"]));
  });
});
