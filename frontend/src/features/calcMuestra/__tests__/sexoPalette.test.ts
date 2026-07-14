import { describe, expect, it } from "vitest";
import { didSexSeriesColor, type DidTokens } from "../didactica/didacticaCharts";
import { sexSeriesCssColor, sexSeriesDisplayLabel, sexSeriesKind } from "../sexoPalette";

const didTokens = {
  accent: "rgb(124, 58, 237)",
  accentSoft: "rgba(124, 58, 237, .08)",
  border: "rgb(226, 232, 240)",
  text: "rgb(15, 23, 42)",
  textMuted: "rgb(100, 116, 139)",
  surface: "rgb(255, 255, 255)",
  success: "rgb(21, 128, 61)",
  warn: "rgb(180, 83, 9)",
  sexMale: "rgb(37, 99, 235)",
  sexFemale: "rgb(194, 65, 107)",
  sexMissing: "rgb(203, 213, 228)",
  font: "sans-serif",
} satisfies DidTokens;

describe("paleta canónica de sexo", () => {
  it("expande códigos institucionales a etiquetas legibles", () => {
    expect(sexSeriesDisplayLabel("M")).toBe("Hombre");
    expect(sexSeriesDisplayLabel("F")).toBe("Mujer");
    expect(sexSeriesDisplayLabel("No binario")).toBe("No binario");
  });

  it.each(["Hombre", "Hombres", "Masculino", "M", "H", "Male", "Varón"])(
    "clasifica %s como Hombre",
    (label) => expect(sexSeriesKind(label)).toBe("male"),
  );

  it.each(["Mujer", "Mujeres", "Femenino", "F", "Female", "Fem"])(
    "clasifica %s como Mujer",
    (label) => expect(sexSeriesKind(label)).toBe("female"),
  );

  it("mantiene colores semánticos estables independientemente del orden", () => {
    expect(sexSeriesCssColor("Hombres", 1)).toBe("var(--cmv2-sex-hombre)");
    expect(sexSeriesCssColor("Mujeres", 0)).toBe("var(--cmv2-sex-mujer)");
    expect(sexSeriesCssColor("Sin dato", 2)).toBe("var(--cmv2-sex-sin-dato)");
  });

  it("entrega la misma pareja resuelta a Plotly", () => {
    expect(didSexSeriesColor("Hombre", didTokens, 1)).toBe(didTokens.sexMale);
    expect(didSexSeriesColor("Mujer", didTokens, 0)).toBe(didTokens.sexFemale);
  });
});
