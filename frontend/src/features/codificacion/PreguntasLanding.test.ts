import { describe, expect, test } from "vitest";
import { defaultModoSoForQuickAdopt, modoSoOptionsForDisplay } from "./PreguntasLanding";

describe("PreguntasLanding quick adopt mode", () => {
  test("integrates select_one other text by default", () => {
    expect(defaultModoSoForQuickAdopt("select_one")).toBe("padre");
  });

  test("keeps select_multiple without SO mode", () => {
    expect(defaultModoSoForQuickAdopt("select_multiple")).toBeUndefined();
  });

  test("names the parent mode as codifying the original question", () => {
    const options = modoSoOptionsForDisplay("p10_mexico", "p10_mexico_other");
    expect(options[0]).toMatchObject({
      value: "padre",
      label: "Codificar pregunta original",
    });
    expect(options[1]).toMatchObject({
      value: "hijo",
      label: "Codificar texto aparte",
    });
  });
});
