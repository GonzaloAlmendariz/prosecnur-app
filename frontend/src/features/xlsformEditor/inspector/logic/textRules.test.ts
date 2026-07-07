// =============================================================================
// inspector/logic/textRules.test.ts — catálogo de reglas de texto
// =============================================================================
// Vitest puro (sin DOM). Por cada receta: round-trip buildRegex → recognize,
// examples ok/bad contra compileForJs, y matchTextRule sobre AST real
// construido con parseExpression. Además: canonicalización de constraints
// legados (`^\d+$`), precedencia genérica sobre dni-peru, escapado de
// literales y fuentes ajenas → null.
// =============================================================================

import { describe, expect, test } from "vitest";
import { parseExpression } from "../../logic";
import {
  buildTextRuleConstraint,
  compileForJs,
  escapeRegexLiteral,
  matchTextRule,
  TEXT_RULE_CATEGORIES,
  TEXT_RULE_RECIPES,
  textRuleById,
  textRuleParamsValid,
} from "./textRules";

function matchConstraint(constraint: string) {
  return matchTextRule(parseExpression(constraint));
}

describe("catálogo: cada receta", () => {
  for (const recipe of TEXT_RULE_RECIPES) {
    describe(recipe.id, () => {
      test("buildRegex(defaults) → recognize devuelve params equivalentes (round-trip)", () => {
        const source = recipe.buildRegex(recipe.defaults);
        const params = recipe.recognize(source);
        expect(params).not.toBeNull();
        // Params equivalentes: reconstruyen exactamente la misma fuente.
        expect(recipe.buildRegex(params!)).toBe(source);
      });

      test("compileForJs valida examples.ok y rechaza examples.bad", () => {
        const compiled = compileForJs(recipe.buildRegex(recipe.defaults));
        expect(compiled).not.toBeNull();
        for (const ok of recipe.examples.ok) {
          expect(compiled!.test(ok), `debería aceptar "${ok}"`).toBe(true);
        }
        for (const bad of recipe.examples.bad) {
          expect(compiled!.test(bad), `debería rechazar "${bad}"`).toBe(false);
        }
      });

      test("matchTextRule reconoce el constraint generado sobre AST parseado", () => {
        const constraint = buildTextRuleConstraint(recipe, recipe.defaults);
        // Consistente con los presets históricos: ancla ^…$ dentro del patrón.
        expect(constraint).toMatch(/^regex\(\., '\^.*\$'\)$/);
        const match = matchConstraint(constraint);
        expect(match).not.toBeNull();
        if (recipe.id === "dni-peru") {
          // `[0-9]{8}` es ambiguo: gana la receta paramétrica genérica.
          expect(match!.recipe.id).toBe("exactamente-n-digitos");
          expect(match!.params).toEqual({ n: 8 });
        } else {
          expect(match!.recipe.id).toBe(recipe.id);
        }
      });

      test("los defaults pasan la validación de params", () => {
        expect(textRuleParamsValid(recipe, recipe.defaults)).toBe(true);
      });

      test("la categoría existe en el orden de la galería", () => {
        expect(TEXT_RULE_CATEGORIES.map((c) => c.id)).toContain(recipe.category);
      });
    });
  }
});

