// P21 (enmienda ADR 0103): la serie temporal se arma en la lámina. Con el
// contrato publicado por el backend —direct / "" / named_vars— el picker tiene
// que dejar insertarla; antes salía como «generated» y quedaba deshabilitada.

import { describe, expect, it } from "vitest";
import type { GraficadorMetadata } from "../../../api/client";
import { canInsertGraficador } from "../GraficadorPicker";

const serie = (over: Partial<GraficadorMetadata> = {}): GraficadorMetadata => ({
  name: "p_serie_temporal",
  titulo_humano: "Serie temporal",
  descripcion: "Una línea por tema a través de las mediciones.",
  icono_ui: "LineChart",
  categoria: "comparison",
  blueprint: "future",
  available: true,
  args: [],
  args_extra: [],
  authoring_mode: "direct",
  capability_key: "",
  data_requirement: "named_vars",
  ...over,
}) as GraficadorMetadata;

describe("canInsertGraficador con la serie de autoría directa", () => {
  it("la serie direct / \"\" / named_vars se puede insertar", () => {
    expect(canInsertGraficador(serie(), false)).toBe(true);
    expect(canInsertGraficador(serie(), true)).toBe(true);
  });

  it("el contrato viejo (generated / equivalences_temporal) sigue cerrado", () => {
    expect(canInsertGraficador(serie({ authoring_mode: "generated", capability_key: "equivalences_temporal" }), true)).toBe(false);
  });
});
