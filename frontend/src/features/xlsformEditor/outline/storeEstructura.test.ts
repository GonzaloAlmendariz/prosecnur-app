// Estado UI de la Estructura. Mata: una búsqueda, un filtro o un plegado de un formulario que aparecen al abrir otro.
import { beforeEach, describe, expect, test } from "vitest";
import { estadoDe, useEstructuraStore } from "./storeEstructura";

describe("storeEstructura por formulario", () => {
  beforeEach(() => useEstructuraStore.getState().abrirFormulario(null));

  test("al abrir otro formulario, búsqueda, filtro y plegado vuelven a cero", () => {
    const s = useEstructuraStore.getState();
    s.abrirFormulario("A");
    s.setConsulta("edad");
    s.setFiltro("aviso");
    s.alternarPlegada("n:sec1");
    expect(estadoDe(useEstructuraStore.getState(), "A")).toMatchObject({ consulta: "edad", filtro: "aviso" });
    // Antes de reiniciar, lo que se pinta para B ya es el estado inicial (ni un cuadro con lo de A).
    expect(estadoDe(useEstructuraStore.getState(), "B")).toMatchObject({ consulta: "", filtro: "todas" });
    useEstructuraStore.getState().abrirFormulario("B");
    const b = useEstructuraStore.getState();
    expect(b).toMatchObject({ formulario: "B", consulta: "", filtro: "todas" });
    expect(b.plegadas.size).toBe(0);
  });

  test("volver a pedir el mismo formulario no borra nada", () => {
    const s = useEstructuraStore.getState();
    s.abrirFormulario("A");
    s.setConsulta("edad");
    useEstructuraStore.getState().abrirFormulario("A");
    expect(useEstructuraStore.getState().consulta).toBe("edad");
  });
});
