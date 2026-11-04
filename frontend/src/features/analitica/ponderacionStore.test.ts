import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_CONFIG, useAnaliticaStore, type PonderacionConfig } from "./store";

// Editar una parte de la ponderación no puede borrar lo que otra parte declaró:
// el peso base (`design.peso_columna`), el tratamiento de NA/98/99
// (`rake.faltantes`, `rake.imputacion`) y la recalibración del recorte.

const CONFIG: PonderacionConfig = {
  enabled: true,
  design: { var: "", pop_sizes: {}, peso_columna: "peso_diseno" },
  rake: {
    margins: [{ var: "sexo", targets: { "1": 0.48, "2": 0.52 } }],
    faltantes: "imputar",
    imputacion: { umbral: 0.05, semilla: 20261104 },
  },
  trim: { cap: 5, recalibrar: true },
  escala: "expansion",
};

function sembrar() {
  useAnaliticaStore.setState({
    config: { ...DEFAULT_CONFIG, ponderacion: CONFIG },
    hydrated: true,
    dirty: false,
  });
}
const pond = () => useAnaliticaStore.getState().config.ponderacion;

describe("ponderación — editar no borra lo declarado", () => {
  beforeEach(sembrar);

  test("editar una meta conserva el peso base, NA/98/99 y la recalibración", () => {
    useAnaliticaStore.getState().upsertPonderMargin({ var: "sexo", targets: { "1": 0.5, "2": 0.5 } });
    expect(pond().design?.peso_columna).toBe("peso_diseno");
    expect(pond().rake.faltantes).toBe("imputar");
    expect(pond().rake.imputacion).toEqual({ umbral: 0.05, semilla: 20261104 });
    expect(pond().trim).toEqual({ cap: 5, recalibrar: true });
    expect(pond().escala).toBe("expansion");
  });

  test("quitar un margen conserva el tratamiento de NA/98/99", () => {
    useAnaliticaStore.getState().removePonderMargin("sexo");
    expect(pond().rake.margins).toEqual([]);
    expect(pond().rake.faltantes).toBe("imputar");
  });

  test("editar el estrato del diseño no borra el peso base", () => {
    useAnaliticaStore.getState().setPonderDesign({ var: "distrito", pop_sizes: { A: 10 } });
    expect(pond().design).toEqual({ var: "distrito", pop_sizes: { A: 10 }, peso_columna: "peso_diseno" });
  });

  test("cambiar el tope del recorte conserva la recalibración", () => {
    useAnaliticaStore.getState().setPonderTrim({ cap: 4 });
    expect(pond().trim).toEqual({ cap: 4, recalibrar: true });
    useAnaliticaStore.getState().setPonderTrim(null);
    expect(pond().trim).toBeNull();
  });

  test("cambiar NA/98/99 conserva los márgenes", () => {
    useAnaliticaStore.getState().setPonderRake({ faltantes: "excluir" });
    expect(pond().rake.margins).toHaveLength(1);
    expect(pond().rake.imputacion).toEqual({ umbral: 0.05, semilla: 20261104 });
  });
});
