import { describe, expect, it } from "vitest";
import { opcionesEquivalentes, problemasDeEtiqueta } from "./detectorEtiquetas";

// Casos tomados de las observaciones reales del cliente a los informes de ACRD (agosto 2026).
const tipos = (s: string, esOpcion = false) => problemasDeEtiqueta(s, { esOpcion }).map((p) => p.tipo);

describe("detector de etiquetas (G18): avisa y sugiere, no cambia", () => {
  it("espacio antes del signo, con su corrección", () => {
    const [p] = problemasDeEtiqueta("¿Conoce la misión de la PUCP ?");
    expect(p.tipo).toBe("espacio-antes-de-signo");
    expect(p.sugerencia).toBe("¿Conoce la misión de la PUCP?");
    expect(tipos("Institución , año")).toContain("espacio-antes-de-signo");
  });
  it("doble porcentaje y conjunción en mayúscula («docentes Y autoridades»)", () => {
    expect(problemasDeEtiqueta("Cobertura 45%%")[0].sugerencia).toBe("Cobertura 45%");
    const c = problemasDeEtiqueta("Relación entre docentes Y autoridades").find((p) => p.tipo === "conjuncion-mayuscula");
    expect(c?.sugerencia).toBe("Relación entre docentes y autoridades");
    expect(tipos("Facultad de Arte Y Diseño PUCP")).not.toContain("conjuncion-mayuscula");   // nombre propio en mayúsculas
  });
  it("punto final sólo en opciones; nota entre corchetes sin sugerencia (la quita el analista); larga para un gráfico", () => {
    expect(tipos("Muy satisfecho.", true)).toEqual(["punto-final"]);
    expect(tipos("Muy satisfecho.")).toEqual([]);
    const n = problemasDeEtiqueta("Misión [Entiéndase los propósitos]").find((p) => p.tipo === "nota-o-html");
    expect(n?.sugerencia).toBeUndefined();
    expect(tipos("x".repeat(81))).toContain("larga");
    expect(tipos("Sin problemas")).toEqual([]);
  });
  it("opciones equivalentes separadas: sólo difieren en tildes o mayúsculas", () => {
    const m = opcionesEquivalentes([{ code: "1", label: "Sí" }, { code: "2", label: "si" }, { code: "3", label: "No" }]);
    expect([...m.keys()]).toEqual(["1", "2"]);
    expect(m.get("1")?.mensaje).toContain("«si» (2)");
  });
});
