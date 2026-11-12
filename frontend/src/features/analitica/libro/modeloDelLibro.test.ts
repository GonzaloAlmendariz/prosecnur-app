import { describe, expect, it } from "vitest";

import type { DataReviewVariable } from "../../../api/analitica";
import type { DataReviewSectionGroup } from "../datos/borradorDeEtiquetas";
import { codigosEnTexto, resumenDelLibro, seccionesDelLibro } from "./modeloDelLibro";

const v = (name: string): DataReviewVariable => ({
  name, tipo_xlsform: "text", seccion: "", included: true, label_actual: name, label_original: name,
  n_non_missing: 1, n_missing: 0, opciones: [],
});

describe("libro de códigos", () => {
  it("entran solo las variables incluidas y una sección vacía no aparece", () => {
    const grupos: DataReviewSectionGroup[] = [
      { id: "a", name: "A", hidden: false, synthetic: false, variables: [v("p1"), v("correo")] },
      { id: "b", name: "B", hidden: true, synthetic: false, variables: [v("p9")] },
    ];
    const secciones = seccionesDelLibro(grupos, (x, g) => x.name !== "correo" && !g.hidden);
    expect(secciones.map((s) => [s.id, s.variables.map((x) => x.name)])).toEqual([["a", ["p1"]]]);
    expect(resumenDelLibro(secciones)).toBe("1 variable en 1 sección");
  });

  it("dice los códigos de una pregunta en una línea", () => {
    const etiquetas: Record<string, string> = { "1": "Sí", "2": "No", "98": "No sabe", "5": "Muy satisfecho" };
    const de = (c: string) => etiquetas[c] ?? "";
    expect(codigosEnTexto([{ code: "1" }, { code: "2" }, { code: "98" }], de)).toBe("1 Sí, 2 No, 98 No sabe");
    expect(codigosEnTexto([{ code: "1" }, { code: "2" }, { code: "3" }, { code: "5" }], de)).toBe("1 Sí a 5 Muy satisfecho");
    expect(codigosEnTexto([], de)).toBe("");
  });
});
