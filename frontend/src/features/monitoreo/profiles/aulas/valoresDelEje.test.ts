import { describe, expect, it } from "vitest";

import { ordenarValoresDelEje, valoresDelEje } from "./valoresDelEje";

describe("valoresDelEje", () => {
  it("salen de las filas del EJE, no de las celdas de sexo", () => {
    // El defecto medido en el simulacro: la lista venía de `quotas_sex_faculty` y
    // un estudio cuya meta es sólo por nivel no declara celdas de sexo, así que
    // salía vacía y la dimensión del eje desaparecía del selector.
    const delEje = [{ facultad: "7" }, { facultad: "6" }, { facultad: "9" }, { facultad: "8" }];
    expect(valoresDelEje(delEje, [])).toEqual(["6", "7", "8", "9"]);
    // Sin filas del eje cae a las de sexo, que es lo que había: un payload viejo
    // no se queda sin selector.
    expect(valoresDelEje([], [{ faculty: "DERECHO" }, { faculty: "ARTE" }]))
      .toEqual(["ARTE", "DERECHO"]);
  });

  it("no repite ni deja entrar el vacío", () => {
    // Las celdas vienen por sexo, así que cada valor aparece dos veces.
    const filas = [{ facultad: "7" }, { facultad: "7" }, { facultad: "" }, { facultad: "  " }];
    expect(valoresDelEje(filas)).toEqual(["7"]);
  });

  it("un eje NUMÉRICO se ordena como número", () => {
    // Alfabéticamente «10» va antes de «6»: el recorrido con las flechas saltaría
    // 10 → 6 → 7 y el desplegable abriría con el nivel más alto arriba.
    expect(ordenarValoresDelEje(["10", "6", "7", "9", "8"]))
      .toEqual(["6", "7", "8", "9", "10"]);
  });

  it("un eje de TEXTO sigue en alfabético, con la intercalación del español", () => {
    expect(ordenarValoresDelEje(["PSICOLOGÍA", "ARTE Y DISEÑO", "ÑOÑO", "DERECHO"]))
      .toEqual(["ARTE Y DISEÑO", "DERECHO", "ÑOÑO", "PSICOLOGÍA"]);
    // Y una mezcla NO se ordena como número: «7» y «DERECHO» no comparan.
    expect(ordenarValoresDelEje(["7", "DERECHO"])).toEqual(["7", "DERECHO"]);
  });

  it("sin nada no inventa una lista", () => {
    expect(valoresDelEje(null, null)).toEqual([]);
    expect(valoresDelEje(undefined)).toEqual([]);
    expect(ordenarValoresDelEje([])).toEqual([]);
  });
});
