import { describe, expect, it } from "vitest";
import { ajustesDeForma, conAjustesEnElTipo } from "./AjustesDelTipo";

describe("usar los ajustes de un gráfico en todos los de su tipo", () => {
  it("copia sólo ajustes de forma y deja lo propio del gráfico", () => {
    const args = { var: "a$p1", overrides: { titulo: "T", resaltar_mayor: true, mostrar_n_en_etiquetas: false, filtros: [] } };
    expect(ajustesDeForma(args)).toEqual({ resaltar_mayor: true, mostrar_n_en_etiquetas: false });
    expect(conAjustesEnElTipo({ barras_agrupadas: { x: 1 } }, "barras_agrupadas", { resaltar_mayor: true }))
      .toEqual({ barras_agrupadas: { x: 1, resaltar_mayor: true } });
  });
});