describe("recetas paramétricas con valores no-default", () => {
  test("exactamente-n-digitos round-trip con n = 11 (RUC)", () => {
    const recipe = textRuleById("exactamente-n-digitos")!;
    const constraint = buildTextRuleConstraint(recipe, { n: 11 });
    expect(constraint).toBe("regex(., '^[0-9]{11}$')");
    const match = matchConstraint(constraint);
    expect(match?.recipe.id).toBe("exactamente-n-digitos");
    expect(match?.params).toEqual({ n: 11 });
  });

  test("entre-n-y-m-caracteres round-trip con min 3 / max 12", () => {
    const recipe = textRuleById("entre-n-y-m-caracteres")!;
    const constraint = buildTextRuleConstraint(recipe, { min: 3, max: 12 });
    expect(constraint).toBe("regex(., '^.{3,12}$')");
    const match = matchConstraint(constraint);
    expect(match?.params).toEqual({ min: 3, max: 12 });
  });

  test("empieza-con escapa metacaracteres del prefijo y los recupera", () => {
    const recipe = textRuleById("empieza-con")!;
    const constraint = buildTextRuleConstraint(recipe, { texto: "PE.1*" });
    const match = matchConstraint(constraint);
    expect(match?.recipe.id).toBe("empieza-con");
    expect(match?.params).toEqual({ texto: "PE.1*" });
    const compiled = compileForJs(recipe.buildRegex({ texto: "PE.1*" }))!;
    expect(compiled.test("PE.1*abc")).toBe(true);
    expect(compiled.test("PEX1*abc")).toBe(false);
  });

  test("empieza-con con apóstrofe sobrevive serializar → parsear", () => {
    const recipe = textRuleById("empieza-con")!;
    const constraint = buildTextRuleConstraint(recipe, { texto: "O'Neil" });
    const match = matchConstraint(constraint);
    expect(match?.params).toEqual({ texto: "O'Neil" });
  });

  test("termina-con round-trip con sufijo con espacios", () => {
    const recipe = textRuleById("termina-con")!;
    const constraint = buildTextRuleConstraint(recipe, { texto: " S.A." });
    const match = matchConstraint(constraint);
    expect(match?.recipe.id).toBe("termina-con");
    expect(match?.params).toEqual({ texto: " S.A." });
  });

  test("codigo-alfanumerico-n acepta params como string (inputs de la UI)", () => {
    const recipe = textRuleById("codigo-alfanumerico-n")!;
    expect(recipe.buildRegex({ n: "4" })).toBe("[A-Za-z0-9_-]{4}");
    expect(textRuleParamsValid(recipe, { n: "4" })).toBe(true);
    expect(textRuleParamsValid(recipe, { n: "" })).toBe(false);
    expect(textRuleParamsValid(recipe, { n: "0" })).toBe(false);
  });
});

describe("matchTextRule: canonicalización de constraints legados", () => {
  test("`^\\d+$` (preset digits histórico) → solo-numeros", () => {
    const match = matchConstraint("regex(., '^\\d+$')");
    expect(match?.recipe.id).toBe("solo-numeros");
  });

  test("`^\\d{8}$` → exactamente-n-digitos con n = 8", () => {
    const match = matchConstraint("regex(., '^\\d{8}$')");
    expect(match?.recipe.id).toBe("exactamente-n-digitos");
    expect(match?.params).toEqual({ n: 8 });
  });

  test("email histórico con anclas → correo-electronico", () => {
    const match = matchConstraint("regex(., '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')");
    expect(match?.recipe.id).toBe("correo-electronico");
  });

  test("fuente sin anclas también se reconoce", () => {
    const match = matchConstraint("regex(., '[0-9]+')");
    expect(match?.recipe.id).toBe("solo-numeros");
  });

  test("celular peruano no se confunde con la receta genérica de dígitos", () => {
    const match = matchConstraint("regex(., '^9[0-9]{8}$')");
    expect(match?.recipe.id).toBe("celular-peru");
  });
});

describe("matchTextRule: fuentes y formas ajenas → null", () => {
  test("regex con lookahead (no portable) no se reconoce", () => {
    expect(matchConstraint("regex(., '^(?=.*a)b+$')")).toBeNull();
  });

  test("regex arbitraria fuera del catálogo no se reconoce", () => {
    expect(matchConstraint("regex(., '^[a-f]{2}[0-9]?$')")).toBeNull();
  });

  test("regex sobre otra variable (no `.`) no se reconoce", () => {
    expect(matchConstraint("regex(${dni}, '^[0-9]{8}$')")).toBeNull();
  });

  test("expresiones no-regex no se reconocen", () => {
    expect(matchConstraint(". >= 18 and . <= 65")).toBeNull();
    expect(matchConstraint(". > 0")).toBeNull();
    expect(matchTextRule(null)).toBeNull();
  });

  test("`.*` pelado no se reconoce como empieza/termina-con", () => {
    expect(matchConstraint("regex(., '^.*$')")).toBeNull();
  });
});

describe("helpers", () => {
  test("escapeRegexLiteral escapa los metacaracteres regex", () => {
    expect(escapeRegexLiteral("a.b*c?")).toBe("a\\.b\\*c\\?");
    expect(escapeRegexLiteral("(x)[y]{z}")).toBe("\\(x\\)\\[y\\]\\{z\\}");
    expect(escapeRegexLiteral("PE-01")).toBe("PE-01");
  });

  test("compileForJs ancla el match completo", () => {
    const compiled = compileForJs("[0-9]+")!;
    expect(compiled.test("123")).toBe(true);
    expect(compiled.test("12a")).toBe(false);
    expect(compiled.test("a123")).toBe(false);
  });

  test("compileForJs devuelve null ante fuentes inválidas", () => {
    expect(compileForJs("[")).toBeNull();
    expect(compileForJs("a{2,1}")).toBeNull();
  });

  test("los ids del catálogo son únicos", () => {
    const ids = TEXT_RULE_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
